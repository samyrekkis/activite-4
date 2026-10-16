"""Calcul des créneaux libres à partir des horaires du cabinet et des RDV existants."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any

from .db import Database
from .tenants import JOURS, Service, Tenant

MOIS = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]

MOMENTS = {
    "matin": (time(0, 0), time(13, 0)),
    "apres-midi": (time(13, 0), time(17, 0)),
    "soir": (time(17, 0), time(23, 59)),
}

FORMAT = "%Y-%m-%dT%H:%M"

log = logging.getLogger("planning")


def libelle_date(d: date) -> str:
    return f"{JOURS[d.weekday()]} {d.day} {MOIS[d.month - 1]} {d.year}"


def libelle_heure(t: time) -> str:
    return f"{t.hour}h{t.minute:02d}"


def libelle_creneau(dt: datetime) -> str:
    return f"{libelle_date(dt.date())} à {libelle_heure(dt.time())}"


def parse_local(value: str) -> datetime:
    """Accepte 'YYYY-MM-DDTHH:MM' (secondes / fuseau ignorés)."""
    value = value.strip().replace(" ", "T")
    return datetime.strptime(value[:16], FORMAT)


def normaliser_moment(moment: str | None) -> str | None:
    if not moment:
        return None
    m = moment.strip().lower().replace("è", "e").replace("_", "-").replace(" ", "-")
    if m.startswith("mat"):
        return "matin"
    if m.startswith("apr") or m.startswith("apres"):
        return "apres-midi"
    if m.startswith("soir"):
        return "soir"
    return None


@dataclass
class Creneau:
    debut: datetime
    fin: datetime

    def to_dict(self) -> dict:
        return {"debut": self.debut.strftime(FORMAT), "libelle": libelle_creneau(self.debut)}


class Planning:
    def __init__(self, tenant: Tenant, db: Database, externe: Any = None):
        self.tenant = tenant
        self.db = db
        self.externe = externe  # connecteur app.agenda (Google Agenda, CRM) ou None
        self._externes: list[tuple[datetime, datetime, str | None]] | None = None

    def maintenant(self) -> datetime:
        """Heure locale du cabinet, sans fuseau (tout est stocké en heure locale)."""
        return datetime.now(self.tenant.fuseau).replace(tzinfo=None, second=0, microsecond=0)

    def _occupations_externes(self) -> list[tuple[datetime, datetime, str | None]]:
        """Créneaux occupés dans l'agenda du cabinet, chargés une seule fois par appel d'outil.

        Les événements créés par l'assistante elle-même (déjà dans notre base) sont ignorés
        pour ne pas les compter deux fois. Si l'agenda ne répond pas, on continue avec notre base.
        """
        if self.externe is None:
            return []
        if self._externes is None:
            debut = self.maintenant().date()
            try:
                occ = self.externe.occupations(debut, debut + timedelta(days=self.tenant.horizon_jours + 1))
            except Exception as e:  # noqa: BLE001 — un agenda en panne ne doit pas bloquer l'appel
                log.warning("[%s] agenda externe indisponible : %s", self.tenant.id, e)
                occ = []
            connus = {r["external_id"] for r in self.db.query(
                "SELECT external_id FROM rendez_vous WHERE tenant=? AND external_id IS NOT NULL", (self.tenant.id,))}
            self._externes = [(o.debut, o.fin, o.id) for o in occ if not (o.id and o.id in connus)]
        return self._externes

    def _occupes(self, jour: date, ignorer_rdv_id: int | None = None) -> list[tuple[datetime, datetime]]:
        lendemain = jour + timedelta(days=1)
        rows = self.db.query(
            "SELECT id, debut, fin FROM rendez_vous WHERE tenant=? AND statut='confirme' "
            "AND debut >= ? AND debut < ?",
            (self.tenant.id, jour.isoformat(), lendemain.isoformat()),
        )
        occupes = [(parse_local(r["debut"]), parse_local(r["fin"])) for r in rows if r["id"] != ignorer_rdv_id]
        debut_jour, fin_jour = datetime.combine(jour, time(0)), datetime.combine(lendemain, time(0))
        occupes += [(d, f) for d, f, _ in self._occupations_externes() if d < fin_jour and debut_jour < f]
        return occupes

    def _plages(self, jour: date) -> list[tuple[datetime, datetime]]:
        if jour.isoformat() in self.tenant.fermetures:
            return []
        plages = self.tenant.horaires.get(JOURS[jour.weekday()], [])
        out = []
        for debut, fin in plages:
            h1 = datetime.combine(jour, time.fromisoformat(debut))
            h2 = datetime.combine(jour, time.fromisoformat(fin))
            out.append((h1, h2))
        return out

    def est_ouvert(self, jour: date) -> bool:
        return bool(self._plages(jour))

    def creneaux_du_jour(
        self,
        jour: date,
        service: Service,
        maintenant: datetime | None = None,
        ignorer_rdv_id: int | None = None,
    ) -> list[Creneau]:
        maintenant = maintenant or self.maintenant()
        limite = maintenant + timedelta(minutes=self.tenant.delai_min_minutes)
        duree = timedelta(minutes=service.duree)
        pas = timedelta(minutes=self.tenant.pas_minutes)
        occupes = self._occupes(jour, ignorer_rdv_id)

        creneaux: list[Creneau] = []
        for p_debut, p_fin in self._plages(jour):
            t = p_debut
            while t + duree <= p_fin:
                if t >= limite:
                    chevauchements = sum(1 for d, f in occupes if d < t + duree and t < f)
                    if chevauchements < self.tenant.capacite:
                        creneaux.append(Creneau(t, t + duree))
                t += pas
        return creneaux

    def rechercher(
        self,
        service: Service,
        a_partir_du: date | None = None,
        moment: str | None = None,
        heure_souhaitee: time | None = None,
        max_resultats: int = 6,
        max_par_jour: int = 3,
    ) -> list[Creneau]:
        """Propose quelques créneaux, répartis sur les prochains jours ouverts."""
        maintenant = self.maintenant()
        jour = max(a_partir_du or maintenant.date(), maintenant.date())
        fin_horizon = maintenant.date() + timedelta(days=self.tenant.horizon_jours)
        moment = normaliser_moment(moment)
        resultats: list[Creneau] = []
        while jour <= fin_horizon and len(resultats) < max_resultats:
            creneaux = self.creneaux_du_jour(jour, service, maintenant)
            if moment:
                h1, h2 = MOMENTS[moment]
                creneaux = [c for c in creneaux if h1 <= c.debut.time() < h2]
            if heure_souhaitee:
                cible = datetime.combine(jour, heure_souhaitee)
                creneaux.sort(key=lambda c: abs((c.debut - cible).total_seconds()))
                creneaux = sorted(creneaux[:max_par_jour], key=lambda c: c.debut)
            else:
                creneaux = self._repartir(creneaux, max_par_jour)
            resultats.extend(creneaux[: max_resultats - len(resultats)])
            jour += timedelta(days=1)
        return resultats

    @staticmethod
    def _repartir(creneaux: list[Creneau], n: int) -> list[Creneau]:
        """Prend n créneaux étalés dans la journée plutôt que les n premiers."""
        if len(creneaux) <= n:
            return creneaux
        if n == 1:
            return [creneaux[0]]
        idx = sorted({round(i * (len(creneaux) - 1) / (n - 1)) for i in range(n)})
        return [creneaux[i] for i in idx]

    def creneau_disponible(
        self, debut: datetime, service: Service, ignorer_rdv_id: int | None = None
    ) -> bool:
        if debut.date() > self.maintenant().date() + timedelta(days=self.tenant.horizon_jours):
            return False
        return any(
            c.debut == debut
            for c in self.creneaux_du_jour(debut.date(), service, ignorer_rdv_id=ignorer_rdv_id)
        )


def normaliser_telephone(numero: str | None) -> str:
    """Normalise un numéro algérien au format international +213XXXXXXXXX.

    Les numéros étrangers (déjà au format +XX...) sont conservés.
    """
    if not numero:
        return ""
    chiffres = "".join(c for c in numero if c.isdigit() or c == "+")
    if chiffres.startswith("+"):
        return "+" + chiffres[1:].replace("+", "")
    chiffres = chiffres.replace("+", "")
    if chiffres.startswith("00"):
        return "+" + chiffres[2:]
    if chiffres.startswith("213"):
        return "+" + chiffres
    if chiffres.startswith("0") and len(chiffres) in (9, 10):
        return "+213" + chiffres[1:]
    if len(chiffres) in (8, 9) and not chiffres.startswith("0"):
        return "+213" + chiffres
    return chiffres


def telephone_lisible(numero: str) -> str:
    """+213550123456 -> '0550 12 34 56' (pour la relecture à voix haute)."""
    if numero.startswith("+213"):
        local = "0" + numero[4:]
        if len(local) == 10:
            return f"{local[:4]} {local[4:6]} {local[6:8]} {local[8:]}"
        if len(local) == 9:
            return f"{local[:3]} {local[3:5]} {local[5:7]} {local[7:]}"
        return local
    return numero
