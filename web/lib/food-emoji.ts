/**
 * Deterministic food imagery for menu tiles — a small, dependency-free stand-in
 * for photography (the menu data carries only code/name/price, no images). Every
 * item maps to a stable emoji + a soft translucent tint, so tiles look intentional
 * and never shift between renders. Swap for real <img> assets later without touching
 * callers — the tile just needs `emoji` + `tint`.
 */
export type FoodCategory = "base" | "pizza" | "topping";

// Keyword → emoji, first match wins. Ordered most-specific first.
const TOPPING_EMOJI: [RegExp, string][] = [
  [/cheese|mozzarella|cheddar|paneer/i, "🧀"],
  [/olive/i, "🫒"],
  [/mushroom/i, "🍄"],
  [/chicken/i, "🍗"],
  [/bacon/i, "🥓"],
  [/pepperoni|sausage|salami|ham|meat/i, "🍖"],
  [/prawn|shrimp|seafood/i, "🦐"],
  [/corn|sweetcorn/i, "🌽"],
  [/onion/i, "🧅"],
  [/tomato/i, "🍅"],
  [/capsicum|bell|pepper/i, "🫑"],
  [/jalapeno|jalapeño|chilli|chili|spicy|peri/i, "🌶️"],
  [/pineapple/i, "🍍"],
  [/garlic/i, "🧄"],
  [/basil|herb|oregano|leaf|spinach/i, "🌿"],
  [/egg/i, "🥚"],
];

const PIZZA_EMOJI: [RegExp, string][] = [
  [/veg|garden|farm|margher/i, "🍕"],
  [/paneer|cheese/i, "🧀"],
  [/chicken|meat|pepperoni|bbq|non/i, "🍗"],
  [/veggie|salad/i, "🥗"],
];

/** Stable emoji for an item, chosen by category then name keywords. */
export function foodEmoji(name: string, category: FoodCategory): string {
  const table =
    category === "topping" ? TOPPING_EMOJI : category === "pizza" ? PIZZA_EMOJI : [];
  for (const [re, emoji] of table) if (re.test(name)) return emoji;
  if (category === "base") return "🫓";
  if (category === "pizza") return "🍕";
  return "🧂";
}

/** Deterministic hue (0–359) from an item name — same name → same hue every render. */
function hueOf(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  return hash;
}

/**
 * Soft translucent tint derived from the item name — a colored wash that reads on
 * both light and dark surfaces (the emoji supplies the saturation). Deterministic:
 * same name → same hue on every render (no Math.random / hydration mismatch).
 */
export function foodTint(name: string): string {
  return `hsl(${hueOf(name)} 70% 55% / 0.14)`;
}

/**
 * A soft two-stop gradient wash for a food tile — reads as a stylised "photo"
 * backdrop (like the warm plated shots on a delivery app) rather than a flat swatch.
 * Deterministic per name.
 */
export function foodGradient(name: string): string {
  const h = hueOf(name);
  return `linear-gradient(135deg, hsl(${h} 78% 90%), hsl(${(h + 38) % 360} 72% 82%))`;
}

// Non-veg keywords → red mark. Veg is the default (paneer/veggie/cheese win first,
// so "paneer tikka" reads veg even though "tikka" would otherwise look meaty).
const VEG_AFFIRM = /\bveg\b|veggie|paneer|margher|cheese|corn|mushroom|olive|capsicum|tomato|jalapeno|garden|farm|basil|herb/i;
const NON_VEG = /chicken|mutton|lamb|beef|meat|pepperoni|bacon|sausage|salami|\bham\b|prawn|shrimp|seafood|fish|\begg\b|keema|kheema|murg|tikka|malai|tandoori/i;

/** Best-effort veg/non-veg classification from the item name (for the veg mark). */
export function isVeg(name: string): boolean {
  if (VEG_AFFIRM.test(name)) return true;
  return !NON_VEG.test(name);
}

// Menu-pizza name → a real photo in /public/food. First match wins; falls back to
// a veg/non-veg default so any pizza (even a renamed one) still gets a plausible shot.
const PIZZA_PHOTOS: [RegExp, string][] = [
  [/margher/i, "/food/margherita.jpg"],
  [/pepperoni/i, "/food/pepperoni.jpg"],
  [/bbq|chicken/i, "/food/bbq.jpg"],
  [/paneer|tikka|peri/i, "/food/periperi.jpg"],
  [/mushroom/i, "/food/mushroom.jpg"],
  [/greek|mediter|olive/i, "/food/olives.jpg"],
  [/veggie|california|farm|garden|supreme/i, "/food/veggie.jpg"],
  [/deep ?dish|chicago|cheese|burst/i, "/food/cheese.jpg"],
  [/corn/i, "/food/corn.jpg"],
];

/** A real photo path for a pizza, chosen by name with a veg/non-veg fallback. */
export function pizzaPhoto(name: string): string {
  for (const [re, src] of PIZZA_PHOTOS) if (re.test(name)) return src;
  return isVeg(name) ? "/food/veggie.jpg" : "/food/pepperoni.jpg";
}

/** Convenience bundle for a menu tile. */
export function foodTile(
  name: string,
  category: FoodCategory,
): { emoji: string; tint: string; gradient: string; veg: boolean } {
  return {
    emoji: foodEmoji(name, category),
    tint: foodTint(name),
    gradient: foodGradient(name),
    veg: isVeg(name),
  };
}
