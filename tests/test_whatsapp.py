"""Chatbot WhatsApp : réception Meta, boucle IA + outils, boutons de rappel, fiche prospect."""
import hashlib
import hmac
import json
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.chat import AgentTexte
from app.config import Settings
from app.db import Database
from app.main import create_app
from app.relances import Relanceur
from app.scheduling import Planning
from app.tenants import TenantRegistry
from app.tools import ContexteAppel, executer
from app.whatsapp import extraire_messages, signature_valide

ROOT = Path(__file__).resolve().parent.parent
MAINTENANT = datetime(2026, 10, 15, 10, 0)


@pytest.fixture(autouse=True)
def horloge_fixe(monkeypatch):
    monkeypatch.setattr(Planning, "maintenant", lambda self: MAINTENANT)


# ------------------------------------------------------------------ fausse API Anthropic

class Bloc(SimpleNamespace):
    def model_dump(self, **_):
        return {k: v for k, v in vars(self).items() if v is not None}


def texte(t):
    return Bloc(type="text", text=t)


def outil(i, nom, entree):
    return Bloc(type="tool_use", id=i, name=nom, input=entree)


class FausseIA:
    """Rejoue des réponses préparées et garde les requêtes reçues."""

    def __init__(self, reponses):
        self.reponses = list(reponses)
        self.requetes = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kw):
        self.requetes.append(json.loads(json.dumps(kw, default=str)))
        contenu, stop = self.reponses.pop(0)
        return SimpleNamespace(content=contenu, stop_reason=stop)


def message_meta(texte_="Salam, nheb ndir rdv", de="213550123456", mid="wamid.1", pub=False, bouton=None):
    m = {"from": de, "id": mid, "timestamp": "1", "type": "text", "text": {"body": texte_}}
    if bouton:
        m = {"from": de, "id": mid, "type": "button", "button": {"text": "Je confirme", "payload": bouton}}
    if pub:
        m["referral"] = {"headline": "Détartrage à Hydra", "source_url": "https://fb.me/x", "ctwa_clid": "abc"}
    return {"entry": [{"changes": [{"value": {
        "metadata": {"phone_number_id": "PN1"},
        "contacts": [{"wa_id": de, "profile": {"name": "Karim"}}],
        "messages": [m]}}]}]}


@pytest.fixture
def tenant():
    t = TenantRegistry(ROOT / "clients", ROOT / "niches").get("dentaire-exemple")
    t.raw["whatsapp"] = {"phone_number_id": "PN1", "relance": True}
    return t


# ------------------------------------------------------------------ tests

def test_lecture_des_messages_meta_et_signature():
    recus = extraire_messages(message_meta(pub=True))
    assert recus[0].texte == "Salam, nheb ndir rdv" and recus[0].depuis_pub and recus[0].nom_profil == "Karim"
    corps = b'{"a":1}'
    sig = "sha256=" + hmac.new(b"secret", corps, hashlib.sha256).hexdigest()
    assert signature_valide(corps, sig, "secret") and not signature_valide(corps, "sha256=faux", "secret")


def test_conversation_prise_de_rdv_avec_outils(tenant):
    db = Database(":memory:")
    ia = FausseIA([
        ([outil("t1", "verifier_disponibilites", {"service": "detartrage"})], "tool_use"),
        ([texte("3 créneaux : 1️⃣ ...")], "end_turn"),
        ([outil("t2", "prendre_rendez_vous", {"nom": "Karim Haddad", "service": "detartrage", "debut": "2026-10-18T09:00"})], "tool_use"),
        ([texte("C'est réservé ✅")], "end_turn"),
    ])
    agent = AgentTexte(db, client=ia)
    recu = extraire_messages(message_meta(pub=True))[0]
    rep, evs = agent.repondre(tenant, recu, MAINTENANT, datetime(2026, 10, 15, 9, 0))
    assert rep.startswith("3 créneaux")
    premiere = ia.requetes[0]
    assert premiere["fallbacks"] == "default" and premiere["cache_control"] == {"type": "ephemeral"}
    assert "jeudi 15 octobre 2026" in premiere["messages"][0]["content"][0]["text"]
    assert "publicité « Détartrage à Hydra »" in premiere["messages"][0]["content"][0]["text"]
    assert "WhatsApp" in premiere["system"] and "Nous sommes le" not in premiere["system"]  # prompt stable (cache)

    recu2 = extraire_messages(message_meta("1", mid="wamid.2"))[0]
    rep, evs = agent.repondre(tenant, recu2, MAINTENANT, datetime(2026, 10, 15, 9, 1))
    assert rep == "C'est réservé ✅" and any(e.type == "rdv_cree" for e in evs)
    rdv = db.query("SELECT nom, telephone, service FROM rendez_vous")[0]
    assert (rdv["nom"], rdv["telephone"]) == ("Karim Haddad", "+213550123456")  # numéro WhatsApp par défaut
    # L'historique envoyé au 2e message contient bien le 1er échange (même conversation).
    assert len(ia.requetes[2]["messages"]) == 5
    conv = db.query("SELECT source, nb_messages FROM wa_conversations")[0]
    assert conv["source"] == "pub" and conv["nb_messages"] == 8


