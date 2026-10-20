# Resto Edit Studio : règles pour Claude

> **Avant chaque montage, lire `PREFERENCES.md`** : ce que l'utilisateur a appris à Claude. Ces préférences passent avant tout le reste de ce fichier.

Claude est le monteur principal. Remotion rend la vidéo à partir d'un **plan de montage JSON** (`edits/*.json`), Gemini regarde chaque rendu et le critique. Claude ne voit pas les vidéos directement : il les « voit » grâce aux planches d'images horodatées (`analysis/**.jpg`, à ouvrir avec Read) et aux rapports chiffrés.

## Le workflow complet

0. **Import depuis le PC (session locale, recommandé)** : `npm run import:local -- "<dossier de l'utilisateur>" --to rushes/<resto>`. Aucune limite de taille. Les vidéos sont converties en MP4 H.264 30 i/s, les photos (HEIC, JPG, PNG) en JPG redressés dans `rushes/<resto>/photos/`. Si l'utilisateur ne précise pas le dossier, regarder Téléchargements, Images et Vidéos, puis lui demander confirmation. La vidéo exemple va dans `--to refs`.
   **Import depuis Google Drive** (session cloud) : l'utilisateur range ses vidéos dans un dossier Drive par restaurant, partagé « Tous les utilisateurs disposant du lien ».
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
   - **Sons : uniquement de vrais enregistrements, jamais de son synthétisé ou généré par IA** (ne plus fabriquer de sons avec ffmpeg). Sites et licences : section « Sons et musiques » du README.
   - Musique : `public/music/library.json` (BPM détecté). Caler les durées de plans sur des multiples du beat (`60 / BPM`). Si aucune musique : demander à l'utilisateur, ou lui proposer des titres Pixabay Music / YouTube Audio Library à télécharger, puis `npm run audio:add -- <fichier> --music --source … --license …`.
   - Effets sonores : `public/sfx/library.json` (sinon `npm run sfx -- "<recherche>"` ou `--pack <resto>` avec une clé Freesound, ou des sons téléchargés à la main via `npm run audio:add`). Un whoosh sur chaque transition whip/slide, un impact sur les punchIn, sans en mettre partout. Les sons réels de la scène (grésillement du wok, versée du café, verres) valent mieux que des effets « de montage ».
   - `node scripts/timeline-info.mjs edits/<plan>.json` donne le début réel de chaque plan (transitions déduites) : s'en servir pour caler coupes, textes et SFX sur le beat. Une coupe sans transition ne chevauche pas : le plan précédent doit alors durer un multiple exact du beat.
4. **Contrôle interne** avant Gemini : `npm run render -- edits/<plan>.json --preview`, puis une planche du rendu (voir « Vérifier un rendu ») et la regarder. Corriger les défauts évidents tout de suite.
5. **Boucle qualité, 3 cycles** : `npm run cycle -- edits/<plan>.json [--ref public/refs/<exemple>.mp4]`
   - Lire `reviews/<plan>-vN.json`. Corriger d'abord les problèmes `bloquant`, puis `important`. Pour les `mineur`, n'appliquer que ce qui améliore vraiment.
   - Incrémenter `version` dans le plan, puis relancer `npm run cycle`.
   - Arrêter après 3 cycles, ou plus tôt si le verdict est `pret_a_publier` avec une note ≥ 8.
   - Ne pas suivre aveuglément Gemini : s'il contredit le brief ou la référence, garder le brief et le noter dans le compte rendu.
