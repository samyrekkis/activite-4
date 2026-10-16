"""Outils appelés par l'agent vocal pendant la conversation.

Chaque outil reçoit les arguments extraits par le LLM et un contexte d'appel,
et renvoie un dictionnaire sérialisé en JSON pour le LLM. Les messages
d'erreur sont rédigés pour que l'agent sache quoi dire ensuite.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from functools import cached_property
from datetime import date, datetime, time, timedelta
from typing import Any, Callable

from .db import Database
from .scheduling import (
    FORMAT,
    Planning,
    libelle_creneau,
    libelle_date,
    normaliser_telephone,
    parse_local,
    telephone_lisible,
)
from .tenants import Tenant


log = logging.getLogger("tools")


@dataclass
class Evenement:
    """Notification à envoyer au cabinet après la réponse à l'agent."""
    # rdv_cree | rdv_annule | rdv_deplace | rdv_confirme | message | attente | creneau_libere | alerte
    type: str
    texte: str
    data: dict[str, Any]
    urgent: bool = False


@dataclass
class ContexteAppel:
    tenant: Tenant
    db: Database
    call_id: str | None = None
    numero_appelant: str | None = None
    evenements: list[Evenement] = field(default_factory=list)
    # Appels sortants : "relance" (confirmation d'un RDV) ou "offre" (créneau libéré proposé à la liste d'attente).
    mode: str = "entrant"
    rdv_id: int | None = None
    attente_id: int | None = None

    @cached_property
    def planning(self) -> Planning:
        return Planning(self.tenant, self.db, self.tenant.agenda_externe())

    def synchroniser(self, action: str, *args: Any) -> Any:
        """Répercute une action dans l'agenda / le CRM du cabinet, sans jamais faire échouer l'appel."""
        agenda = self.tenant.agenda_externe()
        if agenda is None:
            return None
        try:
            return getattr(agenda, action)(*args)
        except Exception as e:  # noqa: BLE001
            log.warning("[%s] synchro agenda %s KO : %s", self.tenant.id, action, e)
            self.evenements.append(Evenement(
                "alerte", f"⚠️ Agenda du cabinet non mis à jour ({action}) : à reporter à la main.\n{e}",
                {"action": action}))
            return None


class ErreurOutil(Exception):
    pass


def _telephone(ctx: ContexteAppel, valeur: str | None) -> str:
    tel = normaliser_telephone(valeur) or normaliser_telephone(ctx.numero_appelant)
    if not tel:
        raise ErreurOutil("Numéro de téléphone manquant : demande-le à l'appelant.")
    return tel


def _date(valeur: str | None) -> date | None:
    if not valeur:
        return None
    try:
        return date.fromisoformat(valeur.strip()[:10])
    except ValueError:
        raise ErreurOutil(f"Date invalide {valeur!r} : utilise le format AAAA-MM-JJ.")


def _heure(valeur: str | None) -> time | None:
    if not valeur:
        return None
    v = valeur.strip().lower().replace("h", ":")
    if v.endswith(":"):
        v += "00"
    try:
        return time.fromisoformat(v if len(v.split(":")[0]) == 2 else "0" + v)
    except ValueError:
        return None


def _debut(valeur: str | None) -> datetime:
    if not valeur:
        raise ErreurOutil("Créneau manquant : propose d'abord des créneaux avec verifier_disponibilites.")
    try:
        return parse_local(valeur)
    except ValueError:
        raise ErreurOutil(f"Créneau invalide {valeur!r} : utilise le champ 'debut' renvoyé par verifier_disponibilites.")


