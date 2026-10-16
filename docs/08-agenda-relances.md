# 8. Agenda du cabinet, relances, liste d'attente et fiche d'appel

## 8.1 Le parcours complet

```
Patient appelle ─▶ Amina propose 3 créneaux sur 3 jours de la semaine
                   (libres dans NOTRE base ET dans l'agenda / le CRM du cabinet)
               ─▶ le patient choisit ─▶ RDV écrit dans notre base + dans l'agenda du cabinet
               ─▶ Telegram : ✅ nouveau RDV, puis 📋 fiche d'appel avec score d'intérêt

48 h avant ───▶ Amina appelle le patient : « Le RDV est toujours bon ? »
                ├─ oui      ─▶ 👍 confirmé (pastille « confirmé ✓ » dans le tableau de bord)
                ├─ changer  ─▶ nouveau créneau, agenda du cabinet mis à jour
                ├─ annuler  ─▶ RDV retiré de l'agenda ─▶ créneau proposé à la liste d'attente
                └─ pas de réponse ─▶ nouvel essai 3 h plus tard ─▶ 📵 « injoignable » au cabinet

Créneau libéré ─▶ 🔔 Telegram : « place libérée » + liste d'attente
               ─▶ (si appel_auto) Amina appelle la 1re personne de la liste
                   ├─ accepte ─▶ RDV pris et écrit dans l'agenda du cabinet
                   └─ refuse / ne répond pas ─▶ personne suivante (3 au maximum)
```

## 8.2 Connecter l'agenda ou le CRM du dentiste

**D'abord, demande au dentiste comment il gère ses rendez-vous aujourd'hui.** À Alger, on trouve surtout :

| Il utilise… | Ce que tu fais |
|---|---|
| Un cahier ou un agenda papier | Notre tableau de bord devient son agenda. Propose aussi Google Agenda : gratuit, sur son téléphone, et branché à l'assistante. |
| Google Agenda | Connecteur `google` ci-dessous. C'est le cas idéal. |
| Un logiciel de cabinet avec une API | Connecteur `http`, en adaptant ses routes avec un petit workflow n8n. |
| Un logiciel sans API (installé sur un PC, Excel) | Pas de synchronisation automatique possible. Utilise notre tableau de bord ou Google Agenda, puis la secrétaire recopie les RDV. Tu peux aussi faire exporter le logiciel vers Google Agenda s'il le permet. |

Si la connexion tombe, l'assistante continue avec notre base. Le cabinet reçoit alors sur Telegram « ⚠️ Agenda du
cabinet non mis à jour » et peut reporter le RDV à la main.

### Google Agenda (recommandé)

1. Dans Google Cloud Console (gratuit) : crée un projet, active **Google Calendar API**, puis crée un **compte de
   service** et télécharge sa clé JSON. Un seul compte de service suffit pour tous tes clients.
2. Copie la clé sur le serveur, dans `secrets/google-sa.json`. Ce fichier ne doit **jamais** aller dans Git.
3. Le dentiste ouvre Google Agenda → Paramètres de son agenda → **Partager avec des personnes** → il ajoute l'adresse
   du compte de service (`…@….iam.gserviceaccount.com`) avec le droit **« Modifier les événements »**.
4. Dans le fichier du cabinet :
   ```json
   "agenda_externe": {
     "type": "google",
     "calendar_id": "adresse-de-l-agenda@gmail.com",
     "fichier_compte_service": "secrets/google-sa.json"
   }
   ```
5. Appelle `/admin/reload`, puis fais un test : prends un RDV par téléphone. Il doit apparaître sur le téléphone du
   dentiste. Ajoute ensuite un événement « Absent » dans son agenda : l'assistante ne doit plus proposer ce créneau.

Les événements « journée entière » (congé, formation) bloquent toute la journée. Les événements marqués
« Disponible » sont ignorés.

### Un CRM ou un logiciel avec API (connecteur `http`)

L'assistante parle à n'importe quel logiciel qui respecte ce contrat de 4 routes :

| Route | Rôle | Réponse |
|---|---|---|
| `GET {url}/occupations?du=AAAA-MM-JJ&au=AAAA-MM-JJ` | créneaux occupés | `[{"id": "...", "debut": "2026-10-18T09:00", "fin": "2026-10-18T09:30"}]` |
| `POST {url}/rendez-vous` | créer le RDV (`nom`, `telephone`, `service`, `debut`, `fin`, `notes`) | `{"id": "..."}` |
| `PATCH {url}/rendez-vous/{id}` | déplacer (`debut`, `fin`) | — |
| `DELETE {url}/rendez-vous/{id}` | annuler | — |

Les heures sont en heure locale d'Alger. L'en-tête `Authorization: Bearer <jeton>` est envoyé si un jeton est configuré.

