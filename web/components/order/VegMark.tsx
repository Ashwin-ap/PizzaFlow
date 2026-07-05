/**
 * The veg / non-veg mark ubiquitous on Indian food-delivery apps: a bordered
 * square holding a green dot (veg) or a red triangle (non-veg). Purely decorative
 * of the item's category, but carries an accessible label for screen readers.
 */
export function VegMark({ veg, size = 14 }: { veg: boolean; size?: number }) {
  // The standard Indian veg/non-veg convention: green square+dot for veg, red
  // square+triangle for non-veg (kept literal so it reads instantly, even though
  // the rest of the UI is Zomato red/obsidian).
  const color = veg ? "#1a8f4c" : "#cb202d";
  return (
    <span
      className="veg-mark"
      style={{ width: size, height: size, borderColor: color }}
      role="img"
      aria-label={veg ? "Vegetarian" : "Non-vegetarian"}
    >
      {veg ? (
        <span className="veg-dot" style={{ backgroundColor: color }} />
      ) : (
        <span className="veg-tri" style={{ borderBottomColor: color }} />
      )}
    </span>
  );
}
