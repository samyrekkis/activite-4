"""Serveur HTTP : webhook Vapi, tableau de bord des cabinets, API.

Lancement : uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import asyncio
import csv
import hmac
import io
import json
import logging
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import parse_qs

from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse, RedirectResponse

import threading
from datetime import timezone

from . import dashboard, notify, vapi, whatsapp
from .chat import AgentTexte
from .notify import texte_fiche
from .config import Settings, load_settings
from .db import Database
from .relances import Relanceur, envoyeur_whatsapp, lanceur_vapi
from .scheduling import FORMAT, Planning, libelle_creneau, normaliser_telephone, parse_local
from .tenants import Tenant, TenantRegistry
from .tools import ContexteAppel, Evenement, evenement_creneau_libere, executer

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("agent")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    db = Database(settings.database_path)
    registry = TenantRegistry(settings.clients_dir, settings.niches_dir)
    wa = whatsapp.ClientWhatsApp(settings.whatsapp_token, settings.whatsapp_api_version) \
        if settings.whatsapp_token else None
    relanceur = Relanceur(db, settings.public_base_url, settings.vapi_webhook_secret,
                          lanceur_vapi(settings.vapi_api_key) if settings.vapi_api_key else None,
                          envoyeur_whatsapp(wa) if wa else None)
    agent_texte = AgentTexte(db, settings.modele_chat, settings.effort_chat)
    verrous: dict[tuple[str, str], threading.Lock] = {}
    verrous_lock = threading.Lock()

    def verrou(cle: tuple[str, str]) -> threading.Lock:
        """Un message à la fois par conversation : deux messages rapprochés sont traités dans l'ordre."""
        with verrous_lock:
            return verrous.setdefault(cle, threading.Lock())

    def maintenant(t: Tenant) -> datetime:
        return Planning(t, db).maintenant()

    async def notifier(t: Tenant, evenements: list[Evenement]) -> None:
        await notify.envoyer(t, [e for e in evenements if e.texte], settings.telegram_bot_token)

    def traiter_liberations(t: Tenant, evenements: list[Evenement]) -> list[Evenement]:
        """Créneaux libérés pendant l'appel -> liste d'attente (notification, appel automatique)."""
        sortie: list[Evenement] = []
        for ev in evenements:
            if ev.type == "creneau_libere" and not ev.texte:
                sortie += relanceur.creneau_libere(t, ev.data["debut"], ev.data["service"], maintenant(t))
        return sortie

    def fiches_whatsapp(t: Tenant) -> list[Evenement]:
        """Fiche prospect envoyée 30 min après le dernier message d'une conversation WhatsApp."""
        evs = []
        for conv in agent_texte.conversations_a_ficher(t, datetime.now(timezone.utc).replace(tzinfo=None)):
            db.execute("UPDATE wa_conversations SET fiche_envoyee=1 WHERE id=?", (conv["id"],))
            if not t.get("fiche_appel", True):
                continue
            try:
                fiche = agent_texte.fiche(conv)
            except Exception:  # noqa: BLE001
                log.exception("[%s] fiche WhatsApp impossible", t.id)
                continue
            if fiche:
                db.execute("UPDATE wa_conversations SET fiche=? WHERE id=?",
                           (json.dumps(fiche, ensure_ascii=False), conv["id"]))
                evs.append(Evenement("fiche", texte_fiche(fiche, conv["telephone"], "whatsapp", conv["source"]), fiche))
        return evs

    def tick_relances() -> list[tuple[Tenant, list[Evenement]]]:
        resultats = []
        for t in registry.all():
            evs: list[Evenement] = []
            try:
                evs += relanceur.lancer_relances(t, maintenant(t))
                if (t.raw.get("whatsapp") or {}).get("phone_number_id"):
                    evs += fiches_whatsapp(t)
            except Exception:  # noqa: BLE001
                log.exception("[%s] erreur pendant les tâches planifiées", t.id)
            if evs:
                resultats.append((t, evs))
        return resultats

    async def boucle_relances() -> None:
        while True:
            for t, evs in await asyncio.to_thread(tick_relances):
                await notifier(t, evs)
            await asyncio.sleep(300)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        planifie = relanceur.lanceur or relanceur.whatsapp or any(
            (t.raw.get("whatsapp") or {}).get("phone_number_id") for t in registry.all())
        tache = asyncio.create_task(boucle_relances()) if planifie else None
        yield
        if tache:
            tache.cancel()

    app = FastAPI(title="Agent vocal IA — cabinets", docs_url=None, redoc_url=None, lifespan=lifespan)
    app.state.db = db
    app.state.registry = registry
    app.state.settings = settings
    app.state.relanceur = relanceur

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
        q = request.query_params
        mode = q.get("mode") if q.get("mode") in ("relance", "offre") else "entrant"
        ctx = ContexteAppel(
            tenant=tenant, db=db, call_id=call.get("id"),
            numero_appelant=vapi.numero_appelant(message), mode=mode,
            rdv_id=int(q["rdv"]) if q.get("rdv", "").isdigit() else None,
            attente_id=int(q["attente"]) if q.get("attente", "").isdigit() else None,
        )

        async def apres_outils() -> None:
            liberations = await asyncio.to_thread(traiter_liberations, tenant, ctx.evenements)
            await notifier(tenant, ctx.evenements + liberations)

        if type_ == "tool-calls":
            results = []
            for tool_call_id, nom, args in vapi.extraire_appels_outils(message):
                resultat = await run_in_threadpool(executer, ctx, nom, args)
                log.info("[%s/%s] outil %s %s -> %s", tenant.id, mode, nom, args, resultat)
                results.append({"toolCallId": tool_call_id, "name": nom,
                                "result": json.dumps(resultat, ensure_ascii=False)})
            background.add_task(apres_outils)
            return JSONResponse({"results": results})

        if type_ == "function-call":  # ancien format Vapi
            fc = message.get("functionCall") or {}
            resultat = await run_in_threadpool(
                executer, ctx, fc.get("name", ""), vapi.parse_arguments(fc.get("parameters")))
            background.add_task(apres_outils)
            return JSONResponse({"result": json.dumps(resultat, ensure_ascii=False)})

        if type_ == "end-of-call-report":
            fiche = enregistrer_appel(db, tenant, message, ctx.numero_appelant, mode)
            evenements: list[Evenement] = []
            if mode == "relance" and ctx.rdv_id:
                evenements = await asyncio.to_thread(
                    relanceur.fin_relance, tenant, ctx.rdv_id, message.get("endedReason"))
            elif mode == "offre" and ctx.attente_id:
                evenements = await asyncio.to_thread(relanceur.fin_offre, tenant, ctx.attente_id, maintenant(tenant))
            elif fiche is not None and tenant.get("fiche_appel", True):
                evenements = [Evenement("fiche", texte_fiche(fiche, ctx.numero_appelant), fiche)]
            background.add_task(notifier, tenant, evenements)
            return JSONResponse({})

        return JSONResponse({})

    # ------------------------------------------------------------------ WhatsApp
    def traiter_whatsapp(recu: whatsapp.MessageRecu) -> tuple[Tenant | None, list[Evenement]]:
        t = registry.by_whatsapp(recu.phone_number_id)
        if t is None:
            log.warning("Message WhatsApp pour un numéro non configuré : %s", recu.phone_number_id)
            return None, []
        if db.query("SELECT 1 FROM wa_vus WHERE message_id=?", (recu.message_id,)):
            return None, []  # déjà traité (Meta renvoie parfois le même message)
        db.execute("INSERT OR IGNORE INTO wa_vus (message_id) VALUES (?)", (recu.message_id,))
        telephone = normaliser_telephone("+" + recu.expediteur)
        with verrou((t.id, telephone)):
            if wa:
                wa.marquer_lu(recu.phone_number_id, recu.message_id)
            now, now_utc = maintenant(t), datetime.now(timezone.utc).replace(tzinfo=None)
            reponse, evenements = None, []
            if recu.bouton.startswith("rdv:"):
                reponse, evenements = bouton_rappel(t, recu, telephone, now, now_utc)
            if reponse is None:
                reponse, evenements = agent_texte.repondre(t, recu, now, now_utc)
            if reponse and wa:
                try:
                    wa.envoyer_texte(recu.phone_number_id, recu.expediteur, reponse)
                except Exception:  # noqa: BLE001
                    log.exception("[%s] envoi WhatsApp impossible", t.id)
            return t, evenements + traiter_liberations(t, evenements)

    def bouton_rappel(t: Tenant, recu: whatsapp.MessageRecu, telephone: str, now: datetime,
                      now_utc: datetime) -> tuple[str | None, list[Evenement]]:
        """Boutons du rappel WhatsApp : « Je confirme » / « Changer » / « Annuler »."""
        _, rdv_id, action = (recu.bouton.split(":") + ["", ""])[:3]
        rows = db.query("SELECT * FROM rendez_vous WHERE id=? AND tenant=? AND statut='confirme'",
                        (int(rdv_id) if rdv_id.isdigit() else -1, t.id))
        if not rows or rows[0]["telephone"] != telephone or action == "changer":
            if action == "changer" and rows:
                recu.texte = f"Je voudrais changer mon rendez-vous du {libelle_creneau(parse_local(rows[0]['debut']))}."
            return None, []  # l'IA prend le relais
        r = rows[0]
        ctx = ContexteAppel(tenant=t, db=db, numero_appelant=telephone, mode="relance", rdv_id=r["id"])
        libelle = libelle_creneau(parse_local(r["debut"]))
        if action == "confirmer":
            executer(ctx, "confirmer_presence", {})
            reponse = f"Merci {r['nom']} ✅ Votre rendez-vous du {libelle} est confirmé. À bientôt !"
        elif action == "annuler":
            executer(ctx, "annuler_rendez_vous", {"motif": "annulé depuis le rappel WhatsApp"})
            reponse = (f"C'est noté, votre rendez-vous du {libelle} est annulé. Merci d'avoir prévenu 🙏 "
                       "Écrivez-nous quand vous voulez reprendre rendez-vous.")
        else:
            return None, []
        conv = agent_texte.conversation(t, telephone, now_utc)
        agent_texte.ajouter_echange(conv["id"], recu.texte or action, reponse, now)
        return reponse, ctx.evenements

    @app.get("/whatsapp/webhook", response_class=PlainTextResponse)
    def whatsapp_verification(request: Request) -> str:
        """Vérification du webhook par Meta (une seule fois, à la configuration)."""
        q = request.query_params
        if (q.get("hub.mode") == "subscribe" and settings.whatsapp_verify_token
                and hmac.compare_digest(q.get("hub.verify_token", ""), settings.whatsapp_verify_token)):
            return q.get("hub.challenge", "")
        raise HTTPException(403, "jeton de vérification invalide")

    @app.post("/whatsapp/webhook")
    async def whatsapp_webhook(request: Request, background: BackgroundTasks) -> JSONResponse:
        corps = await request.body()
        if not whatsapp.signature_valide(corps, request.headers.get("x-hub-signature-256"),
                                         settings.whatsapp_app_secret):
            raise HTTPException(401, "signature invalide")
        recus = whatsapp.extraire_messages(json.loads(corps or b"{}"))

        async def traiter() -> None:
            for recu in recus:
                t, evenements = await asyncio.to_thread(traiter_whatsapp, recu)
                if t is not None:
                    await notifier(t, evenements)
        # Réponse immédiate à Meta ; l'IA travaille en arrière-plan.
        background.add_task(traiter)
        return JSONResponse({"ok": True})

    app.state.traiter_whatsapp = traiter_whatsapp

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
    async def annuler(tenant_id: str, rdv_id: int, background: BackgroundTasks,
                      key: str | None = None) -> RedirectResponse:
        t = auth_dashboard(tenant_id, key)
        rows = db.query("SELECT * FROM rendez_vous WHERE id=? AND tenant=? AND statut='confirme'", (rdv_id, t.id))
        if rows:
            r = rows[0]
            db.execute("UPDATE rendez_vous SET statut='annule', modifie_le=datetime('now') WHERE id=?", (rdv_id,))
            ctx = ContexteAppel(tenant=t, db=db)
            if r["external_id"]:
                await run_in_threadpool(ctx.synchroniser, "annuler", r["external_id"])
            ctx.evenements.append(evenement_creneau_libere(dict(r)))

            async def suite() -> None:
                liberations = await asyncio.to_thread(traiter_liberations, t, ctx.evenements)
                await notifier(t, ctx.evenements + liberations)
            background.add_task(suite)
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


