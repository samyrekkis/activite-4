# Resto Edit Studio

Workflow de montage vidéo pour **Le Monégasque** et **Le Samouraï**.
**Claude** monte, **Remotion** rend la vidéo, **Gemini** la regarde et la critique. Trois cycles de correction, puis la version finale.

```
 rushs + vidéo exemple
          │
          ▼
  analyse (ffmpeg) ──► planches d'images + rythme/BPM ──► Claude écrit le plan JSON
                                                                │
                      ┌─────────────────────────────────────────┘
                      ▼
               Remotion rend la vidéo ──► Gemini critique (note /10, problèmes horodatés)
                      ▲                                │
                      └──── Claude corrige le plan ◄───┘   × 3 cycles
                                                       │
                                                       ▼
                                             out/<plan>-v3.mp4
```

## Installation (une fois)

```bash
npm install
cp .env.example .env      # puis colle tes clés dedans
```

| Clé | Gratuit | Où l'obtenir | Sert à |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | oui | https://aistudio.google.com/apikey | Critique vidéo |
| `FREESOUND_API_KEY` | oui | https://freesound.org/apiv2/apply | Recherche d'effets sonores |

## Ce que tu fournis

| Dossier | Contenu |
| --- | --- |
| `public/rushes/` | Les vidéos brutes (un sous-dossier par tournage si tu veux) |
| `public/refs/` | La ou les vidéos exemples dont il faut copier le style |
| `public/music/` | La musique (sinon Claude en propose une libre de droits) |
| `public/brand/` | Logos, photos du lieu |

