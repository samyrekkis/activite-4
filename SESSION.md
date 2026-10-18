# Passation : reprendre le travail sur le PC de l'utilisateur

Ce fichier résume la première session (menée dans le cloud du 16 au 18 octobre 2026) pour qu'une session Claude Code **locale** reprenne sans rien perdre. À lire en entier avant de commencer, avec `CLAUDE.md` (règles de montage) et `README.md` (commandes).

## Le client et son besoin

- L'utilisateur gère la création vidéo de **deux restaurants** :
  - **Le Samouraï** (« Samouraï Asian Luxury », サムライ) : cuisine asiatique, décor rouge et noir, lanternes, fresque de samouraï, escalier et couloir néon, loge kimono avec miroir lumineux (shootings en kimono), chambre avec table basse, terrasse.
  - **Le Monégasque** : brunchs et plats, décoration riche (enseigne néon « Le Monégasque », affiches d'Alger, fauteuils baroques dorés).
- Règle de tri des fichiers : **décor asiatique = Samouraï, tout le reste = Monégasque.**
- Objectif : des Reels Instagram verticaux (1080x1920, 12-25 s) montés par Claude avec Remotion, critiqués par Gemini en **3 cycles**, avec effets sonores gratuits. Vidéos brutes d'une minute maximum.
- Il parle français, de façon orale et rapide : lui répondre en français simple, concret, sans jargon.
- Plus tard (pas encore fait, il a dit oui « avec mon accord ») : analyser les Reels de ses comptes Instagram et **publier** Reels et stories via l'API officielle Instagram Graph (comptes pro reliés à une page Facebook, app Meta). **Ne jamais publier sans son « OK » explicite, ne jamais demander son mot de passe Instagram.**

## Ce qui existe déjà dans ce dépôt

- Moteur Remotion complet (`src/`) : thèmes des deux restos, 11 transitions, mouvements de caméra, textes animés, grain, vignettage, cartes intro/outro.
- Scripts (`scripts/`) : analyse de référence et de rushs (ffmpeg), rendu, critique Gemini avec repli automatique entre modèles, recherche d'effets sonores Freesound, import Drive, conversion HEIC, `timeline-info.mjs`.
- Premier vrai montage : `edits/samourai-photos.json` (version 3), Reel du Samouraï fait **uniquement avec des photos**. Notes Gemini : v1 5,5, v2 6,2, v3 7,2/10. Défauts restants : aucune photo de plat, store replié au milieu de la photo de terrasse.

## Ses fichiers

- Dossier Google Drive **« Photo »** (id `1jsAOKeCNaqDZab2G40UKdR9Hf7JihNx6`, privé) :
  - **11 vidéos iPhone (.MOV, 14 à 51 Mo), pas encore regardées** : IMG_2322, 2323, 2324, 2329, 2338, 2340, 2344, 2349, 2350, 2351, 2362.
  - 18 photos HEIC uniques, dont deux fois les mêmes. 2325 et 2326 = Monégasque (enseigne néon). Toutes les autres = Samouraï.
- Autres vidéos à la racine de son Drive : IMG_2331, 2332, 2357, 2367, 2368 (60 à 88 Mo).
- Sur son PC, les vidéos sont probablement dans **Téléchargements** ou un dossier « Restaurant studio » : lui demander le chemin exact s'il n'est pas évident.
- **Vidéo exemple** souhaitée : le Reel https://www.instagram.com/reel/DeVwBdMORqL/ (non téléchargé : Instagram était bloqué dans le cloud). En local, essayer `yt-dlp`, sinon lui demander de l'enregistrer dans `public/refs/exemple.mp4`.

## Pourquoi on passe en local

Dans le cloud, le connecteur Drive était limité à 10 Mo par fichier, et Instagram et les téléchargements Drive directs étaient bloqués par le réseau. En local, il n'y a aucune de ces limites : lire directement ses fichiers, quelle que soit leur taille.

## Installation sur son PC (à faire par la session locale, avec son accord à chaque étape)

1. Vérifier ou installer **Git**, **Node.js 22+** et **ffmpeg** (Windows : `winget install Git.Git OpenJS.NodeJS.LTS Gyan.FFmpeg` ; Mac : `brew install git node ffmpeg`).
2. `git clone https://github.com/samyrekkis/activite-4.git` puis `git checkout claude/video-editing-workflow-restaurants-9cpjc0`, puis `npm install`.
3. Photos HEIC : `pip install pillow-heif pillow` (pour `scripts/convert-photos.py`).
4. `npm run fonts` n'est pas nécessaire : les polices sont déjà dans `public/fonts/`.
5. Créer `.env` à partir de `.env.example`. **L'ancienne clé Gemini a été collée dans un chat : lui demander d'en créer une nouvelle** (https://aistudio.google.com/apikey) et de la coller lui-même dans `.env`.
   - Sa clé gratuite n'a **aucun quota sur gemini-3.1-pro** (erreur 429). La liste `GEMINI_MODEL` de `.env.example` bascule automatiquement sur les modèles Flash (gemini-3.8-flash a très bien marché).
6. Rendu : Remotion télécharge son propre Chrome au premier rendu. Si ça bloque, définir `REMOTION_BROWSER` vers un Chrome installé.
7. Ce qui était propre au cloud ne sert plus en local : `NODE_USE_ENV_PROXY`, `NODE_EXTRA_CA_CERTS` et le chemin `/opt/pw-browsers` (`render.mjs` ne l'utilise que s'il existe).

## Prochaines étapes

1. Importer ses vidéos locales : convertir chaque MOV avec la même commande ffmpeg que `scripts/import-drive.mjs` (H.264, 30 i/s, 1080 px de large) vers `public/rushes/samourai/` ou `public/rushes/monegasque/`.
2. `npm run analyze:rushes`, regarder les planches, trier Samouraï et Monégasque.
3. Si la vidéo exemple est disponible : `npm run analyze:ref -- public/refs/exemple.mp4` pour en tirer le style.
4. Monter un **Reel vidéo du Samouraï** (kimono, miroir, plats, baguettes), puis un du **Monégasque** (brunch, versées au ralenti).
5. Musique : demander s'il en a une. Sinon le rythme taiko synthétique se régénère (voir le commit « Make first real edit »), et lui conseiller d'ajouter un son tendance dans Instagram.
6. Effets sonores : clé Freesound gratuite (https://freesound.org/apiv2/apply), puis `npm run sfx -- --pack samourai`.
7. 3 cycles Gemini, rendu final, lui livrer le fichier et le chemin du dossier `out/`.
