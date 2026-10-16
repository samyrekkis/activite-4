"""Notifications au cabinet : Telegram (gratuit, très utilisé en Algérie) et webhook générique.

Le webhook générique permet de brancher n8n / Make / Zapier pour synchroniser
Google Agenda, envoyer un SMS ou un message WhatsApp, etc.
Une notification qui échoue ne doit jamais faire échouer l'appel : on journalise.
"""
from __future__ import annotations

import logging

import httpx

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
