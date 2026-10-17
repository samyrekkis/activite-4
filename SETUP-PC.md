# Installer le studio sur ton PC (Windows)

Objectif : Claude travaille **sur ton PC**, prend les vidéos **dans tes dossiers**, et te donne une timeline à ouvrir dans **DaVinci Resolve**. Tu peux lui parler depuis ton téléphone.

À faire une seule fois (≈ 20 min).

## 1. Installer les logiciels

Ouvre **PowerShell** (touche Windows, tape « PowerShell ») et colle ces lignes une par une :

```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
winget install Gyan.FFmpeg
winget install Python.Python.3.12
```

Puis **ferme et rouvre PowerShell** (pour qu'il trouve les nouveaux programmes) et vérifie :

```powershell
node -v      # v22 ou plus
ffmpeg -version
git --version
```

Installe aussi :
- **DaVinci Resolve** (gratuit) : https://www.blackmagicdesign.com/products/davinciresolve
- **Claude** : l'application **Claude Desktop** (https://claude.ai/download), ou Claude Code en ligne de commande : `npm install -g @anthropic-ai/claude-code`

## 2. Récupérer le projet

```powershell
cd $HOME\Documents
git clone https://github.com/samyrekkis/activite-4.git
cd activite-4
git checkout claude/busy-turing-o8cryh
npm install
pip install pillow pillow-heif
copy .env.example .env
notepad .env
```

Dans `.env`, colle tes clés (elles restent sur ton PC, jamais dans git) :
- `GEMINI_API_KEY` : https://aistudio.google.com/apikey (critique automatique des vidéos)
- `FREESOUND_API_KEY` : https://freesound.org/apiv2/apply (vrais effets sonores)

Le premier rendu télécharge tout seul un navigateur pour Remotion (une fois, ~100 Mo).

## 3. Lancer Claude dans le projet

**Avec Claude Desktop** : onglet **Code**, choisis le dossier `Documents\activite-4`.

**Ou en ligne de commande** :
```powershell
cd $HOME\Documents\activite-4
claude
```

**Pour lui parler depuis ton téléphone** : dans le dossier du projet, lance `claude remote-control`. La session apparaît dans l'app Claude sur ton téléphone ; tout s'exécute sur ton PC.

## 4. Travailler

Range tes vidéos où tu veux sur le PC, par exemple `C:\Users\<toi>\Videos\Samourai`, puis dis à Claude :

> Importe les vidéos de `C:\Users\<toi>\Videos\Samourai` dans le Samouraï et fais un reel avec le preset food.

Claude lance lui-même :
```powershell
npm run import:local -- "C:\Users\<toi>\Videos\Samourai" rushes/samourai
```
puis analyse, monte, vérifie, et exporte pour Resolve :
```powershell
npm run export:resolve -- edits/samourai-food.json
```

## 5. Ouvrir dans DaVinci Resolve

1. Crée un projet en **1080 × 1920, 30 i/s** (Réglages du projet > Format de la timeline > résolution personnalisée).
2. **Fichier > Importer > Timeline…** et choisis `out\resolve\<plan>\<plan>.fcpxml`. Si Resolve demande où sont les médias, indique le même dossier.

Tu obtiens :
- les plans déjà coupés au bon endroit, à la bonne vitesse, sur le temps de la musique ;
- la musique et les effets sonores sur les pistes audio ;
- des **marqueurs** sur chaque plan : transition prévue (blurCut, whip…), textes à poser, mouvement de caméra.

Les plans sont livrés **sans étalonnage** (à faire dans l'onglet Color). Les transitions maison (blurCut, whip) et les textes sont indiqués par les marqueurs : à poser dans Resolve, ou garde la version rendue par Remotion (`out\<plan>-vN.mp4`), qui les contient déjà.
