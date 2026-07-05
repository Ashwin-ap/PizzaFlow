import { Check } from "lucide-react";
import { rupees } from "@/lib/pricing";
import type { MenuItem } from "@/lib/order-api";
import { foodEmoji, isVeg, type FoodCategory } from "@/lib/food-emoji";
import { VegMark } from "./VegMark";

/**
 * One selectable menu tile (tap to pick), styled like a food-delivery menu row:
 * a "photo" gradient tile, the veg/non-veg mark beside the name, the price, and a
 * Swiggy-style ADD pill that fills in when chosen. Single-select per category; the
 * selection is a code, so an out-of-range item can never be entered.
 */
export function PickCard({
  item,
  category,
  selected,
  onSelect,
  disabled = false,
}: {
  item: MenuItem;
  category: FoodCategory;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`select-card ${selected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
    >
      <span className="food-tile food-tile-lg" aria-hidden>
        {foodEmoji(item.name, category)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-0.5 flex items-center gap-1.5">
          <VegMark veg={isVeg(item.name)} />
          <span className="truncate text-sm font-semibold text-ink">{item.name}</span>
        </span>
        <span className="tnum block text-xs font-medium text-ink-secondary">{rupees(item.pricePaise)}</span>
      </span>
      <span className="add-pill" aria-hidden>
        {selected ? (
          <>
            <Check size={12} strokeWidth={3} /> Added
          </>
        ) : (
          "Add"
        )}
      </span>
    </button>
  );
}
