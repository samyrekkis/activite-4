"""Serveur HTTP : webhook Vapi, tableau de bord des cabinets, API.

Lancement : uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import csv
import hmac
import io
import json
import logging
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import parse_qs

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse, RedirectResponse

from . import dashboard, notify, vapi
from .config import Settings, load_settings
from .db import Database
from .scheduling import FORMAT, normaliser_telephone
from .tenants import Tenant, TenantRegistry
from .tools import ContexteAppel, executer

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("agent")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    db = Database(settings.database_path)
    registry = TenantRegistry(settings.clients_dir, settings.niches_dir)
    app = FastAPI(title="Agent vocal IA — cabinets", docs_url=None, redoc_url=None)
    app.state.db = db
    app.state.registry = registry
    app.state.settings = settings

    # ------------------------------------------------------------------ utilitaires
    def verifier_secret(request: Request) -> None:
        if not settings.vapi_webhook_secret:
            return
        recu = request.headers.get("x-vapi-secret", "")
        if not hmac.compare_digest(recu, settings.vapi_webhook_secret):
            raise HTTPException(401, "secret invalide")

    def resoudre_tenant(request: Request, message: dict[str, Any]) -> Tenant | None:
        t = registry.get(request.query_params.get("tenant"))
        if t:
            return t
        for source in (message.get("assistant") or {}, (message.get("call") or {}).get("assistant") or {}):
            t = registry.get((source.get("metadata") or {}).get("tenant"))
            if t:
                return t
        phone = message.get("phoneNumber") or {}
        call = message.get("call") or {}
        return registry.by_phone(phone.get("id") or call.get("phoneNumberId"), phone.get("number"))

    def auth_dashboard(tenant_id: str, key: str | None) -> Tenant:
        t = registry.get(tenant_id)
        if t is None:
            raise HTTPException(404, "client inconnu")
        cles = [c for c in (t.raw.get("dashboard_key"), settings.admin_token) if c]
        if not key or not any(hmac.compare_digest(key, c) for c in cles):
            raise HTTPException(403, "clé invalide")
        return t

    # ------------------------------------------------------------------ santé
    @app.get("/health")
    def health() -> dict[str, Any]:
        return {"ok": True, "clients": [t.id for t in registry.all()]}

    # ------------------------------------------------------------------ webhook Vapi
    @app.post("/vapi/webhook")
    async def webhook(request: Request, background: BackgroundTasks) -> JSONResponse:
        verifier_secret(request)
        body = await request.json()
        message = body.get("message") or {}
        type_ = message.get("type")
        tenant = resoudre_tenant(request, message)

        if type_ == "assistant-request":
            if tenant is None:
                log.error("assistant-request sans client correspondant: %s", json.dumps(message.get("phoneNumber")))
                return JSONResponse({"error": "Numéro non configuré."})
            return JSONResponse({"assistant": vapi.build_assistant(
                tenant, settings.public_base_url, settings.vapi_webhook_secret)})

        if tenant is None:
            log.warning("Webhook %s ignoré : client introuvable", type_)
            return JSONResponse({})

        call = message.get("call") or {}
        ctx = ContexteAppel(
            tenant=tenant, db=db, call_id=call.get("id"),
            numero_appelant=vapi.numero_appelant(message),
        )

        if type_ == "tool-calls":
            results = []
            for tool_call_id, nom, args in vapi.extraire_appels_outils(message):
                resultat = executer(ctx, nom, args)
                log.info("[%s] outil %s %s -> %s", tenant.id, nom, args, resultat)
                results.append({"toolCallId": tool_call_id, "name": nom,
                                "result": json.dumps(resultat, ensure_ascii=False)})
            background.add_task(notify.envoyer, tenant, ctx.evenements, settings.telegram_bot_token)
            return JSONResponse({"results": results})

        if type_ == "function-call":  # ancien format Vapi
            fc = message.get("functionCall") or {}
            resultat = executer(ctx, fc.get("name", ""), vapi.parse_arguments(fc.get("parameters")))
            background.add_task(notify.envoyer, tenant, ctx.evenements, settings.telegram_bot_token)
            return JSONResponse({"result": json.dumps(resultat, ensure_ascii=False)})

        if type_ == "end-of-call-report":
            enregistrer_appel(db, tenant, message, ctx.numero_appelant)
            return JSONResponse({})

        return JSONResponse({})

    # ------------------------------------------------------------------ tableau de bord
    @app.get("/dashboard/{tenant_id}", response_class=HTMLResponse)
    def page_dashboard(tenant_id: str, key: str | None = None) -> str:
        t = auth_dashboard(tenant_id, key)
        return dashboard.page(db, t, key or "")

    @app.post("/dashboard/{tenant_id}/rdv")
    async def ajouter_rdv(tenant_id: str, request: Request, key: str | None = None) -> RedirectResponse:
        """RDV pris directement au cabinet, ou créneau bloqué (absence, pause)."""
        t = auth_dashboard(tenant_id, key)
        form = parse_qs((await request.body()).decode("utf-8"))
        champ = lambda nom: (form.get(nom) or [""])[0].strip()  # noqa: E731
        service = t.service(champ("service"))
        try:
            debut = datetime.strptime(f"{champ('date')}T{champ('heure')[:5]}", FORMAT)
            duree = int(champ("duree") or service.duree)
        except ValueError:
            raise HTTPException(400, "date, heure ou durée invalide")
        db.execute(
            "INSERT INTO rendez_vous (tenant, nom, telephone, service, debut, fin, source) "
            "VALUES (?, ?, ?, ?, ?, ?, 'cabinet')",
            (t.id, champ("nom") or "Bloqué", normaliser_telephone(champ("telephone")), service.nom,
             debut.strftime(FORMAT), (debut + timedelta(minutes=duree)).strftime(FORMAT)),
        )
        return RedirectResponse(f"/dashboard/{t.id}?key={key}", status_code=303)

    @app.post("/dashboard/{tenant_id}/rdv/{rdv_id}/annuler")
    def annuler(tenant_id: str, rdv_id: int, key: str | None = None) -> RedirectResponse:
        t = auth_dashboard(tenant_id, key)
        db.execute("UPDATE rendez_vous SET statut='annule', modifie_le=datetime('now') "
                   "WHERE id=? AND tenant=?", (rdv_id, t.id))
        return RedirectResponse(f"/dashboard/{t.id}?key={key}", status_code=303)

    @app.post("/dashboard/{tenant_id}/message/{msg_id}/traite")
    def message_traite(tenant_id: str, msg_id: int, key: str | None = None) -> RedirectResponse:
        t = auth_dashboard(tenant_id, key)
        db.execute("UPDATE messages SET traite=1 WHERE id=? AND tenant=?", (msg_id, t.id))
        return RedirectResponse(f"/dashboard/{t.id}?key={key}", status_code=303)

    @app.get("/dashboard/{tenant_id}/export.csv")
    def export_csv(tenant_id: str, key: str | None = None) -> PlainTextResponse:
        t = auth_dashboard(tenant_id, key)
        rows = db.query("SELECT id, nom, telephone, service, debut, fin, statut, notes, cree_le "
                        "FROM rendez_vous WHERE tenant=? ORDER BY debut", (t.id,))
        buf = io.StringIO()
        w = csv.writer(buf, delimiter=";")
        w.writerow(["id", "nom", "telephone", "service", "debut", "fin", "statut", "notes", "cree_le"])
        for r in rows:
            w.writerow(list(r))
        return PlainTextResponse(
            "﻿" + buf.getvalue(), media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="rdv-{t.id}.csv"'},
        )

    @app.get("/api/{tenant_id}/stats")
    def api_stats(tenant_id: str, key: str | None = None, mois: str | None = None) -> dict[str, Any]:
        t = auth_dashboard(tenant_id, key)
        return dashboard.stats(db, t, mois)

    @app.post("/admin/reload")
    def reload(key: str | None = None) -> dict[str, Any]:
        if not settings.admin_token or not key or not hmac.compare_digest(key, settings.admin_token):
            raise HTTPException(403, "clé invalide")
        registry.reload()
        return {"ok": True, "clients": [t.id for t in registry.all()]}

    return app


def enregistrer_appel(db: Database, t: Tenant, message: dict[str, Any], numero: str | None) -> None:
    call = message.get("call") or {}
    artifact = message.get("artifact") or {}
    analysis = message.get("analysis") or {}
    duree = message.get("durationSeconds")
    if duree is None and message.get("durationMs") is not None:
        duree = message["durationMs"] / 1000
    db.execute(
        "INSERT OR REPLACE INTO appels (call_id, tenant, numero, debut, fin, duree_s, cout, raison_fin, "
        "resume, transcript, enregistrement_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            call.get("id"), t.id, numero,
            message.get("startedAt"), message.get("endedAt"),
            duree, message.get("cost"), message.get("endedReason"),
            analysis.get("summary") or message.get("summary"),
            artifact.get("transcript") or message.get("transcript"),
            artifact.get("recordingUrl") or message.get("recordingUrl"),
        ),
    )

