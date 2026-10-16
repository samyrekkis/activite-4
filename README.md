# Agent vocal IA pour cabinets — Algérie

Une **secrétaire virtuelle au téléphone**, 24h/24, en **darija, français et arabe**, pour les cabinets
dentaires, médicaux, d'avocats, salons de beauté, garages, agences immobilières… Elle :

- répond à tous les appels, même hors horaires, pendant les soins ou quand la ligne est occupée ;
- **prend, déplace et annule les rendez-vous** dans un vrai agenda, sans double réservation ;
- répond aux questions pratiques (adresse, horaires, tarifs indicatifs, paiement, CNAS…) ;
- détecte les urgences, oriente vers le 14 si nécessaire, **transfère l'appel** au cabinet ou **prend un message** ;
- prévient le cabinet en temps réel sur **Telegram** (nouveau RDV, annulation, message urgent) ;
- donne au cabinet un **tableau de bord** : RDV à venir, messages à rappeler, appels avec résumé et enregistrement, statistiques du mois.

Un seul serveur gère **plusieurs clients** : chaque cabinet = un fichier JSON dans `clients/`.

## Architecture

```
 Patient ──appel──▶ Numéro (Vapi / passerelle GSM) ──▶ Vapi : STT → LLM → TTS
                                                           │  ▲
                                   assistant-request,      │  │ résultats
                                   tool-calls, fin d'appel ▼  │
                                              Ce serveur (FastAPI + SQLite)
                                               ├─ agenda / créneaux / RDV
                                               ├─ prompt par niche + par cabinet
                                               ├─ notifications Telegram / webhook (n8n, Make)
                                               └─ tableau de bord du cabinet
```

| Brique | Rôle | Fichier |
|---|---|---|
| Niches | Services, urgences, consignes par métier | `niches/*.json` |
| Clients | Horaires, services, prix, infos, notifications | `clients/*.json` |
| Prompt | Personnalité, langue (darija), règles, données du cabinet | `app/prompts.py` |
| Outils | `verifier_disponibilites`, `prendre_rendez_vous`, `chercher_rendez_vous`, `deplacer_rendez_vous`, `annuler_rendez_vous`, `laisser_message` + transfert et fin d'appel | `app/tools.py`, `app/vapi.py` |
| Agenda | Horaires, pauses, jours fermés, délai minimum, capacité (nb de fauteuils), anti-double réservation | `app/scheduling.py` |
| Dashboard | `/dashboard/<client>?key=…` | `app/dashboard.py` |

## Démarrage rapide (local)

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env          # puis remplis les valeurs
pytest                        # 13 tests : agenda, outils, webhook, dashboard
uvicorn app.main:create_app --factory --reload
# http://localhost:8000/health
# http://localhost:8000/dashboard/dentaire-exemple?key=<dashboard_key du fichier client>
```

Voir la configuration générée pour Vapi (prompt + outils) sans rien envoyer :

```bash
python -m scripts.vapi_provision clients/dentaire-exemple.json --afficher
```

## Mettre un nouveau client en service

```bash
python -m scripts.nouveau_client --id dentaire-oran-x --niche dentaire --nom "Cabinet Dentaire Dr X" --ville Oran
# compléter clients/dentaire-oran-x.json (adresse, horaires, prix, infos, Telegram)
python -m scripts.vapi_provision clients/dentaire-oran-x.json --numero
curl -X POST "https://<ton-serveur>/admin/reload?key=$ADMIN_TOKEN"
```

Le détail se trouve dans [`docs/04-onboarding-client.md`](docs/04-onboarding-client.md).

## Documentation

1. [Architecture et choix techniques](docs/01-architecture.md)
2. [Spécificités Algérie : numéro de téléphone, paiement des services, loi 18-07](docs/02-algerie.md)
3. [Déploiement en production](docs/03-deploiement.md)
4. [Onboarding d'un nouveau cabinet (checklist)](docs/04-onboarding-client.md)
5. [Offre commerciale : packs, prix en DA, script de prospection, objections](docs/05-offre-commerciale.md)
6. [Recette qualité : scénarios de test avant livraison](docs/06-tests-qualite.md)

Page de vente prête à déployer (Netlify) : [`vente/index.html`](vente/index.html).