def enregistrer_appel(db: Database, t: Tenant, message: dict[str, Any], numero: str | None,
                      mode: str = "entrant") -> dict[str, Any] | None:
    """Archive l'appel ; renvoie la fiche d'appel (score d'intérêt…) si Vapi l'a produite."""
    call = message.get("call") or {}
    artifact = message.get("artifact") or {}
    analysis = message.get("analysis") or {}
    data = analysis.get("structuredData") or {}
    questions = [q for q in (data.get("questions_sans_reponse") or []) if isinstance(q, str) and q.strip()]
    fiche = {k: data[k] for k in ("nom_appelant", "score_interet", "categorie", "soin_evoque", "prochaine_action")
             if data.get(k) not in (None, "")}
    if "score_interet" in fiche:
        try:
            fiche["score_interet"] = max(0, min(100, int(fiche["score_interet"])))
        except (TypeError, ValueError):
            del fiche["score_interet"]
    duree = message.get("durationSeconds")
    if duree is None and message.get("durationMs") is not None:
        duree = message["durationMs"] / 1000
    db.execute(
        "INSERT OR REPLACE INTO appels (call_id, tenant, numero, debut, fin, duree_s, cout, raison_fin, "
        "resume, transcript, enregistrement_url, questions_sans_reponse, fiche, mode) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            call.get("id"), t.id, numero,
            message.get("startedAt"), message.get("endedAt"),
            duree, message.get("cost"), message.get("endedReason"),
            analysis.get("summary") or message.get("summary"),
            artifact.get("transcript") or message.get("transcript"),
            artifact.get("recordingUrl") or message.get("recordingUrl"),
            json.dumps(questions, ensure_ascii=False) if questions else None,
            json.dumps(fiche, ensure_ascii=False) if fiche else None,
            mode,
        ),
    )
    if not fiche:
        return None
    fiche["resume"] = analysis.get("summary") or message.get("summary") or ""
    return fiche
