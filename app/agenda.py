"""Connecteurs vers l'agenda ou le CRM du cabinet.

Notre base reste la référence pour l'assistante. Quand un connecteur est configuré :
- les créneaux occupés dans l'agenda du cabinet sont exclus des propositions ;
- chaque RDV pris, déplacé ou annulé par l'assistante est répercuté dans l'agenda du cabinet.

Deux connecteurs :
- `google` : Google Agenda, via un compte de service avec lequel le cabinet partage son agenda ;
- `http` : n'importe quel CRM ou logiciel de cabinet qui expose une API. On définit un petit contrat
  (4 routes, voir docs/08-agenda-relances.md). Si le logiciel a une API différente, un workflow n8n
  fait l'adaptateur entre les deux.

Configuration dans le fichier client, champ "agenda_externe" :
  {"type": "google", "calendar_id": "xxx@group.calendar.google.com", "fichier_compte_service": "secrets/sa.json"}
  {"type": "http", "url": "https://crm.exemple/api/7agents", "jeton_env": "CRM_JETON_CABINET_X"}
"""
from __future__ import annotations

import base64
import json
import logging
import os
import time as _time
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Protocol
from zoneinfo import ZoneInfo

import httpx

log = logging.getLogger("agenda")


class ErreurAgenda(Exception):
    pass


@dataclass
class Occupation:
    debut: datetime  # heure locale du cabinet, sans fuseau
    fin: datetime
    id: str | None = None


class AgendaExterne(Protocol):
    def occupations(self, du: date, au: date) -> list[Occupation]: ...
    def creer(self, rdv: dict[str, Any]) -> str | None: ...
    def modifier(self, external_id: str, debut: datetime, fin: datetime) -> None: ...
    def annuler(self, external_id: str) -> None: ...


# --------------------------------------------------------------------------- HTTP générique

class AgendaHTTP:
    """Contrat :
    GET    {url}/occupations?du=AAAA-MM-JJ&au=AAAA-MM-JJ -> [{"id", "debut", "fin"}]  (heure locale ISO)
    POST   {url}/rendez-vous  {nom, telephone, service, debut, fin, notes} -> {"id"}
    PATCH  {url}/rendez-vous/{id}  {debut, fin}
    DELETE {url}/rendez-vous/{id}
    """

    def __init__(self, url: str, jeton: str = "", client: httpx.Client | None = None):
        self.url = url.rstrip("/")
        headers = {"Authorization": f"Bearer {jeton}"} if jeton else {}
        self.http = client or httpx.Client(timeout=8, headers=headers)

    def _req(self, method: str, path: str, **kw: Any) -> httpx.Response:
        try:
            r = self.http.request(method, f"{self.url}{path}", **kw)
            r.raise_for_status()
            return r
        except httpx.HTTPError as e:
            raise ErreurAgenda(f"{method} {path}: {e}") from e

    def occupations(self, du: date, au: date) -> list[Occupation]:
        data = self._req("GET", "/occupations", params={"du": du.isoformat(), "au": au.isoformat()}).json()
        return [Occupation(_local(o["debut"]), _local(o["fin"]), str(o.get("id") or "")) for o in data]

    def creer(self, rdv: dict[str, Any]) -> str | None:
        data = self._req("POST", "/rendez-vous", json=rdv).json()
        return str(data.get("id")) if data.get("id") is not None else None

    def modifier(self, external_id: str, debut: datetime, fin: datetime) -> None:
        self._req("PATCH", f"/rendez-vous/{external_id}", json={"debut": _iso(debut), "fin": _iso(fin)})

    def annuler(self, external_id: str) -> None:
        self._req("DELETE", f"/rendez-vous/{external_id}")


# --------------------------------------------------------------------------- Google Agenda

GOOGLE_API = "https://www.googleapis.com/calendar/v3"
GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"


