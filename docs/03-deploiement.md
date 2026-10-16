# 3. Déploiement en production

## Serveur

Le service a besoin d'un VPS Linux (2 vCPU, 2 Go de RAM suffisent pour des dizaines de cabinets) et d'un nom de
domaine (par exemple `agent.ton-agence.dz` ou `.com`). Hetzner, OVH, Contabo ou Scaleway conviennent : choisis une
région européenne, plus proche de l'Algérie et des serveurs de Vapi.

```bash
# Sur le VPS (Ubuntu 24.04)
curl -fsSL https://get.docker.com | sh
git clone <ce-dépôt> agent && cd agent
cp .env.example .env && nano .env          # PUBLIC_BASE_URL, VAPI_API_KEY, secrets, TELEGRAM_BOT_TOKEN
nano Caddyfile                             # remplace le domaine
# DNS : un enregistrement A agent.ton-domaine -> IP du VPS
docker compose up -d --build
curl https://agent.ton-domaine/health
```

Caddy obtient automatiquement le certificat HTTPS, exigé par Vapi.

## Variables `.env`

| Variable | Rôle |
|---|---|
| `PUBLIC_BASE_URL` | URL HTTPS publique du serveur |
| `VAPI_API_KEY` | Clé **privée** Vapi (Dashboard → API Keys) |
| `VAPI_WEBHOOK_SECRET` | Longue chaîne aléatoire (`openssl rand -hex 32`) |
| `TELEGRAM_BOT_TOKEN` | Bot créé avec @BotFather |
| `ADMIN_TOKEN` | Clé administrateur : accès à tous les tableaux de bord et à `/admin/reload` |

## Telegram (notifications du cabinet)

1. Crée un bot avec **@BotFather** (une seule fois pour toute ton agence) et mets le jeton dans `.env`.
2. Pour chaque cabinet, crée un groupe Telegram « RDV Cabinet X » avec le médecin et la secrétaire, puis ajoute le bot.
3. Envoie un message dans le groupe, puis ouvre `https://api.telegram.org/bot<TOKEN>/getUpdates`. Le `chat.id` du
   groupe est un nombre négatif.
4. Mets-le dans `notifications.telegram_chat_ids` du fichier client, puis appelle `/admin/reload`.

## Mise à jour d'un client

1. Modifie `clients/<id>.json` : horaires, prix, congés…
2. Appelle `curl -X POST "https://agent.ton-domaine/admin/reload?key=$ADMIN_TOKEN"`.

Le changement est actif dès l'appel suivant, sans redémarrage.

## Sauvegardes

```bash
# crontab -e : sauvegarde chaque nuit, conservée 30 jours
0 3 * * * cd ~/agent && sqlite3 data/agent.db ".backup data/backup-$(date +\%F).db" && find data -name 'backup-*' -mtime +30 -delete
```

Copie aussi `clients/` et les sauvegardes hors du serveur, par exemple vers un stockage objet ou ton PC.

## Surveillance

- `GET /health` toutes les 5 minutes avec UptimeRobot (gratuit), plus une alerte sur ton téléphone.
- Logs : `docker compose logs -f agent`. Chaque appel d'outil y est tracé avec ses arguments et son résultat.
- Dans Vapi, consulte **Call Logs** pour réécouter un appel et voir la latence de chaque étape.
