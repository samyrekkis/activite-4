# 9. Chatbot WhatsApp et publicités « clic vers WhatsApp »

## 9.1 Ce que fait le chatbot

C'est la même assistante que pour le téléphone, en version texte, avec le même agenda, les mêmes outils et la même
fiche du cabinet :

- Elle répond 24h/24 en darija (lettres arabes ou latines), en français ou en arabe, selon ce qu'écrit la personne.
- Elle propose 3 créneaux sur 3 jours, prend, déplace et annule les RDV, gère la liste d'attente et transmet les messages.
- Les RDV pris arrivent dans le même agenda (et dans Google Agenda ou le CRM, s'ils sont connectés), avec les mêmes
  notifications Telegram.
- **30 minutes après la fin d'une conversation**, le cabinet reçoit sur Telegram une fiche prospect :
  ```
  💬 Fiche WhatsApp (venu par la pub) — intérêt 72 % (🌤️ tiède)
  Karim — 0550 12 34 56
  Devis soin important · soin : implant
  Demande le prix d'un implant, n'a pas encore pris RDV.
  ➡️ Rappeler pour proposer une consultation devis
  ```
- **Rappel 48 h avant le RDV**, par WhatsApp avec 3 boutons : ✅ Je confirme · 🔁 Changer · ❌ Annuler.
  - « Je confirme » et « Annuler » sont traités tout de suite, sans IA. Un RDV annulé libère le créneau pour la liste
    d'attente.
  - « Changer » : l'assistante propose de nouveaux créneaux.
  - Sans réponse au bout de 20 h, Amina appelle (`"canal": "whatsapp_puis_appel"`). Avec `"canal": "whatsapp"`, le
    cabinet est simplement prévenu.
- Le tableau de bord affiche les conversations (nom, numéro cliquable vers WhatsApp, « pub », score, dernier message).

## 9.2 Ce que ça coûte

| Poste | Coût |
|---|---|
| Messages d'une conversation ouverte par une **pub « clic vers WhatsApp »** | **gratuits pendant 72 h** |
| Réponses dans les 24 h qui suivent un message du patient | **gratuites** |
| Rappel de RDV (modèle « utilitaire ») envoyé hors de ces fenêtres | quelques fractions de centime à quelques centimes de dollar |
| IA (Claude) pour une discussion d'environ 10 messages | ~10 à 30 DA avec le modèle par défaut |
| **La publicité** (Meta Ads) | le vrai coût : à mesurer en « coût par conversation » dans le Gestionnaire de publicités |

Ces tarifs de Meta changent régulièrement : vérifie la page « Pricing » de la WhatsApp Business Platform avant de
fixer tes prix.

Le modèle d'IA se règle dans `.env` (`MODELE_CHAT`, `EFFORT_CHAT`). Si le coût par discussion compte plus que la
finesse des réponses, un modèle plus petit coûte beaucoup moins cher : teste-le d'abord en darija.

## 9.3 Mise en place (une fois pour l'agence, puis une fois par cabinet)

**Pour l'agence (une seule fois)**
1. Crée un compte **Meta Business** (business.facebook.com) au nom de 7 Agents, puis fais la vérification
   d'entreprise (elle augmente les limites d'envoi).
2. Sur developers.facebook.com, crée une **application** de type « Business » et ajoute le produit **WhatsApp**.
3. Crée un **utilisateur système** dans les paramètres Business, donne-lui l'application et les comptes WhatsApp, puis
   génère un **jeton permanent** avec la permission `whatsapp_business_messaging`. Mets-le dans `.env`
   (`WHATSAPP_TOKEN`). Mets aussi la **clé secrète de l'application** (`WHATSAPP_APP_SECRET`) et un mot de passe libre
   (`WHATSAPP_VERIFY_TOKEN`).
4. Dans l'application → WhatsApp → Configuration → **Webhook** :
   - URL : `https://<ton-serveur>/whatsapp/webhook`
   - Jeton de vérification : le même que `WHATSAPP_VERIFY_TOKEN`
   - Abonne-toi au champ **messages**.
5. Ajoute `ANTHROPIC_API_KEY` dans `.env` (console.anthropic.com, paiement par carte internationale).

**Pour chaque cabinet**
1. Un **numéro dédié** : une SIM algérienne suffit. Le numéro ne doit pas être utilisé dans l'application WhatsApp
   (sinon, supprime d'abord ce compte WhatsApp). Garde la SIM active.
2. Dans le Gestionnaire WhatsApp : ajoute le numéro, vérifie-le par SMS ou appel, et donne-lui le nom d'affichage du
   cabinet (« Cabinet Dentaire Dr Benali »).
3. Copie son **Phone number ID** dans le fichier du cabinet :
   ```json
   "whatsapp": {"phone_number_id": "1234567890", "relance": true, "modele_relance": "rappel_rdv", "langue_modele": "fr"}
   ```
4. Crée et fais valider le modèle de rappel (catégorie **Utilitaire**). Utilise exactement 3 variables et 3 boutons,
   dans cet ordre :
   - **Nom** : `rappel_rdv` · **Langue** : Français (crée aussi une version arabe si besoin)
   - **Texte** : `Bonjour {{1}}, c'est le {{2}}. Nous vous rappelons votre rendez-vous du {{3}}. Merci de nous confirmer votre présence.`
   - **Boutons « réponse rapide »** : `✅ Je confirme`, `🔁 Changer`, `❌ Annuler`
5. Appelle `/admin/reload`, puis envoie « Salam » au numéro depuis ton téléphone.

## 9.4 Les pubs « clic vers WhatsApp »

- Dans le Gestionnaire de publicités, choisis l'objectif **Interactions** (ou Messages), avec **WhatsApp** comme
  destination et le numéro du cabinet.
- Message pré-rempli conseillé : « Salam, je voudrais un rendez-vous ». La personne n'a plus qu'à appuyer sur Envoyer.
- La première réponse de l'assistante sait que la personne vient d'une pub (titre de la pub inclus). La fiche
  Telegram affiche « venu par la pub ».
- Cible : Alger, 25 à 60 ans, rayon de 5 à 10 km autour du cabinet. Mets en avant le confort (« RDV en 1 minute sur
  WhatsApp, même le soir »), sans photos avant/après ni promesse médicale : les règles de Meta sur la santé sont strictes.
- Mesure dans le Gestionnaire de publicités le **coût par conversation**, et dans le tableau de bord le nombre de RDV
  pris depuis WhatsApp. Tu obtiens ainsi le coût d'un patient, un argument très fort pour vendre au dentiste.

⚠️ N'utilise jamais d'outil « non officiel » qui pilote WhatsApp Web : le numéro du cabinet peut être banni.

## 9.5 À vérifier lors du premier test réel

Le code suit la documentation actuelle de Meta et d'Anthropic, mais il a été testé avec des API simulées. Vérifie :

- l'envoi du modèle avec ses boutons, et la réception du clic (`payload` du bouton) ;
- l'indicateur « en train d'écrire » ;
- la version de l'API Graph (`WHATSAPP_API_VERSION`).

En cas d'erreur, le message exact de Meta apparaît dans les logs du serveur (`docker compose logs -f agent`).