Si le logiciel du dentiste a une autre API (ce sera presque toujours le cas), crée dans **n8n** un workflow avec 4
webhooks qui traduisent ces routes vers ses routes à lui. Ça représente environ une demi-journée de travail par
logiciel, réutilisable pour tous les cabinets qui utilisent le même logiciel.

```json
"agenda_externe": {"type": "http", "url": "https://n8n.ton-domaine.com/webhook/crm-cabinet-x", "jeton_env": "CRM_JETON_CABINET_X"}
```

Le jeton est mis dans `.env` (`CRM_JETON_CABINET_X=...`), jamais dans le fichier du cabinet.

## 8.3 Relances de confirmation

```json
"relance": {"actif": true, "heures_avant": 48, "plage": ["09:00", "19:00"],
            "jours_exclus": ["vendredi"], "tentatives": 2, "intervalle_heures": 3}
```

- Le serveur vérifie toutes les 5 minutes s'il y a des RDV à confirmer. Il faut que `VAPI_API_KEY` soit renseignée
  et que le cabinet ait un `vapi_phone_number_id` qui peut **appeler vers l'Algérie**.
- Il n'appelle jamais en dehors de la plage horaire ni le vendredi. Si 48 h avant tombe la nuit, il appelle le
  lendemain matin. Il n'appelle pas pour un RDV dans moins de 3 h.
- Les RDV ajoutés à la main dans le tableau de bord sans téléphone, ou les créneaux « Bloqué », ne sont pas relancés.
- Dans le tableau de bord, la colonne **Confirmation** affiche : relance en cours, pas de réponse, confirmé ✓,
  injoignable.

⚠️ **Le numéro qui s'affiche chez le patient est décisif.** Un numéro américain ou français qui appelle un
Algérien, c'est souvent « je ne décroche pas ». Avec la passerelle GSM et une SIM algérienne (option B de
`02-algerie.md`), le patient voit un numéro local en 05/06/07 et décroche beaucoup plus. Vérifie aussi le coût
des appels sortants vers les mobiles algériens chez ton fournisseur de numéro : il est plus élevé que celui des
appels entrants.

Une relance dure environ 30 à 60 secondes. Pour 300 RDV par mois, compte environ 150 à 300 minutes en plus. C'est
inclus dans les 900 minutes de la formule Pro, mais surveille-le.

## 8.4 Liste d'attente

```json
"liste_attente": {"actif": true, "appel_auto": true, "delai_min_heures": 4, "max_contacts": 3}
```

- Pendant un appel, si aucun créneau ne convient, Amina propose la liste d'attente.
- Quand un créneau se libère (annulation au téléphone, pendant une relance, ou depuis le tableau de bord), le cabinet
  reçoit **🔔 Place libérée** avec la liste des personnes en attente.
- Avec `appel_auto: true`, Amina appelle elle-même la première personne. Si elle refuse ou ne répond pas, elle passe
  à la suivante, jusqu'à 3 personnes. Avec `false`, c'est la secrétaire qui rappelle à partir de la liste Telegram.
- Les personnes qui attendent le même soin passent en premier. Ensuite, c'est l'ordre d'inscription.

## 8.5 Fiche d'appel et score d'intérêt (Telegram)

Après chaque appel entrant, le cabinet reçoit :

```
📋 Fiche appel — intérêt 85 % (🔥 chaud)
Karim Haddad — 0550 12 34 56
Devis soin important · soin : implant
Demande un devis pour un implant, a pris RDV samedi à 9h.
➡️ Préparer le devis implant pour samedi
```

- **🔥 80–100 % (chaud)** : RDV pris, devis pour un soin important, urgence.
- **🌤️ 50–79 % (tiède)** : intéressé mais sans RDV, veut réfléchir, compare les prix. **C'est à rappeler en priorité.**
- **❄️ 0–49 % (froid)** : simple renseignement, mauvais numéro.

Le score est estimé par l'IA à partir de la transcription. C'est une aide pour prioriser les rappels, pas une
certitude. Il apparaît aussi dans la colonne « Intérêt » du tableau de bord. Pour désactiver la fiche, mets
`"fiche_appel": false`.

## 8.6 À vérifier lors de ton premier test Vapi

Ces réglages suivent la documentation Vapi actuelle, mais n'ont pas encore été testés sur un vrai compte :

- la création d'appels sortants (`POST /call` avec `phoneNumberId`, `customer` et `assistant`) ;
- la détection de répondeur (`voicemailDetection`) ;
- l'analyse structurée en fin d'appel (`structuredDataPlan`), qui alimente la fiche et le score.

En cas d'erreur, le message de Vapi apparaît dans les logs du serveur (`docker compose logs -f agent`). Envoie-le-moi.