6. **Rendu final** en pleine résolution : `npm run render -- edits/<plan>.json`. Fichier final : `out/<plan>-vN.mp4`.
7. **Livraison** : donner le fichier final à l'utilisateur. En local, copier `out/<plan>-vN.mp4` dans un dossier facile à trouver (par défaut `Vidéos/Resto Edit Studio/`) et donner le chemin. En cloud, l'envoyer avec SendUserFile. Compte rendu en français : notes v1 → v3, ce qui a changé à chaque cycle, ce qui reste à améliorer.
8. **Apprendre de ses remarques** : quand l'utilisateur commente une vidéo (« trop rapide », « plus de plats », « j'aime cette transition »…) :
   - corriger le plan, puis livrer une nouvelle version ;
   - **ajouter la leçon dans `PREFERENCES.md`**, sous le bon resto ou sous « Général », formulée comme une règle réutilisable, avec la date et la vidéo d'origine. Si elle contredit une règle existante, remplacer l'ancienne ;
   - si une préférence revient souvent, ajuster aussi les valeurs par défaut (`src/themes.ts`, règles de `CLAUDE.md`) ;
   - committer `PREFERENCES.md` avec le plan corrigé.

## Montages depuis la bibliothèque de clips (méthode qui fonctionne)

Le générateur automatique (`npm run edits:generate`) plafonne autour de 5-6/10 en fluidité selon Gemini. Les montages publiables (8,5+/10) se font **à la main**, plan par plan, dans `edits/models/` :
1. Choisir **un thème** et raconter une progression : accroche → arrivée (extérieur, entrée, salle) → l'expérience (personnes, déco) → la table → les plats et les gestes → plan final large et lumineux + carte « Réserve ta table ». Jour avant nuit.
2. Lister les clips du thème (`public/library/<resto>/catalogue.json`) et regarder leurs photos (`scripts/library/sheet.py`) avant de choisir : vérifier qu'aucun logo de l'**autre** restaurant n'apparaît (les deux restos partagent sets de table et façade), pas de reste de texte, d'émoji ou de filigrane, pas d'angle penché.
3. Uniquement des coupes franches, durées multiples du beat (1 s et 1,5 s à 120 BPM, 2 s pour la fin), aucun `motion`, un seul `grade.curve` pour tout le montage. Ralenti seulement sur le hook (geste).
4. Jamais deux plans du même plat ou de la même vidéo d'origine à la suite (effet jump-cut).
5. Temps fort possible : `panels` + `layout` (`rows` = triptyque de bandes horizontales, `grid` = mosaïque 2x2), juste après le hook ; chaque panneau doit avoir assez de rush pour toute la durée (ralentir avec `speed` si besoin).
6. Pour masquer un bord gênant : `reframe: { scale: 1.08-1.15, origin: "left bottom" }` (recadrage fixe, sans mouvement).
7. Étalonnage : un seul `grade.curve` par montage, choisi pour le thème (vibrant = déco colorée et plats frais, portra = peaux et blancs, golden/film = douceurs, tealOrange/tokyo = nuit, moody = mystère) ; puis `node scripts/library/match-shots.mjs <plan>` pour égaliser les expositions (correction douce), et retouches fines plan par plan (`grade.brightness`, `saturate`).
8. Ralentis (`speed` < 1) uniquement sur des plans posés ou des gestes lents : sur un plan tenu à la main, ils saccadent (rushs à 30 i/s). Un micro-zoom (`motion: zoomIn`, intensité 0,6) est toléré seulement pour prolonger un vrai mouvement de caméra qui s'arrête avant la coupe.
9. Boucle : `node scripts/render.mjs edits/models/<plan>.json` puis `node scripts/gemini-review.mjs out/<plan>-vN.mp4 edits/models/<plan>.json`, appliquer les corrections `bloquant`/`important`, incrémenter `version`, recommencer jusqu'à fluidité ≥ 8.

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
- Finir sur un appel à l'action : réserver, l'adresse, le @ du compte.
- Durée cible : 12 à 25 s pour un Reel, sauf si la référence dit autrement.

## Règles techniques

- Les chemins `src` sont relatifs à `public/`. Les vidéos ont besoin de `start` et `end` en secondes **dans le rush source** ; à l'écran, la durée vaut `(end - start) / speed`.
- Après chaque modification du code : `npm run typecheck`.
- Ne jamais committer de rushs, de musiques ou de rendus (voir `.gitignore`). Les plans `edits/*.json` sont versionnés.
- Les clés API restent dans `.env` (jamais dans le code ni dans git).
