"use client";

import { useState } from "react";
import { Banknote, CreditCard, Smartphone, Landmark, type LucideIcon } from "lucide-react";
import { rupees } from "@/lib/pricing";
import type { PaymentMode } from "@/lib/order-api";

const METHOD_META: Record<PaymentMode, { icon: LucideIcon; caption: string }> = {
  Cash: { icon: Banknote, caption: "Pay the rider on delivery" },
  Card: { icon: CreditCard, caption: "Credit or debit card" },
  UPI: { icon: Smartphone, caption: "GPay, PhonePe, Paytm & more" },
};

/** FR-11 — the three modes, in the PRD's 1/2/3 order, and their confirmation copy. */
export const PAYMENT_MODES: PaymentMode[] = ["Cash", "Card", "UPI"];

export const PAYMENT_CONFIRMATION: Record<PaymentMode, string> = {
  Cash: "Please keep cash ready — pay the rider on delivery.",
  Card: "Card payment confirmed.",
  UPI: "A UPI collect request has been sent to your number.",
};

// Demo bank list shown under "Card" — purely cosmetic (the order stays paymentMode "Card").
const BANKS = ["HDFC Bank", "ICICI Bank", "Kotak Mahindra", "State Bank of India", "Axis Bank"];

/**
 * Step 5 — payment (FR-11). Three modes as selectable method cards; selection can't
 * be empty, so it maps cleanly to the API enum. Card reveals a demo bank list; UPI
 * reveals a demo QR (both cosmetic). Placing the order triggers POST /api/orders.
 */
export function PaymentStep({
  value,
  onChange,
  onBack,
  onPlaceOrder,
  submitting,
  error,
  totalPaise,
}: {
  value: PaymentMode;
  onChange: (mode: PaymentMode) => void;
  onBack: () => void;
  onPlaceOrder: () => void;
  submitting: boolean;
  error?: string;
  totalPaise?: number;
}) {
  const [bank, setBank] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="eyebrow mb-2">— Step 5 · Payment</p>
        <h2 className="text-2xl font-semibold text-ink">How would you like to pay?</h2>
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-3" aria-label="Payment mode">
        {PAYMENT_MODES.map((mode) => {
          const { icon: Icon, caption } = METHOD_META[mode];
          const active = value === mode;
          return (
            <button
              key={mode}
              type="button"
              className={`select-card ${active ? "is-selected" : ""}`}
              aria-pressed={active}
              onClick={() => onChange(mode)}
            >
              <span className="food-tile" aria-hidden>
                <Icon size={18} className="text-primary" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">{mode}</span>
                <span className="block truncate text-xs text-ink-mute">{caption}</span>
              </span>
            </button>
          );
        })}
      </fieldset>

      {/* Card → demo bank chooser */}
      {value === "Card" && (
        <div>
          <p className="eyebrow mb-2">— Choose your bank</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {BANKS.map((b) => (
              <button
                key={b}
                type="button"
                className={`select-card ${bank === b ? "is-selected" : ""}`}
                aria-pressed={bank === b}
                onClick={() => setBank(b)}
              >
                <span className="food-tile" aria-hidden>
                  <Landmark size={18} className="text-primary" />
                </span>
                <span className="flex-1 text-sm font-medium text-ink">{b}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-mute">Demo only — no card details are collected.</p>
        </div>
      )}

      {/* UPI → demo QR */}
      {value === "UPI" && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-hairline bg-canvas-soft p-6 text-center">
          <FakeQR />
          <div>
            <p className="font-medium text-ink">
              Scan to pay{typeof totalPaise === "number" ? ` · ${rupees(totalPaise)}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-ink-mute">
              Open any UPI app (GPay, PhonePe, Paytm) and scan. Demo QR — not a real payment.
            </p>
          </div>
        </div>
      )}

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

/**
 * A convincing-looking but FAKE QR code (SVG). Three finder patterns + a deterministic
 * pseudo-random module fill (no Math.random → no hydration mismatch). Not scannable —
 * it's a demo placeholder for the UPI flow.
 */
function FakeQR({ size = 176 }: { size?: number }) {
  const N = 25; // modules per side
  const cell = size / (N + 2); // +1 module quiet zone on each side

  // 8×8 reserved boxes at 3 corners (7×7 finder + 1 separator).
  const inBox = (x: number, y: number, bx: number, by: number, s: number) =>
    x >= bx && x < bx + s && y >= by && y < by + s;
  const reserved = (x: number, y: number) =>
    inBox(x, y, 0, 0, 8) || inBox(x, y, N - 8, 0, 8) || inBox(x, y, 0, N - 8, 8);
  const finderOn = (x: number, y: number) => {
    const ring = (bx: number, by: number) => {
      const lx = x - bx;
      const ly = y - by;
      if (lx < 0 || lx > 6 || ly < 0 || ly > 6) return false;
      const edge = lx === 0 || lx === 6 || ly === 0 || ly === 6;
      const core = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4;
      return edge || core;
    };
    return ring(0, 0) || ring(N - 7, 0) || ring(0, N - 7);
  };
  // Deterministic hash → ~46% module density in the data area.
  const on = (x: number, y: number) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 100 < 46;

  const rects: React.ReactNode[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const filled = reserved(x, y) ? finderOn(x, y) : on(x, y);
      if (filled) {
        rects.push(
          <rect
            key={`${x}-${y}`}
            x={(x + 1) * cell}
            y={(y + 1) * cell}
            width={cell + 0.4}
            height={cell + 0.4}
          />,
        );
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label="Demo UPI QR code"
    >
      <rect x="0" y="0" width={size} height={size} rx="12" fill="#ffffff" />
      <g fill="#1c1c1c">{rects}</g>
    </svg>
  );
}
