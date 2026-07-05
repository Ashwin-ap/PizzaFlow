import { CheckCircle2 } from "lucide-react";
import type { Bill } from "@/lib/pricing";
import type { PaymentMode } from "@/lib/order-api";
import { BillTable } from "./BillTable";
import { PAYMENT_CONFIRMATION } from "./PaymentStep";

/**
 * Step 6 — confirmation (FR-12). Echoes the SAVED order (server bill + persisted
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
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
        <span
          className="flex h-16 w-16 items-center justify-center rounded-full text-primary"
          style={{ backgroundColor: "rgba(203, 32, 45, 0.1)" }}
          aria-hidden
        >
          <CheckCircle2 size={34} />
        </span>
        <p className="eyebrow !text-primary">— Order confirmed</p>
        <h2 className="text-2xl font-semibold text-ink">Thanks, {customer.name}! 🍕</h2>
        <p className="max-w-md text-ink-secondary">
          Your order is in. {PAYMENT_CONFIRMATION[paymentMode]}
        </p>
        <p className="tnum text-sm text-ink-mute">
          {bill.quantity} {bill.quantity === 1 ? "pizza" : "pizzas"} · {paymentMode} · {customer.phone}
        </p>
      </div>

      <BillTable bill={bill} />

      <div>
        <button type="button" className="btn btn-primary" onClick={onReset}>
          Start a new order
        </button>
      </div>
    </div>
  );
}