def verifier_disponibilites(ctx: ContexteAppel, args: dict[str, Any]) -> dict[str, Any]:
    service = ctx.tenant.service(args.get("service"))
    planning = ctx.planning
    jour = _date(args.get("date"))
    heure = _heure(args.get("heure_souhaitee"))
    # Sans date précise : 3 propositions sur 3 jours différents de la semaine.
    sans_date = jour is None and heure is None
    creneaux = planning.rechercher(
        service,
        a_partir_du=jour,
        moment=args.get("moment"),
        heure_souhaitee=heure,
        max_resultats=3 if sans_date else 4,
        max_par_jour=1 if sans_date else 3,
    )
    maintenant = planning.maintenant()
    reponse: dict[str, Any] = {
        "aujourd_hui": f"{libelle_date(maintenant.date())}, il est {maintenant.strftime('%H:%M')}",
        "service": service.nom,
        "duree_minutes": service.duree,
        "creneaux": [c.to_dict() for c in creneaux],
    }
    if jour and not planning.est_ouvert(jour):
        reponse["remarque"] = f"Le cabinet est fermé le {libelle_date(jour)}. Créneaux proposés à partir du jour ouvert suivant."
    elif jour and creneaux and creneaux[0].debut.date() != jour:
        reponse["remarque"] = f"Plus de place le {libelle_date(jour)}. Voici les créneaux suivants."
    if not creneaux:
        reponse["remarque"] = (
            "Aucun créneau libre sur la période. Propose l'inscription sur la liste d'attente "
            "(outil inscrire_liste_attente) : on le rappellera dès qu'une place se libère."
        )
    return reponse


def prendre_rendez_vous(ctx: ContexteAppel, args: dict[str, Any]) -> dict[str, Any]:
    nom = (args.get("nom") or "").strip()
    if not nom:
        raise ErreurOutil("Nom manquant : demande le nom et le prénom de la personne.")
    tel = _telephone(ctx, args.get("telephone"))
    service = ctx.tenant.service(args.get("service"))
    debut = _debut(args.get("debut"))
    fin = debut + timedelta(minutes=service.duree)

    with ctx.db.transaction() as conn:
        if not ctx.planning.creneau_disponible(debut, service):
            alternatives = ctx.planning.rechercher(service, a_partir_du=debut.date(), max_resultats=3)
            return {
                "succes": False,
                "raison": "Ce créneau n'est plus disponible.",
                "alternatives": [c.to_dict() for c in alternatives],
            }
        cur = conn.execute(
            "INSERT INTO rendez_vous (tenant, nom, telephone, service, debut, fin, notes, call_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                ctx.tenant.id, nom, tel, service.nom,
                debut.strftime(FORMAT), fin.strftime(FORMAT),
                (args.get("notes") or "").strip(), ctx.call_id,
            ),
        )
        rdv_id = cur.lastrowid

    external_id = ctx.synchroniser("creer", {
        "nom": nom, "telephone": tel, "service": service.nom, "notes": (args.get("notes") or "").strip(),
        "debut": debut.strftime(FORMAT), "fin": fin.strftime(FORMAT)})
    if external_id:
        ctx.db.execute("UPDATE rendez_vous SET external_id=? WHERE id=?", (external_id, rdv_id))

    libelle = libelle_creneau(debut)
    ctx.evenements.append(Evenement(
        "rdv_cree",
        f"✅ Nouveau RDV #{rdv_id}\n{nom} — {telephone_lisible(tel)}\n{service.nom}\n{libelle}"
        + (f"\nNote : {args['notes']}" if args.get("notes") else ""),
        {"id": rdv_id, "nom": nom, "telephone": tel, "service": service.nom, "debut": debut.strftime(FORMAT)},
    ))
    return {
        "succes": True,
        "reference": rdv_id,
        "recapitulatif": f"{service.nom} le {libelle}, au nom de {nom}, téléphone {telephone_lisible(tel)}",
        "adresse": ctx.tenant.get("adresse", ""),
    }


def _rdv_dict(r: Any) -> dict[str, Any]:
    return {"id": r["id"], "nom": r["nom"], "service": r["service"], "debut": r["debut"], "fin": r["fin"],
            "external_id": r["external_id"], "libelle": libelle_creneau(parse_local(r["debut"]))}


