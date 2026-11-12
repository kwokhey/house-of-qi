/**
 * Bead colour families for "Shop by colour".
 * Each piece gets a colour automatically from its stone (or from its details,
 * e.g. "Mica · Purple"), unless one is chosen for it on the Stock page.
 */
export const COLOURS = [
  ["purple", "Purple", "#9478B8"],
  ["blue", "Blue", "#7FA9CB"],
  ["green", "Green", "#7FA37A"],
  ["pink", "Pink", "#E2A6B4"],
  ["red", "Red & Orange", "#C66A48"],
  ["gold", "Yellow & Gold", "#D9AE55"],
  ["brown", "Brown", "#9A6D48"],
  ["black", "Black & Grey", "#4D4945"],
  ["white", "White & Clear", "#EEE9E2"],
  ["multi", "Multi-colour", "conic-gradient(#C66A48,#D9AE55,#7FA37A,#7FA9CB,#9478B8,#E2A6B4,#C66A48)"],
];
const KEYS = new Set(COLOURS.map((c) => c[0]));
export const isColour = (k) => KEYS.has(k);

// colour words in the details win (e.g. "Golden", "Purple", "Deep green")
const WORDS = [
  [/purple|violet|lavender|lilac/i, "purple"], [/blue|aqua|teal/i, "blue"], [/green/i, "green"], [/pink|rose\b/i, "pink"],
  [/\bred\b|orange|cherry/i, "red"], [/gold|golden|yellow|honey|champagne/i, "gold"], [/brown|coffee|chocolate/i, "brown"],
  [/black|grey|gray|smoky/i, "black"], [/white|clear|snow|ice/i, "white"],
];
const STONES = {
  purple: ["amethyst", "lavender amethyst", "auralite", "lepidolite", "charoite", "phosphosiderite", "kunzite"],
  blue: ["larimar", "blue opal", "boulder opal", "blue lace agate", "blue apatite", "angelite", "blue onyx", "lapis lazuli", "chrysocolla", "aquamarine", "blue topaz", "kyanite", "sodalite", "amazonite"],
  green: ["green garnet", "diopside", "emerald", "variscite", "seraphinite", "jade", "moss agate", "green aventurine", "serpentine", "malachite", "peridot", "unakite", "prehnite", "green phantom", "moldavite"],
  pink: ["rose quartz", "strawberry quartz", "rhodochrosite", "rhodonite", "morganite", "thulite", "pink opal"],
  red: ["almandine", "hessonite", "garnet", "tanzania sunstone", "sunstone", "eudialyte", "carnelian", "red jasper", "south red agate", "ruby"],
  gold: ["golden rutile", "golden healer", "yellow calcite", "amber", "baltic amber", "mica", "golden labradorite", "citrine", "libyan glass", "pyrite", "rabbit hair"],
  brown: ["tiger eye", "tigers eye", "smoky quartz", "bronzite", "petrified wood"],
  black: ["black tourmaline", "tektite", "labradorite", "obsidian", "onyx", "black onyx", "hematite", "nuummite"],
  white: ["clear quartz", "selenite", "moonstone", "howlite", "tridacna", "tourmalinated quartz", "white jade", "pearl"],
  multi: ["fluorite", "multi-colour rutilated quartz", "tourmaline", "rainbow tourmaline", "ocean jasper", "mookaite jasper", "petersite", "picture jasper", "4 seasons phantom"],
};
const BY_STONE = {};
for (const [k, list] of Object.entries(STONES)) for (const s of list) BY_STONE[s] = k;

/** Automatic colour for a stock row { stone, variant } */
export function autoColour(r) {
  for (const [re, k] of WORDS) if (re.test(r.variant || "")) return k;
  const s = String(r.stone || "").toLowerCase().replace(/\s*\(.*\)\s*/g, "").replace(/['’]/g, "").trim();
  if (BY_STONE[s]) return BY_STONE[s];
  // partial match, longest first ("green garnet" before "garnet")
  const hit = Object.keys(BY_STONE).sort((a, b) => b.length - a.length).find((k) => s.includes(k));
  if (hit) return BY_STONE[hit];
  for (const [re, k] of WORDS) if (re.test(s)) return k;
  return "multi";
}
export const colourOf = (r) => (isColour(r.colour) ? r.colour : autoColour(r));
