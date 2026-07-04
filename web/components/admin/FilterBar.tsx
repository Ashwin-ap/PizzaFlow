"use client";

import type { AdminFilter } from "@/lib/admin-api";

type Payment = "Cash" | "Card" | "UPI";

// Date presets compute a `from` (relative window up to now); "All time" clears it.
const DATE_PRESETS: { key: string; label: string; days: number | null }[] = [
  { key: "24h", label: "Last 24h", days: 1 },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "all", label: "All time", days: null },
];

const PAYMENTS: Payment[] = ["Cash", "Card", "UPI"];

// Module-level (not during render) so reading the clock is allowed.
function presetFrom(days: number | null): string | undefined {
  return days == null ? undefined : new Date(Date.now() - days * 86_400_000).toISOString();
}

/** Date-range + payment-mode filters (FR-14) as chip rows. `presetKey` tracks the
 *  active date chip since `from` alone can't be reverse-matched exactly. */
export function FilterBar({
  filter,
  presetKey,
  onChange,
}: {
  filter: AdminFilter;
  presetKey: string;
  onChange: (next: { filter: AdminFilter; presetKey: string }) => void;
}) {
  function setPreset(p: (typeof DATE_PRESETS)[number]) {
    onChange({ filter: { ...filter, from: presetFrom(p.days), to: undefined }, presetKey: p.key });
  }
  function setPayment(mode: Payment | undefined) {
    onChange({ filter: { ...filter, payment: mode }, presetKey });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-mute mr-1">Period</span>
        {DATE_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`chip ${presetKey === p.key ? "is-active" : ""}`}
            aria-pressed={presetKey === p.key}
            onClick={() => setPreset(p)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-mute mr-1">Payment</span>
        <button
          type="button"
          className={`chip ${!filter.payment ? "is-active" : ""}`}
          aria-pressed={!filter.payment}
          onClick={() => setPayment(undefined)}
        >
          All
        </button>
        {PAYMENTS.map((m) => (
          <button
            key={m}
            type="button"
            className={`chip ${filter.payment === m ? "is-active" : ""}`}
            aria-pressed={filter.payment === m}
            onClick={() => setPayment(m)}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
