"""Notifications au cabinet : Telegram (gratuit, très utilisé en Algérie) et webhook générique.

Le webhook générique permet de brancher n8n / Make / Zapier pour synchroniser
Google Agenda, envoyer un SMS ou un message WhatsApp, etc.
Une notification qui échoue ne doit jamais faire échouer l'appel : on journalise.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from .scheduling import telephone_lisible
from .tenants import Tenant
from .tools import Evenement

log = logging.getLogger("notify")


async def envoyer(tenant: Tenant, evenements: list[Evenement], telegram_token: str) -> None:
    if not evenements:
        return
    notif = tenant.get("notifications", {}) or {}
    chat_ids = notif.get("telegram_chat_ids") or (
        [notif["telegram_chat_id"]] if notif.get("telegram_chat_id") else []
    )
    webhook = notif.get("webhook_url")
    async with httpx.AsyncClient(timeout=10) as client:
        for ev in evenements:
            for chat_id in chat_ids if telegram_token else []:
                try:
                    r = await client.post(
                        f"https://api.telegram.org/bot{telegram_token}/sendMessage",
                        json={"chat_id": chat_id, "text": f"{tenant.nom}\n{ev.texte}"},
                    )
                    r.raise_for_status()
                except httpx.HTTPError as e:
                    log.warning("Telegram KO pour %s: %s", tenant.id, e)
            if webhook:
                try:
                    r = await client.post(webhook, json={
                        "tenant": tenant.id, "type": ev.type, "urgent": ev.urgent,
                        "texte": ev.texte, "data": ev.data,
                    })
                    r.raise_for_status()
                except httpx.HTTPError as e:
                    log.warning("Webhook KO pour %s: %s", tenant.id, e)


CATEGORIES = {
    "nouveau_patient": "Nouveau patient", "patient_existant": "Patient du cabinet", "urgence": "Urgence",
    "devis_soin_important": "Devis soin important", "information": "Renseignement",
    "annulation": "Annulation", "autre": "Autre",
}


def texte_fiche(fiche: dict[str, Any], numero: str | None, canal: str = "appel", source: str = "") -> str:
    """Fiche envoyée sur Telegram après chaque appel entrant ou conversation WhatsApp."""
    score = fiche.get("score_interet")
    titre = "📋 Fiche appel" if canal == "appel" else "💬 Fiche WhatsApp"
    if source == "pub":
        titre += " (venu par la pub)"
    if score is None:
        entete = titre
    else:
        niveau = "🔥 chaud" if score >= 80 else "🌤️ tiède" if score >= 50 else "❄️ froid"
        entete = f"{titre} — intérêt {score} % ({niveau})"
    lignes = [entete, f"{fiche.get('nom_appelant') or 'Nom non donné'} — {telephone_lisible(numero or '') or 'numéro masqué'}"]
    details = [CATEGORIES.get(fiche.get("categorie", ""), "")]
    if fiche.get("soin_evoque"):
        details.append(f"soin : {fiche['soin_evoque']}")
    if any(details):
        lignes.append(" · ".join(d for d in details if d))
    if fiche.get("resume"):
        lignes.append(fiche["resume"])
    if fiche.get("prochaine_action"):
        lignes.append(f"➡️ {fiche['prochaine_action']}")
    return "\n".join(lignes)

