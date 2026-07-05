"use client";

import { useEffect, useState } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import {
  fetchRecommendation,
  type Recommendation,
  type Menu,
  type OrderLineItem,
} from "@/lib/order-api";
import { rupees } from "@/lib/pricing";
import { foodEmoji, isVeg } from "@/lib/food-emoji";
import { VegMark } from "./VegMark";
import { CravingsRail, type Craving } from "./CravingsRail";

const nameOf = (items: { code: string; name: string }[], code: string) =>
  items.find((i) => i.code === code)?.name ?? "";
const priceOf = (items: { code: string; pricePaise: number }[], code: string) =>
  items.find((i) => i.code === code)?.pricePaise ?? 0;

/**
 * Step 2 — AI "Recommended for you" (FR-4, Feature A) + the running list of pizzas
 * the customer picked from the Details-page cravings rail. Each pick shows here with
 * a Remove control (they're also removable from the Build-step cart). Recommendation
 * fetch NEVER blocks ordering: any transport failure still shows a way forward.
 */
export function RecommendCard({
  phone,
  cached,
  onFetched,
  cart,
  menu,
  onRemovePick,
  onPickCraving,
  onUseThis,
  onSkip,
}: {
  phone: string;
  cached: Recommendation | null;
  onFetched: (rec: Recommendation) => void;
  cart: OrderLineItem[];
  menu: Menu | null;
  onRemovePick: (index: number) => void;
  onPickCraving: (craving: Craving) => void;
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

  const recImg = rec
    ? isVeg(`${rec.pizzaName} ${rec.toppingName}`)
      ? "/food/veggie.jpg"
      : "/food/pepperoni.jpg"
    : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="eyebrow mb-2">— Step 2 · Recommended for you</p>
        <h2 className="text-2xl font-semibold text-ink">A pick, just for you</h2>
      </div>

      {/* Your picks — pizzas added from the cravings rail (removable here or in the cart). */}
      {menu && cart.length > 0 && (
        <div className="card p-4 md:p-5">
          <div className="mb-1 flex items-center justify-between">
            <p className="eyebrow">— Your picks</p>
            <span className="tag-soft">{cart.length}</span>
          </div>
          <ul className="flex flex-col">
            {cart.map((li, i) => {
              const pizza = nameOf(menu.pizzas, li.pizzaCode);
              const base = nameOf(menu.bases, li.baseCode);
              const toppings = li.toppingCodes
                .map((c) => nameOf(menu.toppings, c))
                .filter(Boolean)
                .join(", ");
              const unit =
                priceOf(menu.bases, li.baseCode) +
                priceOf(menu.pizzas, li.pizzaCode) +
                li.toppingCodes.reduce((s, c) => s + priceOf(menu.toppings, c), 0);
              return (
                <li
                  key={i}
                  className="flex items-center gap-3 border-hairline py-2.5 [&:not(:first-child)]:border-t"
                >
                  <span className="food-tile" aria-hidden>
                    {foodEmoji(pizza, "pizza")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm text-ink">
                      <VegMark veg={isVeg(pizza)} size={12} />
                      <span className="truncate">{pizza}</span>
                    </p>
                    <p className="truncate text-xs text-ink-mute">
                      {base} · {toppings}
                    </p>
                  </div>
                  <span className="tnum text-sm text-ink-secondary">{rupees(unit)}</span>
                  <button
                    type="button"
                    onClick={() => onRemovePick(i)}
                    aria-label={`Remove pick ${i + 1}`}
                    className="text-ink-mute transition-colors hover:text-primary"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-ink-mute">
            You can edit or remove these on the Build step too.
          </p>
        </div>
      )}

      <div className="card overflow-hidden" aria-live="polite">
        {loading ? (
          <div className="flex items-center gap-3 p-6 text-ink-mute">
            <Sparkles size={20} className="shrink-0 text-primary" aria-hidden />
            Finding a pick you&apos;ll love…
          </div>
        ) : rec && recImg ? (
          <div className="grid sm:grid-cols-[210px_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={recImg} alt="" className="rec-photo h-44 w-full sm:h-full" />
            <div className="flex flex-col gap-2 p-5">
              <span className="tag-soft inline-flex w-fit items-center gap-1">
                <Sparkles size={11} aria-hidden /> AI pick for you
              </span>
              <p className="flex items-center gap-2 text-xl font-semibold text-ink">
                <VegMark veg={isVeg(rec.pizzaName)} /> {rec.pizzaName}
              </p>
              <p className="text-sm text-ink-secondary">
                <span className="text-ink-mute">with</span> {rec.toppingName}
              </p>
              <p className="text-sm text-ink-secondary">{rec.reason}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                <button type="button" className="btn btn-primary" onClick={() => onUseThis(rec)}>
                  Use this pick
                </button>
                <button type="button" className="btn btn-secondary" onClick={onSkip}>
                  {cart.length > 0 ? "Continue" : "No thanks"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4 p-6">
            <p className="text-ink-secondary">
              {failed ? "No suggestion right now — build your own on the next step." : ""}
            </p>
            <button type="button" className="btn btn-secondary" onClick={onSkip}>
              Continue
            </button>
          </div>
        )}
      </div>

      <CravingsRail title="More to crave" onPick={onPickCraving} />
    </div>
  );
}
