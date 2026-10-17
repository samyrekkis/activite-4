# Presets : les recettes de montage

Un preset est la recette d'un style de vidéo : rythme, transitions, mouvements, textes, sons, étalonnage, structure, et **les erreurs à ne plus refaire**. Claude le lit **avant** d'écrire le plan v1, pour que la vidéo sorte bien du premier coup au lieu de tout redécouvrir à chaque fois.

| Preset | Pour quoi | Durée |
| --- | --- | --- |
| [`food.md`](food.md) | Mettre un plat ou une boisson en vedette (sushi, brunch, cocktail, burger…) | 10 à 20 s |
| [`samourai-reel-rapide.md`](samourai-reel-rapide.md) | Pub Samouraï nerveuse : déco, kimono, ambiance | 15 s |
| [`story-blurcut.md`](story-blurcut.md) | Story/Reel « un plan par temps » avec flous de bougé, façon I Love Burger | 8 à 12 s |
| [`monegasque-elegant.md`](monegasque-elegant.md) | Le Monégasque : déco, cocktail, brunch, ambiance chaleureuse | 15 s |

## Comment s'en servir

- L'utilisateur dit : « fais un Reel **food** avec les rushs du Samouraï » → Claude lit `presets/food.md` puis `CLAUDE.md`, et suit la recette.
- Sans preset nommé, Claude choisit le plus proche et le dit dans son compte rendu.

## Faire grandir un preset

À la fin de chaque vidéo validée, Claude ajoute dans la section **Leçons** du preset ce que l'utilisateur a corrigé (« trop lent », « titre caché par l'enseigne »…). Une leçon = une règle courte et vérifiable. C'est ce qui rend chaque montage meilleur que le précédent.

Pour créer un nouveau preset : copier le plus proche, changer le nom, ajuster les valeurs, et partir d'une vidéo exemple (`public/refs/`) si possible.
