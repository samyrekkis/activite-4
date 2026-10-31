// Sound-effect roles: what each sound is for, how it is searched on Freesound and levelled.
// role: { queries, max: seconds kept, lufs: target loudness, for: restaurant or "common", use: when }
export const ROLES = {
  impact: { for: "common", max: 3, lufs: -14, use: "LE temps fort : plat star, révélation, verdict de l'accroche", queries: ["cinematic impact hit", "deep boom impact", "trailer hit"] },
  riser: { for: "common", max: 4, lufs: -18, use: "montée qui finit pile sur une révélation (at = révélation - durée)", queries: ["riser short", "tension riser", "reverse cymbal"] },
  swoosh: { for: "common", max: 1.2, lufs: -20, use: "UNE transition rapide importante (pas sur chaque coupe)", queries: ["whoosh transition fast", "swoosh short", "air swipe"] },
  pop: { for: "common", max: 1, lufs: -18, use: "un texte, un prix ou un logo qui apparaît", queries: ["pop ui", "bubble pop", "soft click pop"] },
  glitch: { for: "common", max: 1.2, lufs: -18, use: "coupure accroche → contenu, effet digital", queries: ["glitch short", "digital glitch stutter"] },
  shutter: { for: "common", max: 1, lufs: -18, use: "flash, photo, shooting kimono", queries: ["camera shutter", "polaroid shutter"] },
  sizzle: { for: "food", max: 5, lufs: -20, use: "plat chaud, poêle, wok (sous l'image du plat)", queries: ["sizzle pan", "frying sizzle close"] },
  pour: { for: "food", max: 4, lufs: -20, use: "versée de sauce, jus, café, cocktail", queries: ["liquid pour glass", "pouring drink"] },
  clink: { for: "food", max: 2, lufs: -18, use: "verres qui trinquent, glaçons", queries: ["glass clink cheers", "ice cubes glass"] },
  crunch: { for: "food", max: 2, lufs: -18, use: "croquant, tempura, frites, toast", queries: ["crunch bite", "crispy crunch"] },
  gong: { for: "samourai", max: 5, lufs: -16, use: "ouverture ou fin Samouraï", queries: ["gong hit", "temple bell"] },
  taiko: { for: "samourai", max: 2, lufs: -14, use: "impact japonais sur un temps fort", queries: ["taiko drum hit", "japanese drum hit"] },
  katana: { for: "samourai", max: 2, lufs: -16, use: "zoomPunch, coupure nette, révélation kimono", queries: ["katana unsheathe", "sword slash"] },
  shamisen: { for: "samourai", max: 3, lufs: -18, use: "touche japonaise sur un plan calme", queries: ["shamisen pluck", "koto pluck"] },
  chopsticks: { for: "samourai", max: 2, lufs: -18, use: "baguettes qui saisissent, ASMR", queries: ["chopsticks", "wooden sticks tap"] },
  cork: { for: "monegasque", max: 2, lufs: -16, use: "bouteille qui s'ouvre, fête, brunch", queries: ["champagne cork pop", "bottle open pop"] },
  cutlery: { for: "monegasque", max: 2, lufs: -20, use: "couverts, assiette posée", queries: ["cutlery plate clink", "fork plate"] },
  coffee: { for: "monegasque", max: 4, lufs: -20, use: "machine à café, versée de café", queries: ["espresso machine", "coffee pour cup"] },
  ambience: { for: "monegasque", max: 10, lufs: -26, use: "fond de salle discret sous la musique", queries: ["restaurant ambience", "cafe chatter"] },
};
