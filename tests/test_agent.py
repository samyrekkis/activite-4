import json
from datetime import datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.db import Database
from app.main import create_app
from app.prompts import system_prompt
from app.scheduling import Planning, normaliser_telephone, telephone_lisible
from app.tenants import TenantRegistry
from app.tools import ContexteAppel, executer
from app.vapi import build_assistant

ROOT = Path(__file__).resolve().parent.parent
# Jeudi 15 octobre 2026, 10h00 heure d'Alger.
MAINTENANT = datetime(2026, 10, 15, 10, 0)


@pytest.fixture(autouse=True)
def horloge_fixe(monkeypatch):
    monkeypatch.setattr(Planning, "maintenant", lambda self: MAINTENANT)


@pytest.fixture
def registry():
    return TenantRegistry(ROOT / "clients", ROOT / "niches")


@pytest.fixture
def ctx(registry):
    return ContexteAppel(
        tenant=registry.get("dentaire-exemple"),
        db=Database(":memory:"),
        call_id="call-1",
        numero_appelant="+213550123456",
    )


def test_toutes_les_niches_se_chargent(tmp_path, registry):
    for niche in (ROOT / "niches").glob("*.json"):
        (tmp_path / f"{niche.stem}.json").write_text(json.dumps({"id": niche.stem, "niche": niche.stem, "nom": "Test"}))
    reg = TenantRegistry(tmp_path, ROOT / "niches")
    for t in reg.all():
        assert t.services and t.horaires
        assert build_assistant(t, "https://exemple.dz")["model"]["tools"]


def test_telephone():
    assert normaliser_telephone("0550 12 34 56") == "+213550123456"
    assert normaliser_telephone("00213 550123456") == "+213550123456"
    assert normaliser_telephone("213550123456") == "+213550123456"
    assert normaliser_telephone("021 23 45 67") == "+21321234567"
    assert normaliser_telephone("+33612345678") == "+33612345678"
    assert telephone_lisible("+213550123456") == "0550 12 34 56"


def test_disponibilites_respectent_horaires_et_delai(ctx):
    r = executer(ctx, "verifier_disponibilites", {"service": "consultation", "date": "2026-10-15"})
    assert r["creneaux"]
    premier = r["creneaux"][0]["debut"]
    # Délai minimum de 60 min : pas avant 11h00 aujourd'hui.
    assert premier >= "2026-10-15T11:00"
    # Le jeudi ferme à 12h30 : un créneau de 30 min commence au plus tard à 12h00.
    assert all(not c["debut"].startswith("2026-10-15") or c["debut"] <= "2026-10-15T12:00" for c in r["creneaux"])
    # Le vendredi est fermé.
    assert not any(c["debut"].startswith("2026-10-16") for c in r["creneaux"])
    assert "jeudi 15 octobre 2026" in r["aujourd_hui"]


def test_vendredi_ferme_renvoie_remarque(ctx):
    r = executer(ctx, "verifier_disponibilites", {"service": "consultation", "date": "2026-10-16"})
    assert "fermé" in r["remarque"]
    assert r["creneaux"][0]["debut"].startswith("2026-10-17")


def test_moment_et_heure_souhaitee(ctx):
    r = executer(ctx, "verifier_disponibilites", {"service": "consultation", "date": "2026-10-18", "moment": "apres-midi"})
    assert all("T14" <= c["debut"][10:13] for c in r["creneaux"])
    r = executer(ctx, "verifier_disponibilites", {"service": "consultation", "date": "2026-10-18", "heure_souhaitee": "15h30"})
    assert any(c["debut"] == "2026-10-18T15:30" for c in r["creneaux"])


def test_reservation_puis_double_reservation_refusee(ctx):
    ok = executer(ctx, "prendre_rendez_vous", {"nom": "Karim Haddad", "service": "consultation", "debut": "2026-10-18T09:00"})
    assert ok["succes"] and ok["reference"]
    assert "0550 12 34 56" in ok["recapitulatif"]  # numéro de l'appelant par défaut
    assert ctx.evenements and ctx.evenements[0].type == "rdv_cree"

    # Chevauchement (09:15 tombe dans 09:00-09:30) avec capacité 1.
    ko = executer(ctx, "prendre_rendez_vous", {"nom": "Autre", "telephone": "0661000000", "service": "consultation", "debut": "2026-10-18T09:15"})
    assert ko["succes"] is False and ko["alternatives"]
    dispo = executer(ctx, "verifier_disponibilites", {"service": "consultation", "date": "2026-10-18", "heure_souhaitee": "09:00"})
    assert all(c["debut"] not in ("2026-10-18T09:00", "2026-10-18T09:15") for c in dispo["creneaux"])


def test_reservation_hors_horaires_refusee(ctx):
    r = executer(ctx, "prendre_rendez_vous", {"nom": "X", "service": "consultation", "debut": "2026-10-16T10:00"})
    assert r["succes"] is False


def test_chercher_deplacer_annuler(ctx):
    rid = executer(ctx, "prendre_rendez_vous", {"nom": "Sara B", "service": "detartrage", "debut": "2026-10-19T10:00"})["reference"]
    trouve = executer(ctx, "chercher_rendez_vous", {})
    assert trouve["rendez_vous"][0]["id"] == rid

    dep = executer(ctx, "deplacer_rendez_vous", {"rendez_vous_id": rid, "nouveau_debut": "2026-10-19T10:15"})
    assert dep["succes"], dep  # chevauche l'ancien créneau du même RDV : autorisé

    # Un autre numéro ne peut pas annuler ce RDV.
    autre = ContexteAppel(tenant=ctx.tenant, db=ctx.db, numero_appelant="+213770000000")
    assert "erreur" in executer(autre, "annuler_rendez_vous", {"rendez_vous_id": rid})

    ann = executer(ctx, "annuler_rendez_vous", {"rendez_vous_id": rid})
    assert ann["succes"]
    assert executer(ctx, "chercher_rendez_vous", {})["rendez_vous"] == []


