# Preset : Samouraï reel rapide

Pub de 15 s, nerveuse et fluide, validée par l'utilisateur (`edits/samourai-pub.json`, v4).

## Réglages

- **Musique** : taiko 120 BPM (`music/samourai-taiko-120bpm.mp3`), 1 temps = 0,5 s = 15 images.
- **Plans** : 0,5 à 1,5 s (1 à 3 temps). Environ 16 plans pour 13,5 s + outro 2 s.
- **Calage** : un plan suivi d'une transition dure `temps × 0,5 + durée de la transition`. Transitions à 0,3 s (9 images) ou 0,2 s : jamais 0,25 s (pas un nombre entier d'images, ça décale le beat).
- **Transitions** : coupes sèches la plupart du temps ; `whip` 0,3 s en alternant `from-right`/`from-left` (suivre le sens du mouvement de caméra) ; `zoomPunch` 0,3 s sur la cliente en kimono ; `flash` 0,2 s une fois ; `slide from-bottom` vers la terrasse.
- **Vitesse** : `speed: 1.5` sur les plans filmés en marchant (escaliers, salle), `1.2` sur les plans lents. Accélérer rend le mouvement plus vif et plus fluide.
- **Mouvements** : `punchIn`, `zoomIn`, `zoomOut`, `panLeft`/`panRight`/`panUp`, en alternance.
- **Textes** : « LE SAMOURAÏ » (`title`, 1,5 s minimum) sur la fresque en ouverture ; « Shooting kimono inclus » (`caption` en bas, le `tag` est trop petit) ; 侍 en `kanji` sur la descente des néons ; outro « Réserve ta table / Asian Luxury ».
- **Sons** : whoosh sur chaque whip, katana sur le `zoomPunch`, taiko sur le `flash`, gong sur l'outro.
- **Look** : `grain: 0.07`, `vignette: 0.42`.

## Plans qui marchent (rushs de `public/rushes/samourai`)

Fresque du samouraï (IMG_2357 0,2 s), escalier fresque (IMG_2366 4,2 s), geisha lumineuse (IMG_2332 2,2 s), portant kimonos (IMG_2343 0 s), loge miroir (IMG_2344 0,9 s), cliente en kimono (dji-145212 0 s), descente néons (IMG_2357 3 s), terrasse (IMG_2340 4 s), fresque finale (IMG_2368 5 s).

## À éviter

- IMG_2343 après 4,5 s, IMG_2368 de 0,5 à 2,1 s, IMG_2367 de 0 à 0,6 s, IMG_2332 de 4,2 à 6,4 s : le caméraman ou un homme apparaît (reflet ou champ).
- IMG_2364 avant 2,3 s : le cadre Instagram « Le Monégasque ».
- dji-145124 juste après dji-145212 : même plan.

## Leçons

- v1 trop sage pour l'utilisateur : rythme et fluidité avant tout (plans ≤ 1,5 s, vitesse accélérée, transitions avec accélération).
