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

**Sur ton PC avec DaVinci Resolve : suis [`SETUP-PC.md`](SETUP-PC.md).** Les styles de montage sont dans [`presets/`](presets/README.md).

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

Ensuite, dis simplement à Claude : *« Monte les rushs du Samouraï comme la vidéo exemple. »*

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run import:local -- "C:\dossier" rushes/samourai` | Importe les vidéos/photos d'un dossier du PC (voir `SETUP-PC.md`) |
| `npm run export:resolve -- edits/plan.json` | Timeline DaVinci Resolve (FCPXML) + un MP4 par plan |
| `npm run analyze:ref -- public/refs/x.mp4` | ADN de la vidéo exemple : coupes, durée des plans, BPM, planches |
| `npm run analyze:rushes` | Planches horodatées de chaque rush |
| `npm run render -- edits/plan.json [--preview]` | Rendu (`--preview` = demi-résolution, plus rapide) |
| `npm run review -- out/plan-v1.mp4 edits/plan.json [--ref …]` | Critique Gemini seule |
| `npm run cycle -- edits/plan.json [--ref …]` | Rendu + critique Gemini (un cycle) |
| `npm run sfx -- "whoosh"` / `npm run sfx -- --pack samourai` | Effets sonores CC0 depuis Freesound |
| `npm run studio` | Remotion Studio : prévisualiser et ajuster en direct |
| `npm run demo:media` | Médias de test synthétiques (`public/demo/`) |

## Effets visuels disponibles

- **Transitions** : `cut`, `fade`, `slide`, `wipe`, `flip`, `clockWipe`, `iris`, `pushCut`, `flash`, `zoomPunch`, `whip`
- **Mouvements** : `zoomIn`, `zoomOut`, `panLeft/Right/Up/Down`, `punchIn`, `shake` (avec intensité)
- **Vitesse** : ralenti (`speed: 0.5`), accéléré (`speed: 2`)
- **Étalonnage par resto** : Monégasque chaud et doré, Samouraï contrasté rouge et noir. Réglable par clip.
- **Textes animés** : `title` (lettre par lettre), `kanji`, `caption`, `price` (badge), `tag`
- **Habillage** : grain de film animé, vignettage, bandes cinéma, cartes intro/outro

## Sites d'effets sonores gratuits

| Site | Licence | Usage commercial (pub de resto) |
| --- | --- | --- |
| [Freesound](https://freesound.org) | CC0 filtré par défaut | Oui (CC0) |
| [Pixabay Sound Effects](https://pixabay.com/sound-effects/) | Licence Pixabay | Oui, sans attribution |
| [Mixkit](https://mixkit.co/free-sound-effects/) | Licence Mixkit | Oui |
| [Uppbeat](https://uppbeat.io) | Gratuit avec crédit | Oui, avec crédit |

Les sons téléchargés à la main vont dans `public/sfx/`. Note leur source dans `public/sfx/LICENSES.md`.
Pour les Reels, la musique tendance d'Instagram ou TikTok peut aussi être ajoutée directement dans l'app au moment de publier.

## Structure

```
src/            Composition Remotion (RestoEdit), thèmes, transitions, effets
edits/          Plans de montage JSON (un par vidéo)
scripts/        Analyse ffmpeg, rendu, boucle Gemini, effets sonores
CLAUDE.md       Règles de montage et workflow suivis par Claude
```
