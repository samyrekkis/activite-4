"""Crée le fichier de configuration d'un nouveau client à partir d'une niche.

  python -m scripts.nouveau_client --id cabinet-dr-x --niche dentaire --nom "Cabinet Dentaire Dr X" --ville "Oran"
"""
from __future__ import annotations

import argparse
import json
import secrets
from pathlib import Path


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--id", required=True, help="Identifiant court, sans espace (ex. dentaire-oran-x)")
    p.add_argument("--niche", required=True, help="dentaire, medecin, avocat, beaute, garage, immobilier…")
    p.add_argument("--nom", required=True)
    p.add_argument("--ville", default="")
    p.add_argument("--langue", default="darija", choices=["darija", "francais", "arabe"])
    p.add_argument("--dossier", type=Path, default=Path("clients"))
    a = p.parse_args()

    niche = json.loads((Path("niches") / f"{a.niche}.json").read_text(encoding="utf-8"))
    cible = a.dossier / f"{a.id}.json"
    if cible.exists():
        raise SystemExit(f"{cible} existe déjà")
    client = {
        "id": a.id,
        "niche": a.niche,
        "nom": a.nom,
        "ville": a.ville,
        "adresse": "",
        "telephone_cabinet": "",
        "numero_transfert": "",
        "vapi_phone_number_id": "",
        "langue_principale": a.langue,
        "nom_assistant": "Amina",
        "horaires": niche.get("horaires", {}),
        "fermetures": [],
        "services": niche.get("services", []),
        "infos": {},
        "faq": [],
        "consignes": [],
        "valeur_moyenne_rdv_da": 0,
        "notifications": {"telegram_chat_ids": [], "webhook_url": ""},
        "dashboard_key": secrets.token_urlsafe(24),
        "enregistrement": True,
    }
    a.dossier.mkdir(exist_ok=True)
    cible.write_text(json.dumps(client, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Créé : {cible}\nComplète adresse, téléphones, horaires, services (prix) et infos pratiques.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
