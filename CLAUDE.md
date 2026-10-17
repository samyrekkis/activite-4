# Resto Edit Studio : règles pour Claude

Claude est le monteur principal. Remotion rend la vidéo à partir d'un **plan de montage JSON** (`edits/*.json`), Gemini regarde chaque rendu et le critique. Claude ne voit pas les vidéos directement : il les « voit » grâce aux planches d'images horodatées (`analysis/**.jpg`, à ouvrir avec Read) et aux rapports chiffrés.

## Le workflow complet

0. **Import depuis Google Drive** : l'utilisateur range ses vidéos dans un dossier Drive par restaurant, partagé « Tous les utilisateurs disposant du lien ».
   - Lister le dossier avec le connecteur Drive (`search_files`, `parentId = '<id du dossier>'`) pour obtenir les identifiants des fichiers.
   - `npm run import -- rushes/<resto> <id>:<nom> …` (la vidéo exemple va dans `refs`). Les MOV d'iPhone sont convertis en MP4 H.264 30 i/s.
   - En cas de doute sur le resto : décor asiatique = Samouraï, tout le reste = Monégasque.
   - Sans partage public : le connecteur Drive (`download_file_content`) télécharge les fichiers de **moins de 10 Mo** (photos). Le résultat est sauvé dans un fichier JSON : `python3 -I scripts/decode-drive.py <fichier> public/.raw`, puis `python3 scripts/convert-photos.py public/.raw public/photos/<dossier>` (HEIC vers JPG redressé).
