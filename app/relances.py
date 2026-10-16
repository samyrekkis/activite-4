"""Appels sortants : confirmation des RDV et proposition des créneaux libérés à la liste d'attente.

1. Relance : X heures avant un RDV (48 h par défaut), pendant la plage horaire autorisée,
   l'assistante appelle le patient. Il confirme, déplace ou annule. Sans réponse, elle rappelle
   (2 tentatives par défaut), puis prévient le cabinet que le patient est injoignable.
2. Liste d'attente : quand un créneau se libère (annulation, déplacement), le cabinet reçoit la
   liste des personnes en attente sur Telegram. Si "appel_auto" est activé, l'assistante appelle
   la première ; si elle refuse ou ne répond pas, la suivante (3 personnes au maximum par créneau).
"""
from __future__ import annotations

import logging
from datetime import datetime, time, timedelta
from typing import Any, Callable

import httpx

from .db import Database
from .scheduling import FORMAT, Planning, libelle_creneau, parse_local, telephone_lisible
from .tenants import JOURS, Tenant
from .tools import Evenement
from .vapi import build_assistant_offre, build_assistant_relance

log = logging.getLogger("relances")

# Fins d'appel Vapi qui signifient que personne n'a vraiment répondu.
SANS_REPONSE = ("customer-did-not-answer", "customer-busy", "voicemail", "no-answer",
                "twilio-failed-to-connect-call", "silence-timed-out")

# lanceur(tenant, numero, nom, assistant) -> identifiant de l'appel Vapi
Lanceur = Callable[[Tenant, str, str, dict[str, Any]], str | None]


def lanceur_vapi(api_key: str) -> Lanceur:
    def lancer(t: Tenant, numero: str, nom: str, assistant: dict[str, Any]) -> str | None:
        phone_id = t.raw.get("vapi_phone_number_id")
        if not phone_id:
            raise RuntimeError("vapi_phone_number_id manquant : impossible d'appeler")
        r = httpx.post(
            "https://api.vapi.ai/call",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"phoneNumberId": phone_id, "customer": {"number": numero, "name": nom}, "assistant": assistant},
            timeout=20,
        )
        r.raise_for_status()
        return r.json().get("id")
    return lancer


