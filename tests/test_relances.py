"""Agenda externe (CRM), relances de confirmation, liste d'attente et fiche d'appel."""
import json
from datetime import datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.agenda import Occupation
from app.config import Settings
from app.db import Database
from app.main import create_app, texte_fiche
from app.relances import Relanceur
from app.scheduling import Planning
from app.tenants import TenantRegistry
from app.tools import ContexteAppel, executer

ROOT = Path(__file__).resolve().parent.parent
MAINTENANT = datetime(2026, 10, 15, 10, 0)  # jeudi


@pytest.fixture(autouse=True)
def horloge_fixe(monkeypatch):
    monkeypatch.setattr(Planning, "maintenant", lambda self: MAINTENANT)


class AgendaFactice:
    def __init__(self, occupations=()):
        self.occ = list(occupations)
        self.actions = []

    def occupations(self, du, au):
        return self.occ

    def creer(self, rdv):
        self.actions.append(("creer", rdv["debut"]))
        return f"ext-{len(self.actions)}"

    def modifier(self, external_id, debut, fin):
        self.actions.append(("modifier", external_id, debut.strftime("%Y-%m-%dT%H:%M")))

    def annuler(self, external_id):
        self.actions.append(("annuler", external_id))


class LanceurFactice:
    def __init__(self):
        self.appels = []

    def __call__(self, t, numero, nom, assistant):
        self.appels.append((numero, assistant))
        return f"call-{len(self.appels)}"


@pytest.fixture
def tenant():
    t = TenantRegistry(ROOT / "clients", ROOT / "niches").get("dentaire-exemple")
    t.raw["relance"] = {"actif": True}
    t.raw["liste_attente"] = {"appel_auto": True}
    return t


@pytest.fixture
def db():
    return Database(":memory:")


def ctx(t, db, numero="+213550123456", **kw):
    return ContexteAppel(tenant=t, db=db, numero_appelant=numero, **kw)


def brancher_agenda(t, agenda):
    t._agenda, t._agenda_charge = agenda, True


# ------------------------------------------------------------------ agenda externe / CRM

def test_agenda_externe_bloque_les_creneaux_et_recoit_les_rdv(tenant, db):
    agenda = AgendaFactice([Occupation(datetime(2026, 10, 18, 9, 0), datetime(2026, 10, 18, 10, 0), "patient-papier")])
    brancher_agenda(tenant, agenda)
    c = ctx(tenant, db)
    dispo = executer(c, "verifier_disponibilites", {"service": "consultation", "date": "2026-10-18", "heure_souhaitee": "09:00"})
    debuts = [x["debut"] for x in dispo["creneaux"]]
    assert "2026-10-18T09:00" not in debuts and "2026-10-18T09:30" not in debuts

    r = executer(c, "prendre_rendez_vous", {"nom": "Karim", "service": "consultation", "debut": "2026-10-18T10:00"})
    assert r["succes"] and agenda.actions == [("creer", "2026-10-18T10:00")]
    assert db.query("SELECT external_id FROM rendez_vous")[0]["external_id"] == "ext-1"

    executer(c, "deplacer_rendez_vous", {"rendez_vous_id": r["reference"], "nouveau_debut": "2026-10-19T10:00"})
    executer(c, "annuler_rendez_vous", {"rendez_vous_id": r["reference"]})
    assert agenda.actions[1:] == [("modifier", "ext-1", "2026-10-19T10:00"), ("annuler", "ext-1")]


def test_agenda_en_panne_ne_bloque_pas_l_appel(tenant, db):
    class EnPanne(AgendaFactice):
        def occupations(self, du, au):
            raise RuntimeError("timeout")

        def creer(self, rdv):
            raise RuntimeError("timeout")

    brancher_agenda(tenant, EnPanne())
    c = ctx(tenant, db)
    r = executer(c, "prendre_rendez_vous", {"nom": "Karim", "service": "consultation", "debut": "2026-10-18T10:00"})
    assert r["succes"]
    assert any(e.type == "alerte" for e in c.evenements)  # le cabinet est prévenu


def test_sans_date_trois_creneaux_sur_trois_jours(tenant, db):
    r = executer(ctx(tenant, db), "verifier_disponibilites", {"service": "consultation"})
    jours = {x["debut"][:10] for x in r["creneaux"]}
    assert len(r["creneaux"]) == 3 and len(jours) == 3


# ------------------------------------------------------------------ relances

def rdv(t, db, debut="2026-10-17T09:00", numero="+213550123456", nom="Karim"):
    return executer(ctx(t, db, numero), "prendre_rendez_vous", {"nom": nom, "service": "consultation", "debut": debut})["reference"]


