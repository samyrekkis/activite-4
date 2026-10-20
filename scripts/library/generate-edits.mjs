// Edit template: builds many different edit plans from the clip library.
//   npm run edits:generate -- --resto monegasque [--count 10] [--bpm 120] [--recette visite] [--seed 3]
// Reads public/library/<resto>/catalogue.json (named clips + measured colour/motion),
// writes edits/auto/<resto>-<nn>-<recette>.json, ready for `npm run render`.
// No music and no text: the user adds them. Every plan uses a different recipe
// (structure), look and transition family; a clip is never used twice in a plan
// and the least-used clips of the batch are picked first.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const resto = flag("--resto");
if (!resto) {
  console.error("Usage: npm run edits:generate -- --resto monegasque|samourai [--count 10] [--bpm 120] [--recette nom] [--seed 1]");
  process.exit(1);
}
const count = Number(flag("--count", 10));
const bpm = Number(flag("--bpm", 120));
const only = flag("--recette");
let seed = Number(flag("--seed", Date.now() % 100000));
const beat = 60 / bpm;

// Small seeded random so a batch can be regenerated identically with --seed.
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const shuffle = (a) => a.map((x) => [rand(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
const pickOne = (a) => a[Math.floor(rand() * a.length)];

const catalogue = JSON.parse(readFileSync(`public/library/${resto}/catalogue.json`, "utf8"));
// Black-and-white shots break the colour continuity of an edit: kept in the library, never used here.
const clips = catalogue.clips.filter((c) => c.quality !== 0 && !/noir et blanc/.test(c.name));
const usage = new Map(clips.map((c) => [c.id, 0]));

const FOOD = ["plat", "dessert", "boisson", "table", "geste"];
const PLACE = ["salle", "deco", "exterieur"];
const PEOPLE = ["personnes", "cuisine"];
const is = (...cats) => (c) => cats.flat().includes(c.category);
const closeUp = (c) => c.view === "gros-plan" || c.view === "dessus";
const night = (c) => c.light === "nuit";
const day = (c) => c.light !== "nuit";
const still = (c) => c.motion_strength < 0.06;

const hue = (c) => Math.atan2(c.lab[2] - 128, c.lab[1] - 128);
const labDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const sameDir = (a, b) => a.motion[0] * b.motion[0] + a.motion[1] * b.motion[1] > 0;

// Looks: film tone curves (src/grading.tsx) on top of the restaurant grade,
// so two edits never feel identical. Night recipes get night looks.
const LOOKS = [
  { name: "teal & orange", grade: { curve: "tealOrange" } },
  { name: "pellicule", grade: { curve: "film" } },
  { name: "golden hour", grade: { curve: "golden" } },
  { name: "moody", grade: { curve: "moody" } },
  { name: "bleach", grade: { curve: "bleach", contrast: 1.05 } },
  { name: "naturel", grade: {} },
];
const NIGHT_LOOKS = [
  { name: "néon", grade: { curve: "neon" } },
  { name: "moody", grade: { curve: "moody" } },
];

const HANDLES = { monegasque: "@lemonegasquedz", samourai: "@samourai_restaurant" };
const PLACES = { monegasque: "Le Monégasque · Alger", samourai: "Le Samouraï · Alger" };
const COMMENTS = {
  monegasque: ["On y va dimanche ? 😍", "Ce brunch 🤤", "Tag la personne qui t'invite 👇", "La piscine + le brunch, validé ✨"],
  samourai: ["On y va ce week-end ? 😍", "Ces sushis 🤤", "Tag la personne qui t'invite 👇", "L'ambiance est folle 🏮"],
};

// Finishing touches, rotated across the batch: cinema bars, Instagram cards.
const STYLES = ["bandes cinéma", "story Instagram", "cartes de fin", "commentaire", "épuré", "bandes + cartes"];

function decorate(planClips, style, recipeName, hookLen = 0) {
  const put = (c, cards) => {
    if (c && !c.social) c.social = cards;
  };
  const last = planClips.length - 1;
  const food = planClips.findIndex((c, i) => i > hookLen && i < last && /Plat|Dessert|Table|Geste|plat|dessert/.test(c.label));
  if (style === "bandes cinéma" || style === "bandes + cartes") {
    // Bars on the whole edit: switching them on and off between shots looks amateur.
    planClips.forEach((c) => (c.letterbox = true));
  }
  if (style === "story Instagram") {
    planClips.forEach((c, i) => {
      c.social = [{ kind: "story", segments: planClips.length, index: i }];
    });
  }
  if (style === "cartes de fin" || style === "bandes + cartes") {
    put(planClips[Math.min(hookLen + 1, last)], [{ kind: "location", place: PLACES[resto], delay: 0.15 }]);
    put(planClips[last], [{ kind: "reserve", text: "Réserve ta table" }]);
  }
  if (style === "commentaire" && food > 0) {
    put(planClips[food], [{ kind: "comment", handle: "@ton.pote", text: pickOne(COMMENTS[resto]), delay: 0.2 }]);
    put(planClips[last], [{ kind: "saved", text: resto === "monegasque" ? "Enregistré pour ton prochain brunch" : "Enregistré pour ton prochain dîner", delay: 0.2 }]);
  }
  // Every edit ends on an invitation.
  const lastCard = { kind: "reserve", text: "Réserve ta table", delay: 0.2 };
  planClips[last].social = [...(planClips[last].social ?? []).filter((c) => c.kind === "story"), lastCard];
  return planClips;
}

// Recipes: the structure of an edit. Each slot = what to show, for how many beats.
// flow: how the next clip is chosen ("motion" = continue the camera move,
// "colour" = closest colour, "contrast" = opposite, "free").
const RECIPES = {
  rafale: {
    titre: "Rafale gourmande : une accroche, puis les plats en coupes sèches sur le beat",
    flow: "colour", transitions: ["cut"], accent: ["flash", "glitch"],
    slots: () => [
      { f: is(FOOD), b: 3, hook: true },
      ...Array(4).fill({ f: is("plat", "dessert", "boisson", "geste"), b: 2 }),
      { f: is("plat", "dessert", "boisson", "geste"), b: 2, accent: true },
      ...Array(4).fill({ f: is("plat", "dessert", "boisson", "geste"), b: 2 }),
      { f: is(PLACE), b: 4, accent: true },
    ],
  },
  visite: {
    titre: "La visite : de l'entrée à l'assiette, en suivant le mouvement de la caméra",
    flow: "motion", axis: "motion", transitions: ["whip", "cut", "stretch"],
    slots: () => [
      { f: is("exterieur"), b: 3 }, { f: is("salle"), b: 3 }, { f: is("deco"), b: 2 }, { f: is("salle"), b: 2 },
      { f: is("table"), b: 3 }, { f: is("plat"), b: 2 }, { f: is("geste"), b: 2 }, { f: is("boisson", "dessert"), b: 2 }, { f: is("salle", "exterieur"), b: 4 },
    ],
  },
  jourNuit: {
    titre: "Du jour à la nuit : le même lieu, deux ambiances, bascule au milieu",
    flow: "colour", transitions: ["cut", "fade"], accent: ["blinds", "lightLeak", "flash"], needs: (cs) => cs.filter(night).length >= 4,
    slots: () => [
      ...Array(5).fill({ f: day, b: 2 }),
      { f: night, b: 3, accent: true },
      ...Array(4).fill({ f: night, b: 2 }),
      { f: night, b: 4 },
    ],
  },
  degrade: {
    titre: "Dégradé : chaque plan prend la couleur du précédent, fondus et voiles de lumière",
    flow: "colour", transitions: ["fade"], fadeBeats: 0.5,
    slots: () => Array(8).fill({ f: () => true, b: 3 }),
    order: "hue",
  },
  lent: {
    titre: "Gros plans lents : textures et détails, légers ralentis, fondus flous",
    flow: "colour", transitions: ["fade"], fadeBeats: 0.75, slow: 0.8,
    slots: () => Array(6).fill({ f: (c) => closeUp(c) && is(FOOD, "deco")(c), b: 4 }),
  },
  pingPong: {
    titre: "Ping-pong : un plat, un lieu, un plat, un lieu… en coupes sur le beat",
    flow: "contrast", axis: "alternate", transitions: ["slide", "split", "pushCut"],
    slots: () => Array(5).fill(0).flatMap(() => [{ f: is("plat", "dessert", "boisson"), b: 2 }, { f: is(PLACE, PEOPLE), b: 2 }]),
  },
  crescendo: {
    titre: "Crescendo : des plans de plus en plus courts, puis un plan large qui respire",
    flow: "free", transitions: ["cut"], accent: ["spin", "zoomPunch"],
    slots: () => [4, 4, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1].map((b) => ({ f: is(FOOD, PLACE), b })).concat([{ f: is("salle", "exterieur", "table"), b: 4, accent: true }]),
  },
  unGeste: {
    titre: "Un seul geste : tous les plans bougent dans le même sens, raccords invisibles",
    flow: "motion", transitions: ["cut"], strictMotion: true,
    slots: () => Array(9).fill({ f: (c) => !still(c), b: 2 }),
  },
  tablePleine: {
    titre: "La table se remplit : le décor, puis les plats arrivent, puis la table complète",
    flow: "free", transitions: ["cut", "wipe", "blinds"],
    slots: () => [
      { f: is("deco"), b: 2 }, { f: is("salle"), b: 2 },
      ...Array(5).fill({ f: is("plat", "dessert", "boisson"), b: 2 }),
      { f: is("geste"), b: 2 }, { f: is("table"), b: 4 },
    ],
  },
  zoomChaine: {
    titre: "Zoom en chaîne : chaque plan entre en zoom, énergie maximale",
    flow: "colour", transitions: ["zoomPunch", "blurZoom"],
    slots: () => Array(10).fill({ f: is(FOOD, PLACE, PEOPLE), b: 2 }),
  },
  ambiance: {
    titre: "Ambiance : les gens, le service, la cuisine, puis l'assiette",
    flow: "motion", axis: "motion", transitions: ["cut", "whip", "stretch"], needs: (cs) => cs.filter(is(PEOPLE)).length >= 3,
    slots: () => [
      { f: is(PEOPLE), b: 3 }, { f: is(PLACE), b: 2 }, { f: is(PEOPLE), b: 2 }, { f: is("plat"), b: 2 },
      { f: is(PEOPLE), b: 2 }, { f: is("geste"), b: 2 }, { f: is(PLACE), b: 2 }, { f: is("plat", "table"), b: 4 },
    ],
  },
  ascenseur: {
    titre: "Ascenseur : tout monte, comme un fil Instagram qu'on fait défiler",
    flow: "colour", axis: "up", transitions: ["slide", "whip", "split", "stretch", "blinds"],
    slots: () => [{ f: is(FOOD), b: 3, hook: true }, ...Array(8).fill({ f: is(FOOD, PLACE), b: 2 }), { f: is(PLACE), b: 3 }],
  },
  travelling: {
    titre: "Travelling : tout glisse vers la gauche, un seul long mouvement à travers le resto",
    flow: "motion", axis: "left", transitions: ["slide", "whip", "stretch", "wipe", "pushCut"],
    slots: () => [{ f: is(PLACE), b: 3 }, ...Array(4).fill({ f: is(PLACE, FOOD), b: 2 }), ...Array(4).fill({ f: is(FOOD), b: 2 }), { f: is(PLACE), b: 3 }],
  },
  carrousel: {
    titre: "Carrousel : une transition différente à chaque plan, jamais la même",
    flow: "contrast", axis: "any", noRepeat: true,
    transitions: ["slide", "whip", "split", "blinds", "spin", "stretch", "lightLeak", "blurZoom", "glitch", "iris", "clockWipe", "flip", "zoomPunch", "wipe"],
    slots: () => [{ f: is(FOOD), b: 3, hook: true }, ...Array(9).fill({ f: () => true, b: 2 }), { f: is(PLACE), b: 3 }],
  },
  nuitElectrique: {
    titre: "Nuit électrique : les plans de nuit, glitchs et flashs sur le beat",
    flow: "contrast", axis: "any", transitions: ["glitch", "cut", "flash", "cut"], needs: (cs) => cs.filter(night).length >= 6,
    slots: () => Array(10).fill({ f: night, b: 2 }),
  },
};

const DIRS = ["from-left", "from-right", "from-top", "from-bottom"];
const DIRECTIONAL = new Set(["slide", "wipe", "flip", "whip", "spin", "split", "blinds", "lightLeak", "stretch"]);

// Direction of a transition, depending on the recipe's axis:
// "up" = everything rises, "left" = everything slides left, "alternate" =
// horizontal then vertical, "motion" = follows the camera move of the previous
// shot (decided when the clip is known), otherwise any direction but the last one.
function directionFor(recipe, si, prevDir) {
  switch (recipe.axis) {
    case "up":
      return "from-bottom";
    case "left":
      return "from-right";
    case "alternate":
      return si % 4 < 2 ? (si % 2 ? "from-right" : "from-left") : si % 2 ? "from-bottom" : "from-top";
    case "motion":
      return "motion";
    default:
      return pickOne(DIRS.filter((d) => d !== prevDir));
  }
}

function transitionFor(recipe, slot, si, prev, used) {
  if (si === 0) return { type: "cut" };
  const family = slot.accent && recipe.accent ? recipe.accent : recipe.transitions;
  let choices = family.length > 1 ? family.filter((x) => x !== prev?.type) : family;
  if (recipe.noRepeat) choices = choices.filter((x) => !used.has(x)).concat(choices.every((x) => used.has(x)) ? choices : []);
  const type = pickOne(choices);
  used.add(type);
  const t = { type };
  if (DIRECTIONAL.has(type)) t.direction = directionFor(recipe, si, prev?.direction);
  if (type === "cut") return t;
  if (type === "fade") t.duration = round(beat * (recipe.fadeBeats ?? 0.5));
  else if (type === "flash") t.duration = 0.2;
  else if (type === "whip" || type === "glitch") t.duration = 0.25;
  else if (type === "lightLeak" || type === "blurZoom" || type === "split" || type === "blinds") t.duration = round(Math.max(0.35, beat * 0.75));
  else t.duration = round(Math.max(0.3, beat / 2));
  return t;
}

const MOTIONS = ["zoomIn", "zoomOut", "panLeft", "panRight", "panUp", "panDown"];
const whipDir = (c) => {
  const [dx, dy] = c.motion;
  if (Math.abs(dy) > Math.abs(dx)) return dy < 0 ? "from-bottom" : "from-top";
  return dx < 0 ? "from-right" : "from-left";
};
const round = (x) => Math.round(x * 100) / 100;

function score(c, prev, recipe, slot) {
  let s = -usage.get(c.id) * 10 + (c.quality ?? 2) * 2 + rand() * 3;
  if (slot.hook) s += (c.quality ?? 2) * 6;
  if (!prev) return s;
  if (c.source === prev.source) s -= 25;
  // A pro edit never shows the same dish twice in a row, and keeps the light coherent.
  const words = (x) => new Set(x.name.toLowerCase().split(/[^a-zàâçéèêëîïôûùüÿœ]+/).filter((w) => w.length > 4));
  const pw = words(prev);
  if ([...words(c)].some((w) => pw.has(w))) s -= 15;
  if (c.light === prev.light) s += 5;
  if (c.category === prev.category && recipe.slots().length > 4) s -= 3;
  if (recipe.flow === "colour") s -= labDist(c.lab_first ?? c.lab, prev.lab_last ?? prev.lab) / 6;
  if (recipe.flow === "contrast") s += labDist(c.lab, prev.lab) / 10;
  if (recipe.flow === "motion") s += sameDir(c, prev) ? 8 : -4;
  return s;
}

// Finds a clip for a slot: full length first, then a slight slow motion
// (down to 0.75x) on a clip that is a bit short, then one beat less.
// Clips of the edit's theme; the whole library is only a last resort.
let active = clips;
function choose(recipe, slot, prev, used, overlapNext, isLast = false) {
  const base = recipe.slow ?? 1;
  const passes = [[active, slot.f], [active, () => true], [clips, slot.f], [clips, () => true]];
  for (const [source, f] of passes) {
    for (let beats = slot.b; beats >= 1; beats--) {
      const need = beats * beat + overlapNext;
      let pool = source.filter((c) => !used.has(c.id) && f(c) && c.duration >= need * 0.75);
      if (recipe.strictMotion && prev && pool.some((c) => sameDir(c, prev))) pool = pool.filter((c) => sameDir(c, prev));
      if (!pool.length) continue;
      const ranked = pool
        .map((c) => [score(c, prev, recipe, slot) + (c.duration >= need * base ? 4 : 0) + (isLast ? (c.quality ?? 2) * 6 + c.brightness * 10 : 0), c])
        .sort((x, y) => y[0] - x[0]);
      const clip = ranked[0][1];
      const speed = clip.duration >= need * base + 0.05 ? base : Math.floor(((clip.duration - 0.05) / need) * 100) / 100;
      return { clip, beats, speed };
    }
  }
  return null;
}

// Hooks: the first 1-2 seconds decide whether people keep watching, so every
// edit opens with one, rotated across the batch, on the clips with the best
// "hook score" (movement, colour, gestures, close-ups, quality).
const HOOKS = ["geste", "avantGout", "question", "revelation", "coupDePoing", "story"];
const HOOK_TITLES = {
  geste: "geste au ralenti", avantGout: "trois plans forts", question: "question en commentaire",
  revelation: "du lieu à l'assiette", coupDePoing: "plan choc", story: "story Instagram",
};
const HOOK_QUESTIONS = {
  monegasque: ["C'est où ça ?? 😍", "Je veux ce brunch 😭", "On réserve quand ?"],
  samourai: ["C'est où ça ?? 😍", "Ces sushis 😭", "On y va quand ?"],
};
const chroma = (c) => Math.hypot(c.lab[1] - 128, c.lab[2] - 128);
const hookScore = (c) =>
  (c.quality ?? 2) * 3 + (c.category === "geste" ? 6 : 0) + (c.category === "cuisine" ? 3 : 0) + (closeUp(c) ? 2 : 0)
  + chroma(c) / 8 + Math.min(c.motion_strength, 0.5) * 6 - usage.get(c.id) * 8 + rand() * 2;
const heroes = (filter, used, need) => {
  const pick = (from) => from.filter((c) => !used.has(c.id) && (c.quality ?? 2) >= 2 && filter(c) && c.duration >= need);
  const inTheme = pick(active);
  return (inTheme.length ? inTheme : pick(clips)).sort((a, b) => hookScore(b) - hookScore(a));
};

// A centred excerpt of a clip, `seconds` long on screen.
function excerpt(c, seconds, speed, extra) {
  const span = Math.min(c.duration - 0.05, seconds * speed);
  const start = round(Math.max(0, (c.duration - span) / 2));
  usage.set(c.id, usage.get(c.id) + 1);
  return { label: c.name, src: c.src, start, end: round(start + span), ...(speed !== 1 ? { speed } : {}), ...extra };
}

// Hooks stay clean: hard cuts on the beat, no flash or punch effect. The
// strongest shots do the work.
function buildHook(kind, used, look) {
  const g = Object.keys(look.grade).length ? { grade: look.grade } : {};
  const take = (list) => {
    const c = list[0];
    if (c) used.add(c.id);
    return c;
  };
  const food = is(FOOD, "cuisine");
  const dish = is("plat", "dessert", "boisson", "geste");
  switch (kind) {
    case "geste": {
      const c = take(heroes(is("geste", "cuisine"), used, 4 * beat * 0.6)) ?? take(heroes(food, used, 4 * beat * 0.6));
      return c && [excerpt(c, 4 * beat, 0.6, g)];
    }
    case "avantGout": {
      const out = [];
      for (let k = 0; k < 3; k++) {
        const c = take(heroes(dish, used, 2 * beat));
        if (!c) return null;
        out.push(excerpt(c, k < 2 ? beat * 2 : beat * 3, 1, g));
      }
      return out;
    }
    case "question": {
      const c = take(heroes(is("plat", "dessert", "table", "geste"), used, 4 * beat));
      const text = pickOne(HOOK_QUESTIONS[resto]);
      return c && [excerpt(c, 4 * beat, 1, { ...g, social: [{ kind: "comment", handle: "@ton.pote", text, delay: 0.1 }] })];
    }
    case "revelation": {
      const w = take(heroes(is(PLACE), used, 2 * beat));
      const h = take(heroes(dish, used, 3 * beat));
      return w && h && [excerpt(w, 2 * beat, 1, g), excerpt(h, 3 * beat, 1, g)];
    }
    case "coupDePoing": {
      const a = take(heroes(food, used, 4 * beat));
      return a && [excerpt(a, 4 * beat, 1, g)];
    }
    default: {
      const c = take(heroes(food, used, 3 * beat));
      return c && [excerpt(c, 3 * beat, 1, { ...g, social: [{ kind: "story", segments: 6, index: 0 }] })];
    }
  }
}

// Pro pass, applied to every finished plan. What makes an edit look amateur is
// removed: only cuts, motivated whips (the camera move continues from one shot
// to the next), soft fades on slow recipes and one light leak at most; fake
// camera moves only on static shots, all the same slow zoom; overlaps that
// disappear with a transition are given back so every cut stays on the beat.
const BY_SRC = new Map(clips.map((c) => [c.src, c]));
// Story order: we arrive (outside, room, decor), sit down (the table), eat
// (dishes, gestures, desserts), day before night. Transitions stay at their
// positions.
const ZONE = { exterieur: 0, salle: 1, deco: 1, personnes: 2, cuisine: 2, table: 3, plat: 4, geste: 4, dessert: 5, boisson: 5 };
function storyOrder(body, recipeName) {
  if (["degrade", "pingPong"].includes(recipeName) || body.length < 3) return body;
  const rank = (c) => {
    const m = BY_SRC.get(c.src);
    return m ? (m.light === "nuit" ? 10 : 0) + (ZONE[m.category] ?? 3) : 3;
  };
  const moving = body.slice(0, -1); // the last shot (the invitation) stays last
  const slots = moving.map((c) => ({ t: c.transitionIn }));
  // Each clip keeps its own length (a whole number of beats), so cuts stay on the beat.
  const out = [...moving].sort((x, y) => rank(x) - rank(y)).map((c, k) => ({ ...c, transitionIn: slots[k].t }));
  return [...out, body[body.length - 1]];
}

function proPass(planClips, recipeName, editIndex) {
  const softRecipe = recipeName === "lent" || recipeName === "degrade";
  const zoom = editIndex % 2 ? "zoomOut" : "zoomIn";
  let leaks = 0;
  let signature = null; // a single transition type per edit, besides cuts
  planClips.forEach((c, k) => {
    const meta = BY_SRC.get(c.src);
    const prev = planClips[k - 1];
    const prevMeta = prev && BY_SRC.get(prev.src);
    // No fake camera moves at all: the footage already moves, digital zooms read as amateur.
    delete c.motion;
    delete c.motionIntensity;
    // Breathing: places and people get one more beat than food, when the clip allows it.
    if (meta && ["exterieur", "salle", "deco", "personnes"].includes(meta.category)) {
      const extra = beat * (c.speed ?? 1);
      if (c.end + extra <= meta.duration - 0.05) c.end = round(c.end + extra);
    }
    const t = c.transitionIn;
    if (!t || !prev) {
      delete c.transitionIn;
      return;
    }
    const moving = meta && prevMeta && meta.motion_strength > 0.1 && prevMeta.motion_strength > 0.1 && sameDir(meta, prevMeta);
    let keep = null;
    if (t.type === "whip" && moving) keep = { type: "whip", direction: whipDir(prevMeta), duration: 0.25 };
    else if (t.type === "fade" && softRecipe) keep = t;
    else if (t.type === "lightLeak" && softRecipe && leaks++ < 1) keep = t;
    if (keep && (!signature || signature === keep.type)) {
      signature = keep.type;
      c.transitionIn = keep;
      return;
    }
    // The previous clip was extended to cover the overlap: shorten it back.
    const overlap = t.type === "cut" ? 0 : t.duration ?? 0.35;
    if (overlap) prev.end = round(prev.end - overlap * (prev.speed ?? 1));
    delete c.transitionIn;
  });
  // A shot under half a second cannot be read: drop it.
  return planClips.filter((c) => (c.end - c.start) / (c.speed ?? 1) >= 0.5);
}

function build(recipeName, recipe, index, look, preUsed) {
  const used = new Set(preUsed);
  const slots = recipe.slots();
  const ts = [];
  const usedTypes = new Set();
  slots.forEach((slot, si) => ts.push(transitionFor(recipe, slot, si, ts[si - 1], usedTypes)));
  const overlap = (t) => (t && t.type !== "cut" ? t.duration ?? 0.35 : 0);
  const out = [];
  let prev = null;
  let prevMotion = null;
  for (const [si, slot] of slots.entries()) {
    // The last shot is the invitation: the best-looking, brightest one wins.
    const found = choose(recipe, slot, prev, used, overlap(ts[si + 1]), si === slots.length - 1);
    if (!found) return null;
    const { clip, beats } = found;
    // Gestures (pouring, cutting, chopsticks) look cinematic in slow motion.
    const speed = found.speed === 1 && clip.category === "geste" ? 0.7 : found.speed;
    used.add(clip.id);
    const t = { ...ts[si] };
    if (t.direction === "motion") t.direction = prev ? whipDir(prev) : "from-right";
    // Glitches spoil appetite: never glitch into food, flash instead.
    if (t.type === "glitch" && FOOD.includes(clip.category)) Object.assign(t, { type: "flash", duration: 0.2 });
    let motion = "none";
    if (still(clip) && recipeName !== "unGeste") {
      motion = recipeName === "zoomChaine" ? (prevMotion === "zoomIn" ? "zoomOut" : "zoomIn") : pickOne(MOTIONS.filter((m) => m !== prevMotion));
    }
    prevMotion = motion;
    out.push({ clip, beats, t, motion, speed });
    prev = clip;
  }
  if (recipe.order === "hue") {
    // Re-order along the colour wheel; transitions stay in place.
    const sorted = [...out].sort((x, y) => hue(x.clip) - hue(y.clip));
    sorted.forEach((o, i) => (o.t = out[i].t));
    out.splice(0, out.length, ...sorted);
  }
  // Each clip also covers the overlap of the transition that follows it, so cuts stay on the beat.
  return out.map((o, i) => {
    const seconds = o.beats * beat + overlap(out[i + 1]?.t);
    const span = Math.min(o.clip.duration - 0.05, seconds * o.speed);
    const start = round(Math.max(0, (o.clip.duration - span) / 2));
    usage.set(o.clip.id, usage.get(o.clip.id) + 1);
    return {
      label: `#${i + 1} ${o.clip.name}`,
      src: o.clip.src,
      start,
      end: round(start + span),
      ...(o.speed !== 1 ? { speed: o.speed } : {}),
      ...(o.motion !== "none" ? { motion: o.motion, motionIntensity: 0.6 } : {}),
      ...(Object.keys(look.grade).length ? { grade: look.grade } : {}),
      ...(i > 0 ? { transitionIn: o.t } : {}),
    };
  });
}


// Themes: one edit = one subject. Each theme lists the clips it may use and
// the recipes that suit it.
const has = (re) => (c) => re.test(c.name);
const THEMES = {
  monegasque: [
    { name: "brunch au bord de la piscine", f: (c) => /piscine|terrasse/.test(c.name) && c.light !== "nuit", recipes: ["visite", "degrade", "tablePleine"] },
    { name: "douceurs", f: (c) => c.category === "dessert" || has(/crêpe|pancake|chocolat|gâteau|milkshake|smoothie|glace|granola|fondant|tiramisu|jus/)(c), recipes: ["rafale", "lent", "crescendo", "degrade"] },
    { name: "brunch salé", f: (c) => is("table", "plat", "geste")(c) && c.light !== "nuit" && !has(/crêpe|pancake|chocolat|gâteau|fondant/)(c), recipes: ["rafale", "tablePleine", "pingPong", "crescendo"] },
    { name: "soirée", f: (c) => c.light === "nuit", recipes: ["crescendo", "degrade", "visite"] },
    { name: "shooting en haïk", f: (c) => has(/haïk|voile|trône|néon/)(c) || is("deco")(c), recipes: ["lent", "degrade", "ambiance"] },
    { name: "la déco", f: is("deco", "salle", "exterieur"), recipes: ["visite", "degrade", "lent"] },
  ],
  samourai: [
    { name: "sushis", f: (c) => has(/sushi|maki|roll|sashimi|baguettes/)(c) || is("plat", "geste")(c), recipes: ["rafale", "lent", "crescendo"] },
    { name: "décor et néons", f: is("deco", "salle"), recipes: ["visite", "degrade", "lent"] },
    { name: "soirée", f: (c) => c.light === "nuit", recipes: ["crescendo", "degrade", "visite"] },
    { name: "l'expérience kimono", f: (c) => has(/kimono|éventail|chambre|table basse|poupée/)(c) || is("personnes", "cuisine")(c), recipes: ["ambiance", "lent", "degrade"] },
    { name: "les plats", f: is("plat", "geste", "table"), recipes: ["rafale", "tablePleine", "pingPong", "crescendo"] },
  ],
};

// Recipes built on showy transitions are only used when asked for by name.
const GADGET = new Set(["carrousel", "zoomChaine", "nuitElectrique", "ascenseur", "travelling", "unGeste"]);
const names = Object.keys(RECIPES).filter((n) => (only ? n === only : !GADGET.has(n))).filter((n) => !RECIPES[n].needs || RECIPES[n].needs(clips));
if (!names.length) {
  console.error(`Recette inconnue ou impossible avec ces clips. Recettes : ${Object.keys(RECIPES).join(", ")}`);
  process.exit(1);
}
mkdirSync("edits/auto", { recursive: true });
const order = shuffle(names);
const looks = shuffle(LOOKS);
const styles = shuffle(STYLES);
const hooks = shuffle(HOOKS);
const summary = [];
let nightCount = 0;
const themeList = shuffle(THEMES[resto].filter((t) => clips.filter(t.f).length >= 8));
const recipeTurn = new Map();
for (let i = 0; i < count; i++) {
  const theme = themeList[i % themeList.length];
  active = clips.filter(theme.f);
  // The theme's next recipe (or the one asked for with --recette).
  const fits = only ? [only] : theme.recipes.filter((r) => names.includes(r));
  const turn = recipeTurn.get(theme.name) ?? Math.floor(rand() * fits.length);
  recipeTurn.set(theme.name, turn + 1);
  const name = fits[turn % fits.length] ?? order[i % order.length];
  const recipe = RECIPES[name];
  const nightRecipe = name === "jourNuit" || name === "nuitElectrique" || theme.name === "soirée";
  const look = nightRecipe ? NIGHT_LOOKS[nightCount++ % NIGHT_LOOKS.length] : looks[i % looks.length];
  const style = styles[i % styles.length];
  const hookKind = hooks[i % hooks.length];
  const hookUsed = new Set();
  const hook = buildHook(hookKind, hookUsed, look) ?? [];
  const built = build(name, recipe, i, look, hookUsed);
  const joined = built && [...hook, ...storyOrder(built, name)].map((c, k) => ({ ...c, label: `#${k + 1}${k < hook.length ? " HOOK" : ""} ${c.label.replace(/^#\d+ /, "")}` }));
  if (joined) delete joined[0].transitionIn;
  const planClips = joined && decorate(proPass(joined, name, i), style, name, hook.length);
  if (!planClips) {
    console.warn(`${name} : pas assez de clips, ignorée.`);
    continue;
  }
  const file = `edits/auto/${resto}-${String(i + 1).padStart(2, "0")}-${name}.json`;
  const plan = {
    restaurant: resto,
    format: "vertical",
    fps: 30,
    version: 1,
    brief: `Thème « ${theme.name} ». Hook « ${HOOK_TITLES[hookKind]} », puis ${recipe.titre}. Look « ${look.name} », finition « ${style} », ${bpm} BPM. Sans musique : à ajouter.`,
    handle: HANDLES[resto],
    template: { theme: theme.name, hook: hookKind, recette: name, look: look.name, finition: style, bpm, seed },
    clips: planClips,
  };
  writeFileSync(file, JSON.stringify(plan, null, 2) + "\n");
  const total = planClips.reduce((s, c) => s + (c.end - c.start) / (c.speed ?? 1), 0)
    - planClips.reduce((s, c) => s + (c.transitionIn && c.transitionIn.type !== "cut" ? c.transitionIn.duration ?? 0.35 : 0), 0);
  summary.push(`${file}\n  ${recipe.titre}\n  Thème : ${theme.name} · Hook : ${HOOK_TITLES[hookKind]} · Look : ${look.name} · ${style} · ${planClips.length} plans · ${total.toFixed(1)} s\n  ${planClips.map((c) => c.label.replace(/^#\d+ /, "")).join(" | ")}`);
}
console.log(summary.join("\n\n"));
const unused = clips.filter((c) => usage.get(c.id) === 0).length;
console.log(`\n${summary.length} plans écrits dans edits/auto/. Clips jamais utilisés dans ce lot : ${unused}/${clips.length}.`);