1. **Référence** (si fournie) : `npm run analyze:ref -- public/refs/<exemple>.mp4`
   - Lire `analysis/ref-<nom>/report.json` (durée moyenne des plans, BPM, % de coupes sur le beat) et **ouvrir chaque planche** `shots-*.jpg`.
   - En tirer une fiche de style : durée totale, durée des plans, type de transitions, style et position des textes, étalonnage, structure (accroche, déroulé, appel à l'action).
2. **Rushs** : `npm run analyze:rushes` (ou `-- public/rushes/<dossier>`)
   - Ouvrir les planches `analysis/rushes/*.jpg` et choisir les meilleurs moments (in/out précis grâce aux timestamps).
   - Écarter les plans flous, tremblés, surexposés, ou avec des personnes non désirées.
3. **Plan v1** : écrire `edits/<resto>-<sujet>.json` avec `"version": 1` (voir `src/types.ts`).
   - Musique : `public/music/`. Si la musique a un BPM connu, caler les durées de plans sur des multiples du beat (`60 / BPM`).
   - Effets sonores : `public/sfx/library.json` (sinon `npm run sfx -- "<recherche>"` ou `--pack <resto>`). Un whoosh sur chaque transition whip/slide, un impact sur les punchIn, sans en mettre partout.
   - `node scripts/timeline-info.mjs edits/<plan>.json` donne le début réel de chaque plan (transitions déduites) : s'en servir pour caler coupes, textes et SFX sur le beat. Une coupe sans transition ne chevauche pas : le plan précédent doit alors durer un multiple exact du beat.
4. **Contrôle interne** avant Gemini : `npm run render -- edits/<plan>.json --preview`, puis une planche du rendu (voir « Vérifier un rendu ») et la regarder. Corriger les défauts évidents tout de suite.
5. **Boucle qualité, 3 cycles** : `npm run cycle -- edits/<plan>.json [--ref public/refs/<exemple>.mp4]`
   - Lire `reviews/<plan>-vN.json`. Corriger d'abord les problèmes `bloquant`, puis `important`. Pour les `mineur`, n'appliquer que ce qui améliore vraiment.
   - Incrémenter `version` dans le plan, puis relancer `npm run cycle`.
   - Arrêter après 3 cycles, ou plus tôt si le verdict est `pret_a_publier` avec une note ≥ 8.
   - Ne pas suivre aveuglément Gemini : s'il contredit le brief ou la référence, garder le brief et le noter dans le compte rendu.
6. **Rendu final** en pleine résolution : `npm run render -- edits/<plan>.json`. Fichier final : `out/<plan>-vN.mp4`.
7. **Compte rendu** à l'utilisateur, en français : notes v1 → v3, ce qui a changé à chaque cycle, chemin du fichier final.

## Vérifier un rendu (sans Gemini)

```bash
node -e 'import("./scripts/lib/contact-sheet.mjs").then(m=>m.contactSheet("out/X.mp4",[0.3,1,2,3,4,5,6,7,8,9,10,11],"analysis/check.jpg",{cols:6,thumbWidth:300}))'
```
Puis ouvrir `analysis/check.jpg` avec Read. Vérifier : textes lisibles et non coupés, pas d'image noire, étalonnage cohérent, fin propre.

## Identité des restaurants

**Le Monégasque** : brunchs, plats généreux, décoration magnifique.
- Ton : élégant, chaleureux, gourmand. Rythme posé (plans de 1,2 à 2,5 s), transitions douces (`fade`, `slide`, `wipe`), ralentis sur les versées (sirop, café, jus) en `speed: 0.5`.
- Plans forts : vue d'ensemble de la déco, table dressée vue du dessus, plat qui arrive, cuillère ou fourchette qui plonge, verres qui trinquent.
- Textes : `caption` pour le nom des plats, `price` pour les formules, outro avec les horaires du brunch.

**Le Samouraï** : cuisine asiatique, shootings en kimono, miroir de maquillage, chambre avec table basse où l'on s'assoit au sol.
- Ton : cinématographique, mystérieux, énergique. Rythme rapide (plans de 0,4 à 1,2 s) calé sur le beat, `whip`, `zoomPunch`, `flash`, `punchIn` sur les temps forts.
- Plans forts : enfiler le kimono, reflet dans le miroir, maquillage, entrée dans la chambre, s'asseoir à la table basse, plat posé, baguettes qui saisissent.
- Textes : `title` ou `kanji` (侍, 寿司, 味…), `tag` pour l'expérience (« Shooting kimono inclus »), `price` pour le menu.

## Règles de montage pour les reels de resto

- Accroche dans les 1,5 premières secondes : le plat le plus appétissant ou le geste le plus fort d'abord, pas un logo. L'`intro` reste courte (≤ 1,5 s) ou est supprimée si la référence n'en a pas.
- Food appeal : saturation et chaleur sur les plats, jamais de peau orange. Baisser `grade.saturate` sur les plans avec des visages si besoin.
- Garder les textes dans la zone sûre des Reels : rien dans les 12 % du haut ni les 20 % du bas (positions `top`/`bottom` déjà calibrées). Pas plus de 6 mots à l'écran.
- Ne pas répéter le même mouvement de caméra sur deux clips consécutifs.
- Montage rapide « Reels » : un plan par temps, enchaînés par `blurCut` (flou de bougé de 4 images, `duration: 0.1333` à 30 i/s) en alternant `from-top` et `from-left`/`from-right`. Pour qu'une coupe tombe sur le temps, un plan suivi d'une transition dure `n × beat + durée de la transition`.
- Pour étudier les transitions d'une référence, extraire les images une par une autour de chaque coupe (`ffmpeg -ss <t> -frames:v 1 -vf "scale=300:-2,tile=6x1"`) : l'analyse automatique ne voit pas les coupes d'une vidéo filmée dans un bandeau (enregistrement d'écran).
- Stickers, GIF, logos : `stickers` dans le plan (`src`, `at`, `duration`, `x`, `y`, `width`, `rotate`, `animation`). Jamais de personnage sous droits (Naruto…) dans une pub.
- Finir sur un appel à l'action : réserver, l'adresse, le @ du compte.
- Durée cible : 12 à 25 s pour un Reel, sauf si la référence dit autrement.

## Règles techniques

- Les chemins `src` sont relatifs à `public/`. Les vidéos ont besoin de `start` et `end` en secondes **dans le rush source** ; à l'écran, la durée vaut `(end - start) / speed`.
- Après chaque modification du code : `npm run typecheck`.
- Ne jamais committer de rushs, de musiques ou de rendus (voir `.gitignore`). Les plans `edits/*.json` sont versionnés.
- Les clés API restent dans `.env` (jamais dans le code ni dans git).
