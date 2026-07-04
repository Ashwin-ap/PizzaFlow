"use client";

import { useState } from "react";
import { qtySchema } from "@/lib/validation";
import { MIN_QTY, MAX_QTY } from "@/lib/pricing";

/**
 * Step 3 — quantity (FR-5). Text input (accepts "2.5"/"three" so the exact
 * range/cap messages can fire) validated with the shared qtySchema. Reveals
 * exactly N builder rows downstream (FR-6). Invalid → stay on step.
 */
export function QuantityStep({
  initial,
  onBack,
  onNext,
}: {
  initial: number | null;
  onBack: () => void;
  onNext: (qty: number) => void;
}) {
  const [value, setValue] = useState(initial ? String(initial) : "");
  const [error, setError] = useState<string | undefined>();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = qtySchema.safeParse(value);
    if (!r.success) {
      setError(r.error.issues[0].message);
      return;
    }
    setError(undefined);
    onNext(parseInt(String(value).trim(), 10));
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div>
        <p className="eyebrow mb-2">— Step 3 · Quantity</p>
        <h2 className="text-2xl font-semibold text-ink">How many pizzas?</h2>
        <p className="mt-1 text-sm text-ink-mute">
          Between {MIN_QTY} and {MAX_QTY} pizzas per order.
        </p>
      </div>

      <label htmlFor="qty" className="flex flex-col gap-1 max-w-[12rem]">
        <span className="text-sm text-ink-secondary">Number of pizzas</span>
        <input
          id="qty"
          name="qty"
          inputMode="numeric"
          className="input tnum"
          value={value}
          aria-invalid={!!error}
          aria-describedby={error ? "qty-error" : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(undefined);
          }}
        />
        {error && (
          <span id="qty-error" role="alert" aria-live="polite" className="field-error">
            {error}
          </span>
        )}
      </label>

      <div className="flex gap-3">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Back
        </button>
        <button type="submit" className="btn btn-primary">
          Continue
        </button>
      </div>
    </form>
  );
}
