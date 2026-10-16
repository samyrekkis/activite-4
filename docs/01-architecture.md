# 1. Architecture et choix techniques

## Les étapes d'un agent vocal

Un agent vocal se construit toujours avec les mêmes étapes :

1. **Téléphonie** : un numéro reçoit l'appel. Voir `02-algerie.md` pour l'Algérie.
2. **STT** (reconnaissance vocale) : la voix devient du texte.
3. **LLM** : le « cerveau » comprend la demande, décide et appelle des outils.
4. **Outils** : ce sont des actions réelles (agenda, RDV, messages, transfert).
5. **TTS** (synthèse vocale) : le texte redevient une voix.
6. **Après l'appel** : résumé, enregistrement, notifications et statistiques.

**Vapi** orchestre les étapes 1, 2, 3 et 5. Il gère aussi la latence, les interruptions (le patient coupe la parole) et
la détection de fin de phrase. Ce dépôt couvre les étapes 4 et 6, ainsi que la configuration multi-clients, qui fait
la valeur de ton service.

> Pourquoi pas tout en n8n/Make ? Ces outils sont très bien pour un prototype. Pour un service vendu à plusieurs
> cabinets, un vrai backend apporte plusieurs avantages : un agenda fiable (pas de double réservation, même si deux
> appels arrivent en même temps), des tests automatisés, un tableau de bord propre et une seule base de code pour
> tous les clients. n8n reste branchable via `notifications.webhook_url`, par exemple pour Google Agenda, un SMS ou un
> Google Sheet.

## Déroulement d'un appel

1. Le patient appelle. Vapi envoie `assistant-request` au serveur.
2. Le serveur reconnaît le cabinet (via `vapi_phone_number_id`). Il renvoie alors l'assistant complet : le prompt avec
   la date du jour, les horaires, les services et la FAQ, ainsi que les outils, la voix et le transcripteur. Comme
   l'assistant est reconstruit à chaque appel, **une modification du fichier client est active dès l'appel suivant**,
   après `/admin/reload`.
3. Pendant la conversation, le LLM appelle les outils (`tool-calls`). Le serveur répond en quelques millisecondes,
   puis envoie les notifications Telegram en arrière-plan.
4. À la fin de l'appel, `end-of-call-report` enregistre la durée, le coût, le résumé en français, la transcription et
   le lien vers l'enregistrement. Le tout s'affiche dans le tableau de bord.

## Choix par défaut (modifiables par client)

| Élément | Défaut | Où le changer |
|---|---|---|
| LLM | `anthropic` / `claude-opus-5-5` | champ `"modele"` du client, ex. `{"provider": "anthropic", "model": "claude-sonnet-5-5"}` |
| Voix darija/arabe | Azure `ar-DZ-AminaNeural` (accent algérien) | champ `"voix"`, ex. `{"provider": "11labs", "voiceId": "…", "model": "eleven_flash_v2_5"}` |
| Voix française | Azure `fr-FR-DeniseNeural` | champ `"voix"` |
| STT darija/arabe | Azure `ar-DZ` | champ `"transcripteur"` |
| STT français | Deepgram `nova-3` `fr` | champ `"transcripteur"` |

**À tester avant de vendre.** La darija est la partie la plus difficile. Suis la recette de `06-tests-qualite.md` :

- **STT** : compare Azure `ar-DZ`, Deepgram et Gladia (qui gère le mélange de langues) sur 10 vrais enregistrements
  d'appels mélangeant darija et français. Garde celui qui comprend le mieux les **noms et les numéros**.
- **Voix** : une voix ElevenLabs multilingue rend mieux le mélange « darija + mots français » qu'une voix Azure
  purement arabe. Fais écouter les deux au client.
- **LLM** : vérifie dans le dashboard Vapi que le modèle choisi est proposé. Mesure la latence avant la première
  réponse ; au-delà d'environ 1,5 s, la conversation paraît lente. Si c'est le cas, teste un modèle plus rapide
  (Sonnet ou Haiku) **sur tes scénarios**, puis compare la qualité des réponses en darija.

## Sécurité

- Webhook protégé par un secret partagé (`VAPI_WEBHOOK_SECRET`, envoyé dans l'en-tête `x-vapi-secret`).
- Tableau de bord protégé par une clé longue par cabinet (`dashboard_key`) et par une clé administrateur.
- Un appelant ne peut annuler ou déplacer **que les RDV liés à son numéro**.
- La base SQLite reste sur ton serveur. Sauvegarde le dossier `data/` chaque nuit (voir `03-deploiement.md`).