class Relanceur:
    def __init__(self, db: Database, base_url: str, secret: str, lanceur: Lanceur | None):
        self.db = db
        self.base_url = base_url
        self.secret = secret
        self.lanceur = lanceur

    # ------------------------------------------------------------------ relances (confirmation)

    @staticmethod
    def dans_la_plage(t: Tenant, maintenant: datetime) -> bool:
        cfg = t.relance
        if JOURS[maintenant.weekday()] in cfg["jours_exclus"]:
            return False
        return time.fromisoformat(cfg["plage"][0]) <= maintenant.time() < time.fromisoformat(cfg["plage"][1])

    def relances_dues(self, t: Tenant, maintenant: datetime) -> list[Any]:
        cfg = t.relance
        if not cfg["actif"] or not self.dans_la_plage(t, maintenant):
            return []
        limite = maintenant + timedelta(hours=cfg["heures_avant"])
        trop_tard = maintenant + timedelta(hours=3)  # inutile d'appeler pour un RDV dans moins de 3 h
        rappel = (maintenant - timedelta(hours=cfg["intervalle_heures"])).strftime(FORMAT)
        bloque = (maintenant - timedelta(hours=1)).strftime(FORMAT)
        return self.db.query(
            "SELECT * FROM rendez_vous WHERE tenant=? AND statut='confirme' AND telephone != '' "
            "AND debut > ? AND debut <= ? AND ("
            "  confirmation IS NULL"
            "  OR (confirmation='sans_reponse' AND relance_tentatives < ? AND relance_derniere <= ?)"
            "  OR (confirmation='appel_en_cours' AND relance_derniere <= ?)"  # rapport de fin jamais reçu
            ") ORDER BY debut",
            (t.id, trop_tard.strftime(FORMAT), limite.strftime(FORMAT), cfg["tentatives"], rappel, bloque),
        )

    def lancer_relances(self, t: Tenant, maintenant: datetime) -> list[Evenement]:
        evenements = []
        for r in self.relances_dues(t, maintenant):
            if r["confirmation"] == "appel_en_cours" and r["relance_tentatives"] >= t.relance["tentatives"]:
                evenements += self._injoignable(t, r)
                continue
            rdv = {"id": r["id"], "nom": r["nom"], "service": r["service"],
                   "libelle": libelle_creneau(parse_local(r["debut"]))}
            self.db.execute(
                "UPDATE rendez_vous SET confirmation='appel_en_cours', relance_tentatives=relance_tentatives+1, "
                "relance_derniere=? WHERE id=?", (maintenant.strftime(FORMAT), r["id"]))
            try:
                if self.lanceur is None:
                    raise RuntimeError("appels sortants non configurés (VAPI_API_KEY)")
                self.lanceur(t, r["telephone"], r["nom"],
                             build_assistant_relance(t, self.base_url, self.secret, rdv))
                log.info("[%s] relance lancée pour RDV #%s", t.id, r["id"])
            except Exception as e:  # noqa: BLE001
                log.error("[%s] relance RDV #%s impossible : %s", t.id, r["id"], e)
                self.db.execute("UPDATE rendez_vous SET confirmation='sans_reponse' WHERE id=?", (r["id"],))
        return evenements

    def _injoignable(self, t: Tenant, r: Any) -> list[Evenement]:
        self.db.execute("UPDATE rendez_vous SET confirmation='injoignable' WHERE id=?", (r["id"],))
        return [Evenement(
            "alerte",
            f"📵 Patient injoignable pour confirmer\n{r['nom']} — {telephone_lisible(r['telephone'])}\n"
            f"{r['service']}, {libelle_creneau(parse_local(r['debut']))}\nÀ rappeler par le cabinet.",
            {"id": r["id"]})]

    def fin_relance(self, t: Tenant, rdv_id: int, raison_fin: str | None) -> list[Evenement]:
        """Rapport de fin d'un appel de relance."""
        rows = self.db.query("SELECT * FROM rendez_vous WHERE id=? AND tenant=?", (rdv_id, t.id))
        if not rows or rows[0]["confirmation"] != "appel_en_cours":
            return []  # le patient a confirmé, déplacé ou annulé pendant l'appel
        r = rows[0]
        if r["relance_tentatives"] >= t.relance["tentatives"]:
            return self._injoignable(t, r)
        self.db.execute("UPDATE rendez_vous SET confirmation='sans_reponse' WHERE id=?", (rdv_id,))
        log.info("[%s] relance RDV #%s sans réponse (%s), nouvelle tentative plus tard", t.id, rdv_id, raison_fin)
        return []

    # ------------------------------------------------------------------ liste d'attente

    def candidats(self, t: Tenant, service: str, debut: str) -> list[Any]:
        """Personnes en attente non encore contactées pour ce créneau : même soin d'abord, puis les autres."""
        rows = self.db.query(
            "SELECT * FROM liste_attente WHERE tenant=? AND statut='en_attente' "
            "AND (offre_debut IS NULL OR offre_debut != ?) ORDER BY (service = ?) DESC, cree_le",
            (t.id, debut, service))
        return list(rows)

    def creneau_libere(self, t: Tenant, debut: str, service: str, maintenant: datetime) -> list[Evenement]:
        cfg = t.liste_attente
        if not cfg["actif"]:
            return []
        if parse_local(debut) < maintenant + timedelta(hours=cfg["delai_min_heures"]):
            return []
        candidats = self.candidats(t, service, debut)
        if not candidats:
            return []
        libelle = libelle_creneau(parse_local(debut))
        lignes = "\n".join(f"{i}. {c['nom']} — {telephone_lisible(c['telephone'])} ({c['service']})"
                           + (f", {c['preference']}" if c["preference"] else "")
                           for i, c in enumerate(candidats[:5], 1))
        auto = cfg["appel_auto"] and self.lanceur is not None
        evenements = [Evenement(
            "creneau_libere",
            f"🔔 Place libérée : {libelle} ({service})\nListe d'attente :\n{lignes}\n"
            + ("L'assistante appelle la première personne." if auto else "À proposer par le cabinet."),
            {"debut": debut})]
        if auto:
            self.proposer(t, debut, maintenant)
        return evenements

    def proposer(self, t: Tenant, debut: str, maintenant: datetime) -> bool:
        """Appelle la prochaine personne de la liste pour ce créneau. False s'il n'y a plus personne."""
        deja = self.db.query("SELECT COUNT(*) n FROM liste_attente WHERE tenant=? AND offre_debut=?",
                             (t.id, debut))[0]["n"]
        if deja >= t.liste_attente["max_contacts"]:
            return False
        for c in self.candidats(t, "", debut):
            service = t.service(c["service"])
            if not Planning(t, self.db, t.agenda_externe()).creneau_disponible(parse_local(debut), service):
                continue  # trop court pour son soin, ou déjà repris
            self.db.execute(
                "UPDATE liste_attente SET statut='contacte', offre_debut=?, contacte_le=? WHERE id=?",
                (debut, maintenant.strftime(FORMAT), c["id"]))
            attente = {"id": c["id"], "nom": c["nom"], "service": c["service"],
                       "offre_libelle": libelle_creneau(parse_local(debut))}
            try:
                self.lanceur(t, c["telephone"], c["nom"], build_assistant_offre(t, self.base_url, self.secret, attente))
                return True
            except Exception as e:  # noqa: BLE001
                log.error("[%s] appel liste d'attente #%s impossible : %s", t.id, c["id"], e)
                self.db.execute("UPDATE liste_attente SET statut='en_attente' WHERE id=?", (c["id"],))
        return False

    def fin_offre(self, t: Tenant, attente_id: int, maintenant: datetime) -> list[Evenement]:
        """Rapport de fin d'un appel « liste d'attente » : si pas de réponse claire, on passe au suivant."""
        rows = self.db.query("SELECT * FROM liste_attente WHERE id=? AND tenant=?", (attente_id, t.id))
        if not rows:
            return []
        a = rows[0]
        if a["statut"] == "contacte":  # ni accepté ni refusé (répondeur, raccroché)
            self.db.execute("UPDATE liste_attente SET statut='en_attente' WHERE id=?", (attente_id,))
        if a["statut"] != "servi" and a["offre_debut"] and self.lanceur is not None:
            self.proposer(t, a["offre_debut"], maintenant)
        return []
