"use client";

import type { PaymentMode } from "@/lib/order-api";

/** FR-11 — the three modes, in the PRD's 1/2/3 order, and their confirmation copy. */
export const PAYMENT_MODES: PaymentMode[] = ["Cash", "Card", "UPI"];

export const PAYMENT_CONFIRMATION: Record<PaymentMode, string> = {
  Cash: "Please keep cash ready — pay the rider on delivery.",
  Card: "Card payment confirmed.",
  UPI: "A UPI collect request has been sent to your number.",
};

/**
 * Step 6 — payment (FR-11). Exactly three modes; selection can't be empty (a
 * mode is always chosen), so this step maps cleanly to the API enum. Placing the
 * order triggers the server-authoritative POST /api/orders.
 */
export function PaymentStep({
  value,
  onChange,
  onBack,
  onPlaceOrder,
  submitting,
  error,
}: {
  value: PaymentMode;
  onChange: (mode: PaymentMode) => void;
  onBack: () => void;
  onPlaceOrder: () => void;
  submitting: boolean;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="eyebrow mb-2">— Step 6 · Payment</p>
        <h2 className="text-2xl font-semibold text-ink">How would you like to pay?</h2>
      </div>

      <fieldset className="flex flex-wrap gap-3" aria-label="Payment mode">
        {PAYMENT_MODES.map((mode, i) => (
          <button
            key={mode}
            type="button"
            className={`chip ${value === mode ? "is-active" : ""}`}
            aria-pressed={value === mode}
            onClick={() => onChange(mode)}
          >
            {i + 1} · {mode}
          </button>
        ))}
      </fieldset>

      {error && (
        <p role="alert" aria-live="polite" className="field-error">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="button" className="btn btn-secondary" onClick={onBack} disabled={submitting}>
          Back
        </button>
        <button type="button" className="btn btn-primary" onClick={onPlaceOrder} disabled={submitting}>
          {submitting ? "Placing order…" : "Place order"}
        </button>
      </div>
    </div>
  );
}
