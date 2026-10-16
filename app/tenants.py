"""Chargement des clients (cabinets) et des modèles de niche.

Chaque client est un fichier JSON dans `clients/`. Il référence une niche
(`niches/<niche>.json`) qui fournit les valeurs par défaut : services, règles
d'urgence, consignes spécifiques. Tout champ défini côté client l'emporte.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]


class ConfigError(ValueError):
    pass


@dataclass
class Service:
    id: str
    nom: str
    duree: int  # minutes
    prix: str = ""
    description: str = ""


@dataclass
class Tenant:
    id: str
    niche: str
    nom: str
    raw: dict[str, Any]
    niche_cfg: dict[str, Any]
    services: list[Service]
    horaires: dict[str, list[tuple[str, str]]]
    fuseau: ZoneInfo
    fermetures: set[str] = field(default_factory=set)

    def get(self, key: str, default: Any = None) -> Any:
        """Valeur client, sinon valeur de la niche, sinon défaut."""
        if key in self.raw:
            return self.raw[key]
        return self.niche_cfg.get(key, default)

    @property
    def capacite(self) -> int:
        return int(self.get("capacite", 1))

    @property
    def delai_min_minutes(self) -> int:
        return int(self.get("delai_min_minutes", 60))

    @property
    def horizon_jours(self) -> int:
        return int(self.get("horizon_jours", 30))

    @property
    def pas_minutes(self) -> int:
        return int(self.get("pas_minutes", 15))

    @property
    def nom_assistant(self) -> str:
        return self.get("nom_assistant", "Amina")

    @property
    def langue_principale(self) -> str:
        return self.get("langue_principale", "darija")

    def service(self, service_id_ou_nom: str | None) -> Service:
        if not self.services:
            raise ConfigError(f"Aucun service défini pour {self.id}")
        if not service_id_ou_nom:
            return self.services[0]
        cle = service_id_ou_nom.strip().lower()
        for s in self.services:
            if s.id.lower() == cle or s.nom.lower() == cle:
                return s
        for s in self.services:
            if cle in s.nom.lower() or s.nom.lower() in cle:
                return s
        return self.services[0]


def _load_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ConfigError(f"JSON invalide dans {path}: {e}") from e


def _parse_horaires(data: dict[str, Any]) -> dict[str, list[tuple[str, str]]]:
    horaires: dict[str, list[tuple[str, str]]] = {}
    for jour, plages in data.items():
        if jour not in JOURS:
            raise ConfigError(f"Jour inconnu dans horaires: {jour!r} (attendu: {JOURS})")
        horaires[jour] = [(p[0], p[1]) for p in plages]
    return horaires


def build_tenant(raw: dict[str, Any], niches_dir: Path) -> Tenant:
    for champ in ("id", "niche", "nom"):
        if not raw.get(champ):
            raise ConfigError(f"Champ obligatoire manquant: {champ}")
    niche_path = niches_dir / f"{raw['niche']}.json"
    if not niche_path.exists():
        raise ConfigError(f"Niche inconnue {raw['niche']!r} ({niche_path} introuvable)")
    niche_cfg = _load_json(niche_path)

    services_data = raw.get("services") or niche_cfg.get("services") or []
    services = [
        Service(
            id=s["id"],
            nom=s["nom"],
            duree=int(s.get("duree", 30)),
            prix=s.get("prix", ""),
            description=s.get("description", ""),
        )
        for s in services_data
    ]
    horaires = _parse_horaires(raw.get("horaires") or niche_cfg.get("horaires") or {})
    return Tenant(
        id=raw["id"],
        niche=raw["niche"],
        nom=raw["nom"],
        raw=raw,
        niche_cfg=niche_cfg,
        services=services,
        horaires=horaires,
        fuseau=ZoneInfo(raw.get("fuseau", "Africa/Algiers")),
        fermetures=set(raw.get("fermetures", [])),
    )


class TenantRegistry:
    def __init__(self, clients_dir: Path, niches_dir: Path):
        self.clients_dir = clients_dir
        self.niches_dir = niches_dir
        self._tenants: dict[str, Tenant] = {}
        self.reload()

    def reload(self) -> None:
        tenants: dict[str, Tenant] = {}
        for path in sorted(self.clients_dir.glob("*.json")):
            tenant = build_tenant(_load_json(path), self.niches_dir)
            if tenant.id in tenants:
                raise ConfigError(f"Identifiant client en double: {tenant.id}")
            tenants[tenant.id] = tenant
        self._tenants = tenants

    def all(self) -> list[Tenant]:
        return list(self._tenants.values())

    def get(self, tenant_id: str | None) -> Tenant | None:
        if not tenant_id:
            return None
        return self._tenants.get(tenant_id)

    def by_phone(self, phone_number_id: str | None, number: str | None) -> Tenant | None:
        """Retrouve le client à partir du numéro Vapi appelé."""
        for t in self._tenants.values():
            if phone_number_id and t.raw.get("vapi_phone_number_id") == phone_number_id:
                return t
            if number and t.raw.get("numero_agent") == number:
                return t
        return None
