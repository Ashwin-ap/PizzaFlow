import { rupees, GST_RATE, DISCOUNT_RATE, DISCOUNT_THRESHOLD, type Bill } from "@/lib/pricing";

/**
 * Itemised "retail invoice" (FR-10) — the Stage-2 receipt look: a branded header,
 * a customer block, a bordered Description/Price table with a per-pizza breakdown
 * (crust + all toppings), the summary rows and a bold GRAND TOTAL, then the receipt
 * footer. Rendered in the project theme (Cardinal Red + Obsidian, JetBrains-Mono
 * body). The `bill` is exactly what computeBill() produced — agrees with the server
 * to the paise.
 */
export function BillTable({
  bill,
  customerName,
  customerPhone,
  timestamp,
}: {
  bill: Bill;
  customerName?: string;
  customerPhone?: string;
  timestamp?: string;
}) {
  const pct = (r: number) => `${Math.round(r * 100)}%`;
  const remaining = Math.max(0, DISCOUNT_THRESHOLD - bill.quantity);

  return (
    <div
      className="card mx-auto max-w-xl p-6 md:p-8"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {/* Brand header */}
      <div className="text-center">
        <p className="text-xl font-bold text-primary md:text-2xl">🍕 SliceMatic Pizza Kitchen 🍕</p>
        <p className="mt-1 text-sm text-ink-mute">Crafting Happiness, One Slice at a Time</p>
      </div>

      <Dashed />

      <p className="text-center text-lg font-bold tracking-[0.35em] text-ink">RETAIL INVOICE</p>

      {(customerName || customerPhone || timestamp) && (
        <div className="mt-4 space-y-1 text-sm">
          {customerName && (
            <p>
              <span className="font-bold text-ink">Customer:</span>{" "}
              <span className="text-ink-secondary">{customerName}</span>
            </p>
          )}
          {customerPhone && (
            <p>
              <span className="font-bold text-ink">Phone:</span>{" "}
              <span className="tnum text-ink-secondary">{customerPhone}</span>
            </p>
          )}
          {timestamp && (
            <p>
              <span className="font-bold text-ink">Timestamp:</span>{" "}
              <span className="tnum text-ink-secondary">{timestamp}</span>
            </p>
          )}
        </div>
      )}

      <Dashed />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <Th>Description</Th>
              <Th>Price</Th>
            </tr>
          </thead>
          <tbody>
            {bill.lineItems.map((li, i) => (
              <tr key={i}>
                <Td className="align-top">
                  <span className="font-bold text-ink">
                    🍕 {li.pizza.name} <span className="font-normal text-ink-mute">(x1)</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-mute">
                    Crust: {li.base.name} | Toppings: {li.toppings.map((t) => t.name).join(", ")}
                  </span>
                </Td>
                <Td className="align-top tnum text-ink-secondary">{rupees(li.unitPricePaise)}</Td>
              </tr>
            ))}

            <SummaryRow label="Total Items:" value={`${bill.quantity} ${bill.quantity === 1 ? "pizza" : "pizzas"}`} />
            <SummaryRow label="Subtotal:" value={rupees(bill.subtotalPaise)} />
            <SummaryRow
              label={bill.discountApplied ? `Discount (${pct(DISCOUNT_RATE)}):` : "Discount:"}
              value={bill.discountApplied ? `− ${rupees(bill.discountPaise)}` : rupees(0)}
              accent={bill.discountApplied}
            />
            <SummaryRow label={`GST (${pct(GST_RATE)}):`} value={`+${rupees(bill.gstPaise)}`} />

            <tr>
              <td
                className="border-x border-hairline px-3 py-3 text-base font-bold text-ink"
                style={{ borderTop: "2px solid var(--color-ink)" }}
              >
                GRAND TOTAL:
              </td>
              <td
                className="tnum border-x border-hairline px-3 py-3 text-base font-bold text-ink"
                style={{ borderTop: "2px solid var(--color-ink)" }}
              >
                {rupees(bill.totalPaise)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Dashed />

      <div className="space-y-1.5 text-center text-sm text-ink-mute">
        {remaining > 0 && (
          <p>
            Add {remaining} more pizza(s) to unlock {pct(DISCOUNT_RATE)} bulk discount.
          </p>
        )}
        <p>Thank you for choosing SliceMatic!</p>
        <p>Your order details are locked for checkout.</p>
      </div>
    </div>
  );
}

function Dashed() {
  return <div className="my-4" style={{ borderTop: "1.5px dashed var(--color-ink-mute)" }} />;
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border border-hairline px-3 py-2 text-left font-bold text-ink">{children}</th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`border border-hairline px-3 py-2 ${className}`}>{children}</td>;
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <tr>
      <Td className="text-ink-secondary">{label}</Td>
      <Td className={`tnum ${accent ? "text-primary" : "text-ink-secondary"}`}>{value}</Td>
    </tr>
  );
}
