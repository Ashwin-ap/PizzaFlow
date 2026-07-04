import { rupees, type Bill } from "@/lib/pricing";
import { GST_RATE, DISCOUNT_RATE } from "@/lib/pricing";

/**
 * Itemised bill (FR-10) — a real table, not a textbox. Every numeric cell uses
 * `.tnum` and is right-aligned so the ₹ amounts align on the decimal. The summary
 * sits in a recessed `canvas-soft` panel (PRD §16.2). The `bill` is whatever
 * computeBill() produced — identical to the server's, so it agrees to the paise.
 */
export function BillTable({ bill }: { bill: Bill }) {
  const pct = (r: number) => `${Math.round(r * 100)}%`;
  return (
    <div className="bg-canvas-soft border border-hairline rounded-2xl p-4 md:p-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-mute">
              <th className="py-2 pr-2 font-medium">#</th>
              <th className="py-2 pr-2 font-medium">Base</th>
              <th className="py-2 pr-2 font-medium">Pizza</th>
              <th className="py-2 pr-2 font-medium">Topping</th>
              <th className="py-2 pl-2 font-medium text-right">Unit</th>
            </tr>
          </thead>
          <tbody>
            {bill.lineItems.map((li, i) => (
              <tr key={i} className="border-t border-hairline align-top">
                <td className="py-2 pr-2 tnum text-ink-mute">{i + 1}</td>
                <td className="py-2 pr-2 text-ink-secondary">
                  {li.base.name}
                  <span className="tnum text-ink-mute"> · {rupees(li.base.pricePaise)}</span>
                </td>
                <td className="py-2 pr-2 text-ink-secondary">
                  {li.pizza.name}
                  <span className="tnum text-ink-mute"> · {rupees(li.pizza.pricePaise)}</span>
                </td>
                <td className="py-2 pr-2 text-ink-secondary">
                  {li.topping.name}
                  <span className="tnum text-ink-mute"> · {rupees(li.topping.pricePaise)}</span>
                </td>
                <td className="py-2 pl-2 tnum text-right text-ink">{rupees(li.unitPricePaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-4 space-y-1.5 border-t border-hairline pt-4 text-sm">
        <Row label={`Subtotal (${bill.quantity} ${bill.quantity === 1 ? "pizza" : "pizzas"})`} value={rupees(bill.subtotalPaise)} />
        {bill.discountApplied && (
          <Row label={`Discount (${pct(DISCOUNT_RATE)})`} value={`− ${rupees(bill.discountPaise)}`} accent="green" />
        )}
        <Row label={`GST (${pct(GST_RATE)})`} value={rupees(bill.gstPaise)} />
        <div className="flex items-baseline justify-between border-t border-hairline pt-2 mt-1">
          <dt className="text-base font-semibold text-ink">Total</dt>
          <dd className="tnum text-lg font-semibold text-ink">{rupees(bill.totalPaise)}</dd>
        </div>
      </dl>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: "green" }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className={`tnum ${accent === "green" ? "text-green" : "text-ink-secondary"}`}>{value}</dd>
    </div>
  );
}
