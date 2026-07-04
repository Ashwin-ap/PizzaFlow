import { rupees } from "@/lib/pricing";
import type { Menu, OrderLineItem, MenuItem } from "@/lib/order-api";
import { MenuList } from "./MenuList";

const priceOf = (items: MenuItem[], code: string) =>
  items.find((i) => i.code === code)?.pricePaise ?? 0;

/**
 * One configured pizza (FR-8) — a base + pizza + topping picked from the menu,
 * plus the live unit price. Exactly `quantity` of these are revealed (FR-6).
 * Built on the `.card` recipe (PRD §16.2).
 */
export function PizzaBuilderRow({
  index,
  menu,
  value,
  onChange,
}: {
  index: number;
  menu: Menu;
  value: OrderLineItem;
  onChange: (next: OrderLineItem) => void;
}) {
  const unitPaise =
    priceOf(menu.bases, value.baseCode) +
    priceOf(menu.pizzas, value.pizzaCode) +
    priceOf(menu.toppings, value.toppingCode);

  return (
    <div className="card p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="tag-soft">Pizza {index + 1}</span>
        <span className="tnum text-sm text-ink-secondary">{rupees(unitPaise)}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <MenuList
          id={`base-${index}`}
          label="Base"
          items={menu.bases}
          value={value.baseCode}
          onChange={(baseCode) => onChange({ ...value, baseCode })}
        />
        <MenuList
          id={`pizza-${index}`}
          label="Pizza"
          items={menu.pizzas}
          value={value.pizzaCode}
          onChange={(pizzaCode) => onChange({ ...value, pizzaCode })}
        />
        <MenuList
          id={`topping-${index}`}
          label="Topping"
          items={menu.toppings}
          value={value.toppingCode}
          onChange={(toppingCode) => onChange({ ...value, toppingCode })}
        />
      </div>
    </div>
  );
}