def test_relance_48h_avant_puis_injoignable(tenant, db):
    rid = rdv(tenant, db)
    rdv(tenant, db, debut="2026-10-25T09:00", numero="+213661000000")  # trop loin : pas de relance
    lanceur = LanceurFactice()
    rel = Relanceur(db, "https://srv", "s", lanceur)

    assert rel.lancer_relances(tenant, MAINTENANT) == []
    assert len(lanceur.appels) == 1
    numero, assistant = lanceur.appels[0]
    assert numero == "+213550123456"
    assert f"mode=relance&rdv={rid}" in assistant["server"]["url"]
    assert "confirmer_presence" in [x.get("function", {}).get("name") for x in assistant["model"]["tools"]]

    # Pas de réponse : nouvel essai seulement après l'intervalle (3 h).
    rel.fin_relance(tenant, rid, "customer-did-not-answer")
    assert rel.lancer_relances(tenant, MAINTENANT + timedelta(hours=1)) == []
    rel.lancer_relances(tenant, MAINTENANT + timedelta(hours=3))
    assert len(lanceur.appels) == 2
    evs = rel.fin_relance(tenant, rid, "voicemail")
    assert evs and "injoignable" in evs[0].texte
    assert db.query("SELECT confirmation FROM rendez_vous WHERE id=?", (rid,))[0]["confirmation"] == "injoignable"


def test_pas_de_relance_le_vendredi_ni_la_nuit(tenant, db):
    rdv(tenant, db)
    rel = Relanceur(db, "https://srv", "s", LanceurFactice())
    assert rel.relances_dues(tenant, datetime(2026, 10, 16, 11, 0)) == []  # vendredi
    assert rel.relances_dues(tenant, datetime(2026, 10, 15, 21, 0)) == []  # 21h


def test_appel_de_relance_confirme_et_ne_peut_rien_faire_d_autre(tenant, db):
    rid = rdv(tenant, db)
    c = ctx(tenant, db, numero="+213999999999", mode="relance", rdv_id=rid)
    assert "erreur" in executer(c, "prendre_rendez_vous", {"nom": "X", "service": "soin", "debut": "2026-10-18T09:00"})
    assert executer(c, "confirmer_presence", {})["succes"]
    assert db.query("SELECT confirmation FROM rendez_vous WHERE id=?", (rid,))[0]["confirmation"] == "confirme"


# ------------------------------------------------------------------ liste d'attente

def test_annulation_libere_le_creneau_pour_la_liste_d_attente(tenant, db):
    rid = rdv(tenant, db)
    executer(ctx(tenant, db, "+213770111111"), "inscrire_liste_attente",
             {"nom": "Amel", "service": "consultation", "preference": "le matin"})
    executer(ctx(tenant, db, "+213770222222"), "inscrire_liste_attente", {"nom": "Yacine", "service": "consultation"})

    c = ctx(tenant, db, mode="relance", rdv_id=rid)
    executer(c, "annuler_rendez_vous", {"motif": "voyage"})
    liberation = [e for e in c.evenements if e.type == "creneau_libere"][0]

    lanceur = LanceurFactice()
    rel = Relanceur(db, "https://srv", "s", lanceur)
    evs = rel.creneau_libere(tenant, liberation.data["debut"], liberation.data["service"], MAINTENANT)
    assert "Amel" in evs[0].texte and "Yacine" in evs[0].texte
    assert lanceur.appels[0][0] == "+213770111111"  # première inscrite appelée
    attente_id = int(lanceur.appels[0][1]["server"]["url"].split("attente=")[1])

    # Amel ne répond pas : on passe à Yacine, qui accepte.
    rel.fin_offre(tenant, attente_id, MAINTENANT)
    assert lanceur.appels[1][0] == "+213770222222"
    yacine = int(lanceur.appels[1][1]["server"]["url"].split("attente=")[1])
    r = executer(ctx(tenant, db, "+213770222222", mode="offre", attente_id=yacine), "accepter_creneau", {})
    assert r["succes"]
    nouveau = db.query("SELECT nom, debut FROM rendez_vous WHERE statut='confirme'")
    assert [(x["nom"], x["debut"]) for x in nouveau] == [("Yacine", "2026-10-17T09:00")]
    rel.fin_offre(tenant, yacine, MAINTENANT)
    assert len(lanceur.appels) == 2  # créneau pris : plus d'appel


# ------------------------------------------------------------------ fiche d'appel (Telegram)

def test_fiche_appel():
    texte = texte_fiche({"nom_appelant": "Karim Haddad", "score_interet": 85, "categorie": "devis_soin_important",
                         "soin_evoque": "implant", "prochaine_action": "Rappeler pour le devis", "resume": "Demande un implant."},
                        "+213550123456", {})
    assert "intérêt 85 % (🔥 chaud)" in texte and "0550 12 34 56" in texte and "➡️ Rappeler pour le devis" in texte


