"use client";

import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { rupees, MAX_TOPPINGS } from "@/lib/pricing";
import type { Menu, MenuItem, OrderLineItem } from "@/lib/order-api";
import { PickCard } from "./PickCard";
import { VegMark } from "./VegMark";
import { isVeg, pizzaPhoto, type FoodCategory } from "@/lib/food-emoji";

const priceOf = (items: MenuItem[], code: string) =>
  items.find((i) => i.code === code)?.pricePaise ?? 0;
const nameOf = (items: MenuItem[], code: string) =>
  items.find((i) => i.code === code)?.name ?? "";

/**
 * The Build step (FR-6/FR-8) — visible tap-to-pick menu. Base & pizza are single-
 * select; toppings are MULTI-select (1–5 per pizza). A live "Your pizza" panel shows
 * the veg mark, a real photo of the chosen pizza, and the unit price. "Add to cart"
 * pushes it to the parent cart, which then clears the draft to a clean slate.
 */
export function PizzaBuilder({
  menu,
  value,
  onChange,
  onAdd,
  cartCount,
  max,
}: {
  menu: Menu;
  value: OrderLineItem;
  onChange: (next: OrderLineItem) => void;
  onAdd: () => void;
  cartCount: number;
  max: number;
}) {
  const [flash, setFlash] = useState(false);
  const full = cartCount >= max;

  const toppingSum = value.toppingCodes.reduce((s, c) => s + priceOf(menu.toppings, c), 0);
  const unitPaise =
    (value.baseCode ? priceOf(menu.bases, value.baseCode) : 0) +
    (value.pizzaCode ? priceOf(menu.pizzas, value.pizzaCode) : 0) +
    toppingSum;

  // A pizza is addable only once base + pizza + at least one topping are chosen.
  const complete = !!value.baseCode && !!value.pizzaCode && value.toppingCodes.length >= 1;
  const atToppingCap = value.toppingCodes.length >= MAX_TOPPINGS;

  const pizzaName = nameOf(menu.pizzas, value.pizzaCode);
  const toppingsLabel = value.toppingCodes
    .map((c) => nameOf(menu.toppings, c))
    .filter(Boolean)
    .join(", ");
  const summary = [nameOf(menu.bases, value.baseCode), pizzaName, toppingsLabel]
    .filter(Boolean)
    .join(" · ");

  function toggleTopping(code: string) {
    if (value.toppingCodes.includes(code)) {
      onChange({ ...value, toppingCodes: value.toppingCodes.filter((c) => c !== code) });
    } else if (!atToppingCap) {
      onChange({ ...value, toppingCodes: [...value.toppingCodes, code] });
    }
  }

  function add() {
    if (full || !complete) return;
    onAdd(); // parent appends to cart AND resets the draft to a clean slate
    setFlash(true);
    window.setTimeout(() => setFlash(false), 1100);
  }

  return (
    <div className="flex flex-col gap-6">
      <Section
        label="1 · Choose your base"
        items={menu.bases}
        category="base"
        isSelected={(c) => value.baseCode === c}
        onSelect={(baseCode) => onChange({ ...value, baseCode })}
      />
      <Section
        label="2 · Choose your pizza"
        items={menu.pizzas}
        category="pizza"
        isSelected={(c) => value.pizzaCode === c}
        onSelect={(pizzaCode) => onChange({ ...value, pizzaCode })}
      />
      <Section
        label="3 · Add toppings"
        items={menu.toppings}
        category="topping"
        count={`${value.toppingCodes.length}/${MAX_TOPPINGS}`}
        isSelected={(c) => value.toppingCodes.includes(c)}
        disabledUnselected={atToppingCap}
        onSelect={toggleTopping}
      />

      <div className="card p-4 md:p-5 flex flex-wrap items-center gap-4">
        {complete && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pizzaPhoto(pizzaName)}
            alt=""
            className="h-20 w-20 shrink-0 rounded-2xl object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-1">— Your pizza</p>
          <p className="flex items-center gap-1.5 font-medium text-ink">
            {pizzaName && <VegMark veg={isVeg(pizzaName)} />}
            <span className="truncate">{summary || "Pick a base, pizza & toppings"}</span>
          </p>
          <p className="tnum mt-0.5 text-sm text-ink-secondary">{rupees(unitPaise)} each</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={add}
          disabled={full || !complete}
          aria-live="polite"
        >
          {flash ? (
            <>
              <Check size={16} aria-hidden /> Added
            </>
          ) : full ? (
            "Cart full"
          ) : (
            <>
              <Plus size={16} aria-hidden /> Add to cart
            </>
          )}
        </button>
      </div>
      {atToppingCap && (
        <p className="text-xs text-ink-mute">Up to {MAX_TOPPINGS} toppings per pizza.</p>
      )}
      {full && (
        <p className="text-xs text-ink-mute">Maximum {max} pizzas per order — review your bill to continue.</p>
      )}
    </div>
  );
}

function Section({
  label,
  items,
  category,
  count,
  isSelected,
  onSelect,
  disabledUnselected,
}: {
  label: string;
  items: MenuItem[];
  category: FoodCategory;
  count?: string;
  isSelected: (code: string) => boolean;
  onSelect: (code: string) => void;
  disabledUnselected?: boolean;
}) {
  return (
    <div>
      <p className="eyebrow mb-2.5">
        {label} <span className="text-ink-mute">({count ?? items.length})</span>
      </p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {items.map((it) => {
          const selected = isSelected(it.code);
          return (
            <PickCard
              key={it.code}
              item={it}
              category={category}
              selected={selected}
              disabled={!selected && !!disabledUnselected}
              onSelect={() => onSelect(it.code)}
            />
          );
        })}
      </div>
    </div>
  );
}