Ensuite, dis simplement à Claude : *« Monte les vidéos du Samouraï qui sont dans mon dossier Téléchargements. »*
Commente chaque vidéo livrée : Claude corrige, et enregistre tes remarques dans `PREFERENCES.md` pour les montages suivants.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run import:local -- "<dossier>" --to rushes/samourai` | Import des vidéos et photos depuis le PC, sans limite de taille |
| `npm run analyze:ref -- public/refs/x.mp4` | ADN de la vidéo exemple : coupes, durée des plans, BPM, planches |
| `npm run analyze:rushes` | Planches horodatées de chaque rush |
| `npm run render -- edits/plan.json [--preview]` | Rendu (`--preview` = demi-résolution, plus rapide) |
| `npm run review -- out/plan-v1.mp4 edits/plan.json [--ref …]` | Critique Gemini seule |
| `npm run cycle -- edits/plan.json [--ref …]` | Rendu + critique Gemini (un cycle) |
| `npm run sfx -- "whoosh"` / `npm run sfx -- --pack samourai` | Vrais effets sonores CC0 depuis Freesound (sons synthétiques écartés) |
| `npm run audio:add -- <fichiers> [--music] --source … --license …` | Ajouter des sons ou musiques téléchargés à la main |
| `npm run studio` | Remotion Studio : prévisualiser et ajuster en direct |
| `npm run demo:media` | Médias de test synthétiques (`public/demo/`) |
| `npm run edits:generate -- --resto monegasque --count 14` | Template : fabrique des montages variés (hook + recette + look ciné + cartes sociales) depuis la bibliothèque de clips |
| `npm run edits:render -- --resto monegasque` | Rend tous les montages générés dans `Studio Resto/Montages/<Resto>` |
| `npm run photos:enhance -- "<dossier>"` | Retouche des photos par Gemini Image (facturation Google requise) |

## Bibliothèque de clips (template)

Les vidéos Instagram sont découpées en clips bruts (un par plan), sans transitions, sans texte, sans logo, sans son :

1. `python scripts/library/extract_clips.py <vidéo> <dossier> [0.6]` : coupes, carte de fin retirée, filigrane effacé trait par trait, titres retirés par recadrage (le chiffre = hauteur minimale gardée).
2. Les clips sont nommés (catégorie, sujet, vue, jour/nuit, qualité 0-3), puis `python scripts/library/build_library.py <resto> <dossier> <noms.json> "<Studio Resto>"` les range dans `Clips bruts/` et `Photos extraites/` avec des noms lisibles, et écrit `public/library/<resto>/catalogue.json` (couleur et mouvement mesurés).
3. `python scripts/library/retouch_photos.py "<Photos extraites>" "<Photos retouchées>"` : retouche locale gratuite, formats post 4:5 et story 9:16.

Le générateur combine 6 hooks, 15 recettes, 18 transitions (horizontales, verticales, rotation, stores, glitch…), 7 courbes d'étalonnage ciné (`src/grading.tsx`) et des cartes sociales (`src/components/SocialLayer.tsx`). Un clip n'est jamais réutilisé dans un même montage, et les moins utilisés passent en premier.

## Effets visuels disponibles

- **Transitions** : `cut`, `fade`, `slide`, `wipe`, `flip`, `clockWipe`, `iris`, `pushCut`, `flash`, `zoomPunch`, `whip`
- **Mouvements** : `zoomIn`, `zoomOut`, `panLeft/Right/Up/Down`, `punchIn`, `shake` (avec intensité)
- **Vitesse** : ralenti (`speed: 0.5`), accéléré (`speed: 2`)
- **Étalonnage par resto** : Monégasque chaud et doré, Samouraï contrasté rouge et noir. Réglable par clip.
- **Textes animés** : `title` (lettre par lettre), `kanji`, `caption`, `price` (badge), `tag`
- **Habillage** : grain de film animé, vignettage, bandes cinéma, cartes intro/outro

## Sons et musiques : uniquement de vrais enregistrements

Règle du projet : **aucun son synthétique ni généré par IA**. Seulement de vrais enregistrements (bruitages, ambiances, instruments réels), gratuits et utilisables pour la pub d'un resto.

**Effets sonores (whoosh, gong, grésillement, verres, café…)**

| Site | Pourquoi | Licence pour un usage pro |
| --- | --- | --- |
| [Freesound](https://freesound.org) | Des milliers de vrais enregistrements, branché automatiquement (`npm run sfx`) | CC0 filtré par défaut : libre, sans crédit |
| [Sonniss GDC Bundle](https://sonniss.com/gameaudiogdc) | Des dizaines de Go de bruitages studio pro, gratuits | Libre de droits, usage commercial OK |
| [Pixabay Sound Effects](https://pixabay.com/sound-effects/) | Très bon catalogue de whoosh et de bruitages réels | Licence Pixabay : commercial OK, sans crédit |
| [Mixkit](https://mixkit.co/free-sound-effects/) | Bruitages courts et propres | Licence Mixkit : commercial OK |
| [ZapSplat](https://www.zapsplat.com) | Énorme catalogue de foley | Gratuit avec crédit |

À éviter : BBC Sound Effects (usage commercial interdit) et les sons marqués « synth », « 8-bit » ou « sci-fi ».

**Musique**

| Site | Licence |
| --- | --- |
| [Pixabay Music](https://pixabay.com/music/) | Commercial OK, sans crédit |
| [YouTube Audio Library](https://studio.youtube.com) (onglet Bibliothèque audio) | Libre de droits (vérifier « crédit requis ») |
| [Uppbeat](https://uppbeat.io) | Gratuit avec crédit |
| Son tendance Instagram / TikTok | Ajouté dans l'app au moment de publier : c'est ce qui marche le mieux pour la portée |

**Ajouter un son téléchargé à la main :**
```bash
npm run audio:add -- "C:/Users/moi/Downloads/whoosh.mp3" --source "Pixabay" --license "Pixabay Content License"
npm run audio:add -- "C:/Users/moi/Downloads/musique.mp3" --music --source "Pixabay Music" --license "Pixabay Content License"
```
Chaque son est nettoyé (silence de début coupé, volume harmonisé), puis enregistré avec sa licence dans `public/sfx|music/LICENSES.md`. Pour une musique, le tempo (BPM) est détecté pour caler les coupes sur le beat.

## Structure

```
src/            Composition Remotion (RestoEdit), thèmes, transitions, effets
edits/          Plans de montage JSON (un par vidéo)
scripts/        Analyse ffmpeg, rendu, boucle Gemini, effets sonores
CLAUDE.md       Règles de montage et workflow suivis par Claude
```
