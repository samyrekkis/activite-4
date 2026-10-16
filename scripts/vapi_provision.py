"""Publie la configuration d'un client sur Vapi.

Deux modes (cumulables) :

  # 1) Relier un numéro Vapi à ce serveur (recommandé en production) :
  #    à chaque appel, Vapi demande l'assistant au serveur (« assistant-request »),
  #    donc toute modification du fichier client est prise en compte immédiatement.
  python -m scripts.vapi_provision clients/mon-cabinet.json --numero

  # 2) Créer / mettre à jour un assistant « fixe » dans le dashboard Vapi
  #    (pratique pour tester avec le bouton « Talk to assistant » ou le widget web) :
  python -m scripts.vapi_provision clients/mon-cabinet.json --assistant

Variables d'environnement : VAPI_API_KEY, PUBLIC_BASE_URL, VAPI_WEBHOOK_SECRET.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import httpx

from app.config import load_settings
from app.tenants import build_tenant
from app.vapi import build_assistant, server_url

API = "https://api.vapi.ai"


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("client", type=Path, help="Fichier JSON du client")
    p.add_argument("--assistant", action="store_true", help="Créer/mettre à jour un assistant Vapi")
    p.add_argument("--numero", action="store_true", help="Relier le numéro Vapi (vapi_phone_number_id) au serveur")
    p.add_argument("--afficher", action="store_true", help="Afficher la configuration sans rien envoyer")
    args = p.parse_args()

    s = load_settings()
    raw = json.loads(args.client.read_text(encoding="utf-8"))
    tenant = build_tenant(raw, s.niches_dir)
    assistant = build_assistant(tenant, s.public_base_url, s.vapi_webhook_secret)

    if args.afficher or not (args.assistant or args.numero):
        print(json.dumps(assistant, ensure_ascii=False, indent=2))
        return 0
    if not s.vapi_api_key:
        print("VAPI_API_KEY manquant", file=sys.stderr)
        return 1
    if s.public_base_url.startswith("http://localhost"):
        print("PUBLIC_BASE_URL doit être une URL HTTPS publique (Vapi doit pouvoir joindre le serveur).", file=sys.stderr)
        return 1

    headers = {"Authorization": f"Bearer {s.vapi_api_key}"}
    with httpx.Client(base_url=API, headers=headers, timeout=30) as http:
        if args.assistant:
            assistant_id = raw.get("vapi_assistant_id")
            if assistant_id:
                r = http.patch(f"/assistant/{assistant_id}", json=assistant)
            else:
                r = http.post("/assistant", json=assistant)
            if r.is_error:
                print(f"Erreur Vapi {r.status_code}: {r.text}", file=sys.stderr)
                return 1
            assistant_id = r.json()["id"]
            if raw.get("vapi_assistant_id") != assistant_id:
                raw["vapi_assistant_id"] = assistant_id
                args.client.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"Assistant prêt : {assistant_id}")

        if args.numero:
            pn = raw.get("vapi_phone_number_id")
            if not pn:
                print("Renseigne 'vapi_phone_number_id' dans le fichier client.", file=sys.stderr)
                return 1
            server = {"url": server_url(s.public_base_url, tenant)}
            if s.vapi_webhook_secret:
                server["headers"] = {"x-vapi-secret": s.vapi_webhook_secret}
            # Pas d'assistantId : Vapi enverra « assistant-request » au serveur à chaque appel.
            r = http.patch(f"/phone-number/{pn}", json={"assistantId": None, "server": server})
            if r.is_error:
                print(f"Erreur Vapi {r.status_code}: {r.text}", file=sys.stderr)
                return 1
            print(f"Numéro {pn} relié à {server['url']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