class AgendaGoogle:
    """Google Agenda via un compte de service.

    Le cabinet partage son agenda avec l'adresse du compte de service
    (« Modifier les événements »). Aucune connexion à son compte Google n'est nécessaire.
    """

    def __init__(self, calendar_id: str, compte_service: dict[str, Any], fuseau: ZoneInfo,
                 client: httpx.Client | None = None):
        self.calendar_id = calendar_id
        self.sa = compte_service
        self.fuseau = fuseau
        self.http = client or httpx.Client(timeout=8)
        self._jeton: tuple[str, float] | None = None

    def _token(self) -> str:
        if self._jeton and self._jeton[1] > _time.time() + 60:
            return self._jeton[0]
        maintenant = int(_time.time())
        assertion = _jwt_rs256(
            {"iss": self.sa["client_email"], "scope": "https://www.googleapis.com/auth/calendar",
             "aud": GOOGLE_TOKEN, "iat": maintenant, "exp": maintenant + 3600},
            self.sa["private_key"],
        )
        try:
            r = self.http.post(GOOGLE_TOKEN, data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion})
            r.raise_for_status()
        except httpx.HTTPError as e:
            raise ErreurAgenda(f"authentification Google : {e}") from e
        data = r.json()
        self._jeton = (data["access_token"], _time.time() + int(data.get("expires_in", 3600)))
        return self._jeton[0]

    def _req(self, method: str, path: str, **kw: Any) -> httpx.Response:
        url = f"{GOOGLE_API}/calendars/{_quote(self.calendar_id)}{path}"
        try:
            r = self.http.request(method, url, headers={"Authorization": f"Bearer {self._token()}"}, **kw)
            r.raise_for_status()
            return r
        except httpx.HTTPError as e:
            raise ErreurAgenda(f"Google {method} {path}: {e}") from e

    def _aware(self, dt: datetime) -> str:
        return dt.replace(tzinfo=self.fuseau).isoformat()

    def occupations(self, du: date, au: date) -> list[Occupation]:
        params = {
            "timeMin": self._aware(datetime.combine(du, datetime.min.time())),
            "timeMax": self._aware(datetime.combine(au + timedelta(days=1), datetime.min.time())),
            "singleEvents": "true", "orderBy": "startTime", "maxResults": "2500",
        }
        items = self._req("GET", "/events", params=params).json().get("items", [])
        out = []
        for ev in items:
            if ev.get("status") == "cancelled" or ev.get("transparency") == "transparent":
                continue
            debut, fin = ev.get("start", {}), ev.get("end", {})
            if "dateTime" in debut:
                d = datetime.fromisoformat(debut["dateTime"]).astimezone(self.fuseau).replace(tzinfo=None)
                f = datetime.fromisoformat(fin["dateTime"]).astimezone(self.fuseau).replace(tzinfo=None)
            else:  # événement « journée entière » (congé, formation) : bloque toute la journée
                d = datetime.fromisoformat(debut["date"])
                f = datetime.fromisoformat(fin["date"])
            out.append(Occupation(d, f, ev.get("id")))
        return out

    def creer(self, rdv: dict[str, Any]) -> str | None:
        corps = {
            "summary": f"{rdv['nom']} — {rdv['service']}",
            "description": f"Téléphone : {rdv['telephone']}\n{rdv.get('notes') or ''}\nPris par l'assistante 7 Agents.",
            "start": {"dateTime": self._aware(_local(rdv["debut"])), "timeZone": str(self.fuseau)},
            "end": {"dateTime": self._aware(_local(rdv["fin"])), "timeZone": str(self.fuseau)},
        }
        return self._req("POST", "/events", json=corps).json().get("id")

    def modifier(self, external_id: str, debut: datetime, fin: datetime) -> None:
        self._req("PATCH", f"/events/{external_id}", json={
            "start": {"dateTime": self._aware(debut), "timeZone": str(self.fuseau)},
            "end": {"dateTime": self._aware(fin), "timeZone": str(self.fuseau)},
        })

    def annuler(self, external_id: str) -> None:
        self._req("DELETE", f"/events/{external_id}")


# --------------------------------------------------------------------------- utilitaires

def _quote(s: str) -> str:
    from urllib.parse import quote
    return quote(s, safe="")


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M")


def _local(value: str) -> datetime:
    """'AAAA-MM-JJTHH:MM[:SS][+fuseau]' -> datetime local naïf (le fuseau éventuel est ignoré)."""
    return datetime.fromisoformat(value.strip()[:19]).replace(tzinfo=None)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _jwt_rs256(claims: dict[str, Any], private_key_pem: str) -> str:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    entete = _b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    corps = _b64(json.dumps(claims).encode())
    cle = serialization.load_pem_private_key(private_key_pem.encode(), password=None)
    signature = cle.sign(f"{entete}.{corps}".encode(), padding.PKCS1v15(), hashes.SHA256())
    return f"{entete}.{corps}.{_b64(signature)}"


def construire(config: dict[str, Any] | None, fuseau: ZoneInfo) -> AgendaExterne | None:
    """Crée le connecteur décrit dans le fichier client, ou None si aucun."""
    if not config or not config.get("type"):
        return None
    if config["type"] == "http":
        jeton = os.getenv(config["jeton_env"], "") if config.get("jeton_env") else ""
        return AgendaHTTP(config["url"], jeton)
    if config["type"] == "google":
        sa = json.loads(Path(config["fichier_compte_service"]).read_text(encoding="utf-8"))
        return AgendaGoogle(config["calendar_id"], sa, fuseau)
    raise ErreurAgenda(f"Type d'agenda inconnu : {config['type']!r}")