def _rdv_a_venir(ctx: ContexteAppel, tel: str) -> list[dict[str, Any]]:
    rows = ctx.db.query(
        "SELECT * FROM rendez_vous WHERE tenant=? AND telephone=? "
        "AND statut='confirme' AND debut >= ? ORDER BY debut",
        (ctx.tenant.id, tel, ctx.planning.maintenant().strftime(FORMAT)),
    )
    return [_rdv_dict(r) for r in rows]


def chercher_rendez_vous(ctx: ContexteAppel, args: dict[str, Any]) -> dict[str, Any]:
    tel = _telephone(ctx, args.get("telephone"))
    rdvs = _rdv_a_venir(ctx, tel)
    rdvs = [{k: v for k, v in r.items() if k not in ("external_id", "fin")} for r in rdvs]
    if not rdvs:
        return {"rendez_vous": [], "remarque": f"Aucun rendez-vous à venir pour le {telephone_lisible(tel)}. Demande s'il a pris RDV avec un autre numéro."}
    return {"rendez_vous": rdvs}


def _rdv_de_l_appelant(ctx: ContexteAppel, args: dict[str, Any]) -> dict[str, Any]:
    if ctx.mode == "relance":
        # Appel de confirmation : on agit uniquement sur le RDV pour lequel on a appelé.
        rows = ctx.db.query("SELECT * FROM rendez_vous WHERE id=? AND tenant=? AND statut='confirme'",
                            (ctx.rdv_id, ctx.tenant.id))
        if not rows:
            raise ErreurOutil("Ce rendez-vous n'existe plus ou est déjà annulé.")
        return _rdv_dict(rows[0])
    tel = _telephone(ctx, args.get("telephone"))
    rdvs = _rdv_a_venir(ctx, tel)
    rdv_id = args.get("rendez_vous_id")
    if rdv_id is None:
        if len(rdvs) == 1:
            return rdvs[0]
        raise ErreurOutil("Précise quel rendez-vous : appelle d'abord chercher_rendez_vous.")
    for r in rdvs:
        if int(r["id"]) == int(rdv_id):
            return r
    raise ErreurOutil("Rendez-vous introuvable pour ce numéro. Vérifie le numéro de téléphone utilisé lors de la réservation.")


def annuler_rendez_vous(ctx: ContexteAppel, args: dict[str, Any]) -> dict[str, Any]:
    rdv = _rdv_de_l_appelant(ctx, args)
    ctx.db.execute(
        "UPDATE rendez_vous SET statut='annule', modifie_le=datetime('now'), "
        "confirmation=CASE WHEN ?='relance' THEN 'annule_relance' ELSE confirmation END WHERE id=?",
        (ctx.mode, rdv["id"]),
    )
    if rdv["external_id"]:
        ctx.synchroniser("annuler", rdv["external_id"])
    ctx.evenements.append(evenement_creneau_libere(rdv))
    ctx.evenements.append(Evenement(
        "rdv_annule",
        f"❌ RDV #{rdv['id']} annulé\n{rdv['nom']} — {rdv['service']}\n{rdv['libelle']}"
        + (f"\nMotif : {args['motif']}" if args.get("motif") else ""),
        {"id": rdv["id"]},
    ))
    return {"succes": True, "annule": rdv["libelle"]}


