/**
 * "What's on your mind?" — a Swiggy-style category rail of round food photos.
 * Decorative by default; when `onPick` is supplied the tiles become buttons that
 * add the mapped menu pizza to the cart. Each craving carries a `match` regex that
 * the caller resolves against the live menu pizzas (labels are kept as-is and
 * mapped underneath, so "Cheese Burst" → a real pizza, etc.).
 */
export interface Craving {
  img: string;
  label: string;
  match: RegExp;
}

export const CRAVINGS: Craving[] = [
  { img: "/food/margherita.jpg", label: "Margherita", match: /margher/i },
  { img: "/food/cheese.jpg", label: "Cheese Burst", match: /cheese|burst|deep ?dish|chicago|margher/i },
  { img: "/food/veggie.jpg", label: "Veggie Supreme", match: /veggie|california|supreme|farm/i },
  { img: "/food/pepperoni.jpg", label: "Pepperoni", match: /pepperoni/i },
  { img: "/food/periperi.jpg", label: "Peri-Peri", match: /peri|paneer|tikka|bbq|chicken/i },
  { img: "/food/mushroom.jpg", label: "Mushroom", match: /mushroom|farm/i },
  { img: "/food/corn.jpg", label: "Sweet Corn", match: /corn|greek|mediter/i },
  { img: "/food/olives.jpg", label: "Olives", match: /olive|greek|mediter/i },
];

export function CravingsRail({
  title = "What's on your mind?",
  className = "",
  onPick,
}: {
  title?: string;
  className?: string;
  onPick?: (craving: Craving) => void;
}) {
  return (
    <div className={className}>
      <h3 className="mb-4 text-lg font-semibold text-ink">{title}</h3>
      <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
        {CRAVINGS.map((c) => {
          const inner = (
            <>
              <span className="cat-orb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.img} alt="" />
              </span>
              <span className="text-xs font-medium text-ink-secondary">{c.label}</span>
            </>
          );
          return onPick ? (
            <button
              key={c.label}
              type="button"
              className="cat-tile"
              onClick={() => onPick(c)}
              aria-label={`Add ${c.label} to your order`}
            >
              {inner}
            </button>
          ) : (
            <div key={c.label} className="cat-tile" aria-hidden>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