def test_message_et_erreurs(ctx):
    assert "erreur" in executer(ctx, "laisser_message", {"nom": "A"})
    r = executer(ctx, "laisser_message", {"nom": "A", "motif": "Dent cassée, très mal", "urgent": True})
    assert r["succes"] and ctx.evenements[-1].urgent
    assert "erreur" in executer(ctx, "outil_inexistant", {})
    sans_num = ContexteAppel(tenant=ctx.tenant, db=ctx.db)
    assert "erreur" in executer(sans_num, "prendre_rendez_vous", {"nom": "A", "service": "soin", "debut": "2026-10-18T09:00"})


def test_prompt_contient_l_essentiel(registry):
    p = system_prompt(registry.get("dentaire-exemple"), MAINTENANT)
    for attendu in ("darija", "Cabinet Dentaire Dr Benali", "vendredi : fermé", "Détartrage", "N'invente JAMAIS", "14"):
        assert attendu in p


@pytest.fixture
def client(tmp_path):
    settings = Settings(
        public_base_url="https://agent.exemple.dz", vapi_api_key="", vapi_webhook_secret="s3cret",
        telegram_bot_token="", admin_token="admin", database_path=tmp_path / "t.db",
        clients_dir=ROOT / "clients", niches_dir=ROOT / "niches",
    )
    return TestClient(create_app(settings))


H = {"x-vapi-secret": "s3cret"}


def test_webhook_secret_obligatoire(client):
    assert client.post("/vapi/webhook", json={"message": {"type": "status-update"}}).status_code == 401


def test_webhook_assistant_request(client, monkeypatch):
    t = client.app.state.registry.get("dentaire-exemple")
    monkeypatch.setitem(t.raw, "vapi_phone_number_id", "pn_1")
    r = client.post("/vapi/webhook", headers=H, json={"message": {"type": "assistant-request", "phoneNumber": {"id": "pn_1"}}})
    a = r.json()["assistant"]
    assert a["server"]["url"].endswith("?tenant=dentaire-exemple")
    noms = [tl.get("function", {}).get("name") or tl["type"] for tl in a["model"]["tools"]]
    assert "prendre_rendez_vous" in noms and "transferCall" in noms and "endCall" in noms


def test_webhook_tool_calls_et_fin_appel(client):
    msg = {"message": {
        "type": "tool-calls",
        "call": {"id": "c1", "customer": {"number": "+213550123456"}},
        "toolCallList": [{"id": "tc1", "type": "function", "function": {
            "name": "prendre_rendez_vous",
            "arguments": json.dumps({"nom": "Test", "service": "consultation", "debut": "2026-10-18T09:00"})}}],
    }}
    r = client.post("/vapi/webhook?tenant=dentaire-exemple", headers=H, json=msg).json()
    assert r["results"][0]["toolCallId"] == "tc1"
    assert json.loads(r["results"][0]["result"])["succes"] is True

    fin = {"message": {"type": "end-of-call-report", "call": {"id": "c1", "customer": {"number": "+213550123456"}},
                       "durationSeconds": 95, "cost": 0.21, "endedReason": "customer-ended-call",
                       "analysis": {"summary": "RDV pris pour Test."}, "artifact": {"transcript": "...", "recordingUrl": "https://r"}}}
    assert client.post("/vapi/webhook?tenant=dentaire-exemple", headers=H, json=fin).status_code == 200

    assert client.get("/dashboard/dentaire-exemple?key=mauvaise").status_code == 403
    page = client.get("/dashboard/dentaire-exemple?key=admin")
    assert page.status_code == 200 and "RDV pris pour Test." in page.text and "Test" in page.text
    stats = client.get("/api/dentaire-exemple/stats?key=admin").json()
    assert stats["rdv_pris_par_agent"] == 1 and stats["appels"] == 1 and stats["valeur_estimee_da"] == 3000
    csv_txt = client.get("/dashboard/dentaire-exemple/export.csv?key=admin").text
    assert "consultation" in csv_txt.lower()


def test_dashboard_ajout_rdv_bloque_le_creneau(client):
    r = client.post("/dashboard/dentaire-exemple/rdv?key=admin",
                    data={"nom": "Bloqué", "service": "consultation", "date": "2026-10-18", "heure": "09:00", "duree": "120"},
                    follow_redirects=False)
    assert r.status_code == 303
    msg = {"message": {"type": "tool-calls", "call": {"id": "c2"},
                       "toolCallList": [{"id": "t", "function": {"name": "verifier_disponibilites",
                                                                 "arguments": {"service": "consultation", "date": "2026-10-18"}}}]}}
    res = json.loads(client.post("/vapi/webhook?tenant=dentaire-exemple", headers=H, json=msg).json()["results"][0]["result"])
    jour = [c["debut"] for c in res["creneaux"] if c["debut"].startswith("2026-10-18")]
    assert jour and all(d >= "2026-10-18T11:00" for d in jour)