def deplacer_rendez_vous(ctx: ContexteAppel, args: dict[str, Any]) -> dict[str, Any]:
    rdv = _rdv_de_l_appelant(ctx, args)
    service = ctx.tenant.service(rdv["service"])
    nouveau = _debut(args.get("nouveau_debut"))
    fin = nouveau + timedelta(minutes=service.duree)
    with ctx.db.transaction() as conn:
        if not ctx.planning.creneau_disponible(nouveau, service, ignorer_rdv_id=rdv["id"]):
            alternatives = ctx.planning.rechercher(service, a_partir_du=nouveau.date(), max_resultats=3)
            return {"succes": False, "raison": "Ce créneau n'est pas disponible.",
                    "alternatives": [c.to_dict() for c in alternatives]}
        conn.execute(
            "UPDATE rendez_vous SET debut=?, fin=?, modifie_le=datetime('now'), "
            "confirmation=CASE WHEN ?='relance' THEN 'confirme' ELSE NULL END, relance_tentatives=0 WHERE id=?",
            (nouveau.strftime(FORMAT), fin.strftime(FORMAT), ctx.mode, rdv["id"]),
        )
    if rdv["external_id"]:
        ctx.synchroniser("modifier", rdv["external_id"], nouveau, fin)
    ctx.evenements.append(evenement_creneau_libere(rdv))
    libelle = libelle_creneau(nouveau)
    ctx.evenements.append(Evenement(
        "rdv_deplace",
        f"🔁 RDV #{rdv['id']} déplacé\n{rdv['nom']} — {rdv['service']}\nAncien : {rdv['libelle']}\nNouveau : {libelle}",
        {"id": rdv["id"], "debut": nouveau.strftime(FORMAT)},
    ))
    return {"succes": True, "nouveau_creneau": libelle}


def laisser_message(ctx: ContexteAppel, args: dict[str, Any]) -> dict[str, Any]:
    nom = (args.get("nom") or "").strip() or "Inconnu"
    tel = _telephone(ctx, args.get("telephone"))
    motif = (args.get("motif") or "").strip()
    if not motif:
        raise ErreurOutil("Motif manquant : demande en une phrase la raison de l'appel.")
    urgent = bool(args.get("urgent"))
    cur = ctx.db.execute(
        "INSERT INTO messages (tenant, nom, telephone, motif, urgent, call_id) VALUES (?, ?, ?, ?, ?, ?)",
        (ctx.tenant.id, nom, tel, motif, int(urgent), ctx.call_id),
    )
    ctx.evenements.append(Evenement(
        "message",
        f"{'🚨 URGENT — ' if urgent else '📩 '}Message à rappeler\n{nom} — {telephone_lisible(tel)}\n{motif}",
        {"id": cur.lastrowid, "nom": nom, "telephone": tel, "motif": motif},
        urgent=urgent,
    ))
    return {"succes": True, "remarque": "Message transmis. Le cabinet rappellera la personne."}


def evenement_creneau_libere(rdv: dict[str, Any]) -> Evenement:
    """Un créneau vient de se libérer : il pourra être proposé à la liste d'attente."""
    return Evenement("creneau_libere", "", {"debut": rdv["debut"], "fin": rdv["fin"], "service": rdv["service"]})


def inscrire_liste_attente(ctx: ContexteAppel, args: dict[str, Any]) -> dict[str, Any]:
    nom = (args.get("nom") or "").strip()
    if not nom:
        raise ErreurOutil("Nom manquant : demande le nom et le prénom de la personne.")
    tel = _telephone(ctx, args.get("telephone"))
    service = ctx.tenant.service(args.get("service"))
    preference = (args.get("preference") or "").strip()
    ctx.db.execute(
        "INSERT INTO liste_attente (tenant, nom, telephone, service, preference) VALUES (?, ?, ?, ?, ?)",
        (ctx.tenant.id, nom, tel, service.nom, preference))
    ctx.evenements.append(Evenement(
        "attente", f"⏳ Liste d'attente\n{nom} — {telephone_lisible(tel)}\n{service.nom}"
        + (f"\nPréférence : {preference}" if preference else ""), {"nom": nom, "telephone": tel}))
    return {"succes": True, "remarque": "Inscrit sur la liste d'attente. Le cabinet le rappellera dès qu'une place se libère."}


