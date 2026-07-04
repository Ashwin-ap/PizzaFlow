import { rupees } from "@/lib/pricing";
import type { MenuItem } from "@/lib/order-api";

/**
 * One category's items as a labelled <select> (PRD §16.1 "MenuList").
 * Selection-based (the chosen build decision) — a customer picks from the list,
 * so an invalid item index can never be entered (edge cases #4/#5 can't fire here).
 */
export function MenuList({
  id,
  label,
  items,
  value,
  onChange,
}: {
  id: string;
  label: string;
  items: MenuItem[];
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-sm">
      <span className="text-ink-secondary">{label}</span>
      <select
        id={id}
        className="input tnum"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {items.map((it) => (
          <option key={it.code} value={it.code}>
            {it.name} — {rupees(it.pricePaise)}
          </option>
        ))}
      </select>
    </label>
  );
}
