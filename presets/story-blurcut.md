# Preset : story « un plan par temps » (blurCut)

Copié de la vidéo exemple `public/refs/essai-2.mp4` (I Love Burger). Résultat : `edits/samourai-story.json`.

## Ce que fait la référence

- Un nouveau plan sur **chaque temps** (≈ 0,43 s à 133 BPM).
- Entre deux plans, un **flou de bougé directionnel de 2-3 images**, en alternant vertical et horizontal. L'image ne glisse presque pas : elle se brouille dans un sens.
- Structure : 6 plans de la salle → façade sur 2 temps → vue subjective qui entre (pouce levé).

## Réglages

- **Musique** : 120 à 135 BPM. Avec le taiko 120 BPM, 1 temps = 0,5 s.
- **Transition** : `{"type": "blurCut", "direction": "from-top" | "from-left" | "from-right", "duration": 0.1333}` (4 images, minutage linéaire = 3 images floues). Alterner `from-top` et un horizontal.
- **Calage** : plan d'un temps suivi d'un `blurCut` = `0,5 + 0,1333` s à l'écran ; suivi d'une coupe sèche = multiple exact de 0,5 s.
- **Plans** : 8 plans d'un temps (la variété compte plus que la qualité de chaque plan), puis un plan fort de 2 temps (façade), un plan subjectif de 3 temps (coupe sèche), un plan humain de 2 temps, outro 2 s.
- **Textes** : presque aucun. Une `caption` sur le plan humain. Pas de titre sur la façade (l'enseigne suffit).
- **Sons** : whoosh court (`duration: 0.4`, volume 0.3) sur un `blurCut` sur deux, impact sur la façade, gong à l'outro.
- **Look** : léger (`grain: 0.05`, `vignette: 0.3`).

## Leçons

- Avec un minutage en accélération, le flou ne dure qu'une image : garder `blurCut` en linéaire.
- L'analyse automatique ne voit pas les coupes d'un enregistrement d'écran (vidéo dans un bandeau) : recadrer le bandeau et extraire les images une par une autour des coupes.