def confirmer_presence(ctx: ContexteAppel, args: dict[str, Any]) -> dict[str, Any]:
    """Appel de confirmation : le patient confirme qu'il viendra."""
    rdv = _rdv_de_l_appelant(ctx, args)
    ctx.db.execute("UPDATE rendez_vous SET confirmation='confirme', modifie_le=datetime('now') WHERE id=?",
                   (rdv["id"],))
    ctx.evenements.append(Evenement(
        "rdv_confirme", f"👍 RDV #{rdv['id']} confirmé par le patient\n{rdv['nom']} — {rdv['service']}\n{rdv['libelle']}",
        {"id": rdv["id"]}))
    return {"succes": True, "confirme": rdv["libelle"]}


def _offre(ctx: ContexteAppel) -> Any:
    rows = ctx.db.query("SELECT * FROM liste_attente WHERE id=? AND tenant=?", (ctx.attente_id, ctx.tenant.id))
    if not rows or not rows[0]["offre_debut"]:
        raise ErreurOutil("Cette proposition n'existe plus.")
    return rows[0]


def accepter_creneau(ctx: ContexteAppel, args: dict[str, Any]) -> dict[str, Any]:
    """Appel « liste d'attente » : la personne accepte le créneau libéré."""
    attente = _offre(ctx)
    resultat = prendre_rendez_vous(ctx, {
        "nom": attente["nom"], "telephone": attente["telephone"], "service": attente["service"],
        "debut": attente["offre_debut"], "notes": "Pris depuis la liste d'attente"})
    if resultat.get("succes"):
        ctx.db.execute("UPDATE liste_attente SET statut='servi' WHERE id=?", (attente["id"],))
    else:
        resultat["raison"] = "Le créneau vient d'être pris par quelqu'un d'autre. Excuse-toi et propose de rester sur la liste."
    return resultat


def refuser_creneau(ctx: ContexteAppel, args: dict[str, Any]) -> dict[str, Any]:
    attente = _offre(ctx)
    garder = args.get("rester_sur_liste", True) is not False
    ctx.db.execute("UPDATE liste_attente SET statut=? WHERE id=?",
                   ("en_attente" if garder else "expire", attente["id"]))
    return {"succes": True, "reste_sur_liste": garder}


OUTILS_PAR_MODE = {
    "entrant": {"verifier_disponibilites", "prendre_rendez_vous", "chercher_rendez_vous", "annuler_rendez_vous",
                "deplacer_rendez_vous", "laisser_message", "inscrire_liste_attente"},
    "relance": {"confirmer_presence", "annuler_rendez_vous", "deplacer_rendez_vous",
                "verifier_disponibilites", "laisser_message"},
    "offre": {"accepter_creneau", "refuser_creneau", "laisser_message"},
    "whatsapp": {"verifier_disponibilites", "prendre_rendez_vous", "chercher_rendez_vous", "annuler_rendez_vous",
                 "deplacer_rendez_vous", "laisser_message", "inscrire_liste_attente", "confirmer_presence"},
}


OUTILS: dict[str, Callable[[ContexteAppel, dict[str, Any]], dict[str, Any]]] = {
    "verifier_disponibilites": verifier_disponibilites,
    "prendre_rendez_vous": prendre_rendez_vous,
    "chercher_rendez_vous": chercher_rendez_vous,
    "annuler_rendez_vous": annuler_rendez_vous,
    "deplacer_rendez_vous": deplacer_rendez_vous,
    "laisser_message": laisser_message,
    "inscrire_liste_attente": inscrire_liste_attente,
    "confirmer_presence": confirmer_presence,
    "accepter_creneau": accepter_creneau,
    "refuser_creneau": refuser_creneau,
}


def executer(ctx: ContexteAppel, nom: str, args: dict[str, Any]) -> dict[str, Any]:
    outil = OUTILS.get(nom) if nom in OUTILS_PAR_MODE.get(ctx.mode, set()) else None
    if outil is None:
        return {"erreur": f"Outil inconnu : {nom}"}
    try:
        return outil(ctx, args or {})
    except ErreurOutil as e:
        return {"erreur": str(e)}
