import { CheckCircle2 } from "lucide-react";
import type { Bill } from "@/lib/pricing";
import type { PaymentMode } from "@/lib/order-api";
import { BillTable } from "./BillTable";
import { PAYMENT_CONFIRMATION } from "./PaymentStep";

/**
 * Step 7 — confirmation (FR-12). Echoes the SAVED order (server bill + persisted
 * customer/payment) and the mode-specific message (FR-11). "New order" resets.
 */
export function Confirmation({
  customer,
  paymentMode,
  bill,
  onReset,
}: {
  customer: { name: string; phone: string };
  paymentMode: PaymentMode;
  bill: Bill;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 text-green">
        <CheckCircle2 size={22} aria-hidden />
        <p className="eyebrow !text-green">— Order confirmed</p>
      </div>
      <h2 className="text-2xl font-semibold text-ink">Thanks, {customer.name}!</h2>
      <p className="text-ink-secondary">
        Your order is in. {PAYMENT_CONFIRMATION[paymentMode]}
      </p>
      <p className="text-sm text-ink-mute">
        {bill.quantity} {bill.quantity === 1 ? "pizza" : "pizzas"} · {paymentMode} · {customer.phone}
      </p>

      <BillTable bill={bill} />

      <div>
        <button type="button" className="btn btn-primary" onClick={onReset}>
          New order
        </button>
      </div>
    </div>
  );
}