def test_webhook_fin_d_appel_enregistre_la_fiche(tmp_path):
    settings = Settings(public_base_url="https://x", vapi_api_key="", vapi_webhook_secret="", telegram_bot_token="",
                        admin_token="admin", database_path=tmp_path / "t.db",
                        clients_dir=ROOT / "clients", niches_dir=ROOT / "niches")
    client = TestClient(create_app(settings))
    fin = {"message": {"type": "end-of-call-report", "call": {"id": "c9", "customer": {"number": "+213550123456"}},
                       "durationSeconds": 60, "analysis": {"summary": "Demande de devis implant.",
                       "structuredData": {"score_interet": 85, "categorie": "devis_soin_important"}}}}
    assert client.post("/vapi/webhook?tenant=dentaire-exemple", json=fin).status_code == 200
    page = client.get("/dashboard/dentaire-exemple?key=admin").text
    assert "85 %" in page and "Liste d'attente" in page


# ------------------------------------------------------------------ connecteurs réels (API simulées)

def test_connecteur_http():
    import httpx
    from app.agenda import AgendaHTTP

    vus = []

    def repondre(req):
        vus.append((req.method, req.url.path, req.headers.get("authorization")))
        if req.url.path.endswith("/occupations"):
            return httpx.Response(200, json=[{"id": 7, "debut": "2026-10-18T09:00", "fin": "2026-10-18T09:30"}])
        if req.method == "POST":
            return httpx.Response(201, json={"id": "crm-42"})
        return httpx.Response(204)

    client = httpx.Client(transport=httpx.MockTransport(repondre), headers={"Authorization": "Bearer t"})
    a = AgendaHTTP("https://crm.dz/api", client=client)
    occ = a.occupations(datetime(2026, 10, 15).date(), datetime(2026, 10, 20).date())
    assert occ[0].debut == datetime(2026, 10, 18, 9, 0) and occ[0].id == "7"
    assert a.creer({"nom": "K", "debut": "2026-10-18T10:00"}) == "crm-42"
    a.modifier("crm-42", datetime(2026, 10, 19, 10), datetime(2026, 10, 19, 10, 30))
    a.annuler("crm-42")
    assert [v[:2] for v in vus] == [("GET", "/api/occupations"), ("POST", "/api/rendez-vous"),
                                    ("PATCH", "/api/rendez-vous/crm-42"), ("DELETE", "/api/rendez-vous/crm-42")]
    assert all(v[2] == "Bearer t" for v in vus)


def test_connecteur_google():
    import httpx
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from zoneinfo import ZoneInfo
    from app.agenda import AgendaGoogle

    cle = rsa.generate_private_key(public_exponent=65537, key_size=2048).private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()
    vus = []

    def repondre(req):
        vus.append((req.method, req.url.path))
        if req.url.host == "oauth2.googleapis.com":
            assert b"assertion=" in req.content
            return httpx.Response(200, json={"access_token": "tok", "expires_in": 3600})
        assert req.headers["authorization"] == "Bearer tok"
        if req.method == "GET":
            return httpx.Response(200, json={"items": [
                {"id": "a", "start": {"dateTime": "2026-10-18T09:00:00+01:00"}, "end": {"dateTime": "2026-10-18T10:00:00+01:00"}},
                {"id": "b", "start": {"date": "2026-10-20"}, "end": {"date": "2026-10-21"}},
                {"id": "c", "transparency": "transparent", "start": {"dateTime": "2026-10-18T12:00:00+01:00"},
                 "end": {"dateTime": "2026-10-18T13:00:00+01:00"}},
            ]})
        if req.method == "POST":
            return httpx.Response(200, json={"id": "evt1"})
        return httpx.Response(204)

    g = AgendaGoogle("cabinet@group.calendar.google.com", {"client_email": "sa@x.iam", "private_key": cle},
                     ZoneInfo("Africa/Algiers"), client=httpx.Client(transport=httpx.MockTransport(repondre)))
    occ = g.occupations(datetime(2026, 10, 15).date(), datetime(2026, 10, 25).date())
    assert [(o.id, o.debut, o.fin) for o in occ] == [
        ("a", datetime(2026, 10, 18, 9), datetime(2026, 10, 18, 10)),
        ("b", datetime(2026, 10, 20), datetime(2026, 10, 21))]  # journée entière bloquée, « disponible » ignoré
    assert g.creer({"nom": "K", "service": "Consultation", "telephone": "+213", "debut": "2026-10-18T10:00",
                    "fin": "2026-10-18T10:30"}) == "evt1"
    g.annuler("evt1")
    assert vus[0] == ("POST", "/token") and ("DELETE", "/calendar/v3/calendars/cabinet@group.calendar.google.com/events/evt1") in vus