def test_erreur_ia_reponse_d_excuse_et_alerte(tenant):
    db = Database(":memory:")

    class EnPanne(FausseIA):
        def _create(self, **kw):
            raise RuntimeError("API indisponible")

    agent = AgentTexte(db, client=EnPanne([]))
    rep, evs = agent.repondre(tenant, extraire_messages(message_meta())[0], MAINTENANT, datetime(2026, 10, 15, 9))
    assert "cabinet" in rep and any(e.type == "alerte" for e in evs)
    hist = json.loads(db.query("SELECT messages FROM wa_conversations")[0]["messages"])
    assert hist[-1]["role"] == "assistant"  # historique valide pour le message suivant


def test_rappel_whatsapp_puis_appel_si_pas_de_reponse(tenant):
    db = Database(":memory:")
    tenant.raw["relance"] = {"actif": True, "heures_avant": 72}
    rid = executer(ContexteAppel(tenant=tenant, db=db, numero_appelant="+213550123456"), "prendre_rendez_vous",
                   {"nom": "Karim", "service": "consultation", "debut": "2026-10-18T09:00"})["reference"]
    envois, appels = [], []
    rel = Relanceur(db, "https://srv", "s", lambda t, n, nom, a: appels.append(n),
                    lambda t, n, rdv: envois.append((n, rdv["id"])))
    rel.lancer_relances(tenant, MAINTENANT)
    assert envois == [("+213550123456", rid)] and appels == []
    rel.lancer_relances(tenant, datetime(2026, 10, 15, 18, 0))  # 8 h plus tard : on attend encore
    assert appels == []
    rel.lancer_relances(tenant, datetime(2026, 10, 17, 9, 0))  # samedi, toujours sans réponse : appel vocal
    assert appels == ["+213550123456"]


def client_http(tmp_path, tenant_wa=True):
    settings = Settings(public_base_url="https://x", vapi_api_key="", vapi_webhook_secret="", telegram_bot_token="",
                        admin_token="admin", database_path=tmp_path / "t.db", clients_dir=ROOT / "clients",
                        niches_dir=ROOT / "niches", whatsapp_verify_token="verif", whatsapp_app_secret="")
    app = create_app(settings)
    app.state.registry.get("dentaire-exemple").raw["whatsapp"] = {"phone_number_id": "PN1"}
    return TestClient(app), app


def test_webhook_verification_et_bouton_confirmer(tmp_path):
    client, app = client_http(tmp_path)
    ok = client.get("/whatsapp/webhook", params={"hub.mode": "subscribe", "hub.verify_token": "verif", "hub.challenge": "42"})
    assert ok.text == "42"
    assert client.get("/whatsapp/webhook", params={"hub.mode": "subscribe", "hub.verify_token": "x"}).status_code == 403

    t = app.state.registry.get("dentaire-exemple")
    db = app.state.db
    rid = executer(ContexteAppel(tenant=t, db=db, numero_appelant="+213550123456"), "prendre_rendez_vous",
                   {"nom": "Karim", "service": "consultation", "debut": "2026-10-17T09:00"})["reference"]
    # Un clic sur « Je confirme » est traité sans IA, et une seule fois même si Meta renvoie le message.
    for _ in range(2):
        assert client.post("/whatsapp/webhook", json=message_meta(bouton=f"rdv:{rid}:confirmer", mid="wamid.9")).status_code == 200
    assert db.query("SELECT confirmation FROM rendez_vous WHERE id=?", (rid,))[0]["confirmation"] == "confirme"
    assert db.query("SELECT COUNT(*) n FROM wa_vus")[0]["n"] == 1
    page = client.get("/dashboard/dentaire-exemple?key=admin").text
    assert "Conversations WhatsApp" in page and "confirmé ✓" in page


def test_fiche_prospect_whatsapp(tenant):
    db = Database(":memory:")
    ia = FausseIA([([texte(json.dumps({"nom_appelant": "Karim", "score_interet": 72, "categorie": "devis_soin_important",
                                        "soin_evoque": "implant", "prochaine_action": "Rappeler pour devis",
                                        "resume": "Demande le prix d'un implant."}))], "end_turn")])
    agent = AgentTexte(db, client=ia)
    db.execute("INSERT INTO wa_conversations (tenant, telephone, messages, nb_messages, dernier_message) "
               "VALUES (?, ?, ?, 2, '2026-10-15 08:00:00')",
               (tenant.id, "+213550123456", json.dumps([
                   {"role": "user", "content": [{"type": "text", "text": "c'est combien un implant"}]},
                   {"role": "assistant", "content": [{"type": "text", "text": "Sur devis après consultation."}]}])))
    a_ficher = agent.conversations_a_ficher(tenant, datetime(2026, 10, 15, 9, 0))
    assert len(a_ficher) == 1
    fiche = agent.fiche(a_ficher[0])
    assert fiche["score_interet"] == 72
    req = ia.requetes[0]
    assert req["output_config"]["format"]["type"] == "json_schema"
    assert "Patient : c'est combien un implant" in req["messages"][0]["content"]
