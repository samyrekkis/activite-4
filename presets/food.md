# Preset : food

Faire saliver en 10 à 20 s. Le plat (ou la boisson) est la star : on le voit en premier, de près, en mouvement, et on entend qu'il est bon.

## Rushs à demander au tournage

Si un de ces plans manque, le dire à l'utilisateur **avant** de monter (ne pas remplacer un plat par de la déco).

1. **Le geste qui fait saliver** : baguettes qui saisissent un sushi, fourchette qui plonge, fromage qui file, sauce versée, cocktail qu'on remue. 3 à 5 s, téléphone stable, très près.
2. **Le plat posé sur la table**, vu du dessus, puis vu à 45°.
3. **Une personne qui goûte** et réagit, face caméra ou de trois quarts (accord de la personne).
4. **Le détail** : vapeur, bulles, glaçons, texture croustillante. Ralenti iPhone (120/240 i/s) si possible.
5. **Le contexte** : salle, comptoir, serveur qui apporte le plat (2 ou 3 plans courts).
6. **La fin** : façade ou enseigne, pour l'appel à réserver.

## Structure (≈ 15 s)

| Temps | Plan | Durée | Effet |
| --- | --- | --- | --- |
| 0 – 1,5 s | **Accroche** : le geste le plus appétissant (1) | 1 à 1,5 s | `punchIn`, impact sonore, pas de logo |
| 1,5 – 6 s | Plat, détail, autre angle (2, 4) | 0,5 à 1 s chacun | coupes sur le temps, `zoomIn` lent |
| 6 – 9 s | Ralenti sur la versée ou la texture (4) | 1,5 à 2 s | `speed: 0.5`, pas de transition |
| 9 – 12 s | Quelqu'un goûte (3), puis contexte (5) | 1 à 1,5 s | `blurCut` ou `zoomPunch` |
| 12 – 15 s | Façade + appel à l'action (6) | 2 à 3 s | outro « Réserve ta table » |

## Réglages

- **Rythme** : musique 100 à 128 BPM. Plans de 1 à 2 temps ; le ralenti sur 3 à 4 temps (respiration au milieu).
- **Transitions** : surtout des coupes sèches sur le temps. `blurCut` (`duration: 0.1333`) pour changer de plat ou de lieu, `zoomPunch` sur l'arrivée du plat star. Jamais de `fade` au milieu (ça ralentit), seulement vers l'outro.
- **Mouvements** : `punchIn` sur les temps forts, `zoomIn` lent sur les plats. Alterner, jamais deux fois le même d'affilée.
- **Vitesse** : `speed: 0.5` sur les versées, le fromage qui file, la vapeur ; `speed: 1.3 à 1.5` sur les plans de salle filmés en marchant.
- **Étalonnage** : chaud et saturé sur la nourriture (`saturate: 1.15`, `contrast: 1.05`, teinte `rgba(255,150,60,0.10)` en `soft-light`). Sur les visages, revenir à `saturate: 1.0` (jamais de peau orange).
- **Textes** (6 mots max, zone sûre) : nom du plat en `caption` en bas, au moment où on le voit le mieux ; prix en `price` une seule fois ; Samouraï : un `kanji` (寿司, 味, 侍) sur un temps fort.
- **Sons** : impact sur l'accroche ; un vrai son du plat si le rush en a un (grésillement, croustillant : `muted: false`, `volume: 0.6`) ; tintement de verres sur un cocktail ; whoosh discret sur les `blurCut` (un sur deux, volume 0.3).
- **Stickers** : logo du resto en petit dans l'outro ; pas de personnage sous droits (Naruto, Disney…).

## Leçons

- Sans plan de nourriture, ne pas faire de vidéo « food » avec la déco : demander les rushs (ou proposer un autre preset).
- Le titre d'accroche doit rester au moins 1,5 s à l'écran, sinon il n'est pas lu.
- Pas de texte par-dessus une enseigne ou un néon déjà lisible.
- Vérifier les reflets (miroirs, vitres) : personne non désirée = plan à couper.
- Deux plans presque identiques à la suite = en retirer un.
