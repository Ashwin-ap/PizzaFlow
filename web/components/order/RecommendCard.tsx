"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { fetchRecommendation, type Recommendation } from "@/lib/order-api";

/**
 * Step 2 — AI "Recommended for you" (FR-4, Feature A). Fetches a pizza+topping pick
 * for the phone and offers "Use this" (prefills the builder) or "No thanks". It NEVER
 * blocks ordering: on any transport failure it still shows a way forward. The pick is
 * cached in the parent so re-entering the step (Back) doesn't refetch.
 */
export function RecommendCard({
  phone,
  cached,
  onFetched,
  onUseThis,
  onSkip,
}: {
  phone: string;
  cached: Recommendation | null;
  onFetched: (rec: Recommendation) => void;
  onUseThis: (rec: Recommendation) => void;
  onSkip: () => void;
}) {
  const [rec, setRec] = useState<Recommendation | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (cached) return; // already have it — no refetch (loading already starts true)
    let alive = true;
    fetchRecommendation(phone)
      .then((r) => {
        if (!alive) return;
        if (r.ok) {
          setRec(r.data.recommendation);
          onFetched(r.data.recommendation);
        } else {
          setFailed(true);
        }
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="eyebrow mb-2">— Step 2 · Recommended for you</p>
        <h2 className="text-2xl font-semibold text-ink">A pick, just for you</h2>
      </div>

      <div className="card p-5 flex items-start gap-3" aria-live="polite">
        <Sparkles size={20} className="mt-0.5 text-primary shrink-0" aria-hidden />
        {loading ? (
          <p className="text-ink-mute">Finding a pick you&apos;ll love…</p>
        ) : rec ? (
          <div>
            <p className="text-ink font-medium">
              {rec.pizzaName} <span className="text-ink-mute">with</span> {rec.toppingName}
            </p>
            <p className="mt-1 text-sm text-ink-secondary">{rec.reason}</p>
          </div>
        ) : (
          <p className="text-ink-secondary">
            {failed ? "No suggestion right now — build your own on the next step." : ""}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {rec && (
          <button type="button" className="btn btn-primary" onClick={() => onUseThis(rec)}>
            Use this
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={onSkip}>
          {rec ? "No thanks" : "Continue"}
        </button>
      </div>
    </div>
  );
}
