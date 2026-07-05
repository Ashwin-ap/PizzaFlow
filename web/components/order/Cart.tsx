import { ShoppingBag, Trash2 } from "lucide-react";
import { rupees, DISCOUNT_THRESHOLD, type Bill } from "@/lib/pricing";
import type { Menu, MenuItem, OrderLineItem } from "@/lib/order-api";
import { foodEmoji, isVeg } from "@/lib/food-emoji";
import { VegMark } from "./VegMark";

const priceOf = (items: MenuItem[], code: string) =>
  items.find((i) => i.code === code)?.pricePaise ?? 0;
const nameOf = (items: MenuItem[], code: string) =>
  items.find((i) => i.code === code)?.name ?? "";

/**
 * Persistent cart summary for the Build step — the food-delivery pattern: a running
 * list of built pizzas (removable), the live subtotal, a bulk-discount nudge, and the
 * "Review bill" CTA. Quantity emerges from the cart (min 1 to proceed, capped at max).
 */
export function Cart({
  cart,
  menu,
  bill,
  onRemove,
  onReview,
}: {
  cart: OrderLineItem[];
  menu: Menu;
  bill: Bill | null;
  onRemove: (index: number) => void;
  onReview: () => void;
}) {
  const qty = cart.length;
  const remaining = Math.max(0, DISCOUNT_THRESHOLD - qty);

  return (
    <aside className="card p-4 md:p-5 flex flex-col gap-4 md:sticky md:top-6">
      <div className="flex items-center gap-2">
        <ShoppingBag size={18} className="text-primary" aria-hidden />
        <h3 className="text-base font-semibold text-ink">Your cart</h3>
        <span className="tag-soft ml-auto">
          {qty} {qty === 1 ? "pizza" : "pizzas"}
        </span>
      </div>

      {qty === 0 ? (
        <p className="text-sm text-ink-mute">
          No pizzas yet — build one on the left and tap{" "}
          <span className="text-ink-secondary">Add to cart</span>.
        </p>
      ) : (
        <ul className="flex flex-col">
          {cart.map((li, i) => {
            const base = nameOf(menu.bases, li.baseCode);
            const pizza = nameOf(menu.pizzas, li.pizzaCode);
            const toppings = li.toppingCodes
              .map((c) => nameOf(menu.toppings, c))
              .filter(Boolean)
              .join(", ");
            const unit =
              priceOf(menu.bases, li.baseCode) +
              priceOf(menu.pizzas, li.pizzaCode) +
              li.toppingCodes.reduce((s, c) => s + priceOf(menu.toppings, c), 0);
            return (
              <li
                key={i}
                className="flex items-center gap-3 border-hairline py-2.5 [&:not(:first-child)]:border-t"
              >
                <span className="food-tile" aria-hidden>
                  {foodEmoji(pizza, "pizza")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm text-ink">
                    <VegMark veg={isVeg(pizza)} size={12} />
                    <span className="truncate">{pizza}</span>
                  </p>
                  <p className="truncate text-xs text-ink-mute">
                    {base} · {toppings}
                  </p>
                </div>
                <span className="tnum text-sm text-ink-secondary">{rupees(unit)}</span>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  aria-label={`Remove pizza ${i + 1}`}
                  className="text-ink-mute transition-colors hover:text-ruby"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {bill && qty > 0 && (
        <div className="space-y-1.5 border-t border-hairline pt-3 text-sm">
          <p className="eyebrow mb-1">— Bill details</p>
          <div className="flex items-baseline justify-between">
            <span className="text-ink-secondary">Subtotal</span>
            <span className="tnum text-ink-secondary">{rupees(bill.subtotalPaise)}</span>
          </div>
          {bill.discountApplied ? (
            <div className="flex items-baseline justify-between text-primary">
              <span>Bulk discount (10%)</span>
              <span className="tnum">− {rupees(bill.discountPaise)}</span>
            </div>
          ) : (
            remaining > 0 && (
              <p className="text-xs text-primary">
                Add {remaining} more {remaining === 1 ? "pizza" : "pizzas"} for 10% off.
              </p>
            )
          )}
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={qty === 0}
        onClick={onReview}
      >
        {qty > 0 && bill ? `Review bill · ${rupees(bill.totalPaise)}` : "Review bill"}
      </button>
    </aside>
  );
}

/** Sticky quick-CTA at the bottom on mobile (the desktop cart panel is always visible). */
export function CartBar({
  qty,
  bill,
  onReview,
}: {
  qty: number;
  bill: Bill | null;
  onReview: () => void;
}) {
  if (qty === 0) return null;
  return (
    <div className="sticky bottom-4 z-20 mt-6 md:hidden">
      <button
        type="button"
        onClick={onReview}
        className="cart-bar flex w-full items-center gap-3 px-5 py-3"
      >
        <ShoppingBag size={18} className="text-primary" aria-hidden />
        <span className="text-sm font-medium text-ink">
          {qty} {qty === 1 ? "pizza" : "pizzas"}
          {bill ? ` · ${rupees(bill.totalPaise)}` : ""}
        </span>
        <span className="ml-auto text-sm font-medium text-primary">Review bill →</span>
      </button>
    </div>
  );
}
