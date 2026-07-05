"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { computeBill, MAX_QTY, type Selected } from "@/lib/pricing";
import { orderBodySchema } from "@/lib/validation";
import {
  fetchMenu,
  submitOrder,
  type Menu,
  type MenuItem,
  type OrderLineItem,
  type OrderResult,
  type PaymentMode,
  type Recommendation,
} from "@/lib/order-api";
import { IntakeForm } from "./IntakeForm";
import { RecommendCard } from "./RecommendCard";
import { PizzaBuilder } from "./PizzaBuilder";
import { Cart, CartBar } from "./Cart";
import { BillTable } from "./BillTable";
import type { Craving } from "./CravingsRail";
import { PaymentStep } from "./PaymentStep";
import { Confirmation } from "./Confirmation";

type Step = "intake" | "recommend" | "builder" | "bill" | "payment" | "confirm";

const STEPS: { key: Step; label: string }[] = [
  { key: "intake", label: "Details" },
  { key: "recommend", label: "For you" },
  { key: "builder", label: "Build" },
  { key: "bill", label: "Bill" },
  { key: "payment", label: "Payment" },
  { key: "confirm", label: "Done" },
];

const find = (items: MenuItem[], code: string) => items.find((i) => i.code === code);
const priced = (it: MenuItem | undefined) =>
  it ? { code: it.code, name: it.name, pricePaise: it.pricePaise } : { code: "", name: "", pricePaise: 0 };

/** A menu is usable only if every category has at least one available item (FR-9). */
const menuUsable = (m: Menu) => m.bases.length > 0 && m.pizzas.length > 0 && m.toppings.length > 0;

/** A clean-slate pizza: nothing selected yet (the builder resets to this after each add). */
const emptyDraft = (): OrderLineItem => ({ baseCode: "", pizzaCode: "", toppingCodes: [] });

/** Local wall-clock time as `YYYY-MM-DD HH:MM:SS` for the invoice header. */
const formatTs = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

export function Stepper() {
  const [step, setStep] = useState<Step>("intake");
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [customer, setCustomer] = useState({ name: "", phone: "" });

  // The cart IS the order — quantity emerges from it (min 1 to proceed, capped at
  // MAX_QTY). `draft` is the pizza currently being built in the tap-to-pick menu.
  const [cart, setCart] = useState<OrderLineItem[]>([]);
  const [draft, setDraft] = useState<OrderLineItem | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("Cash");
  // Invoice timestamp — stamped once when the bill is opened (stable across re-renders).
  const [billAt, setBillAt] = useState<string | null>(null);

  // AI recommendation (Feature A): cached so re-entry doesn't refetch. Accepting a
  // pick adds it straight to the cart (see useRecommendation) — the builder always
  // opens on a clean slate.
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);

  const [menu, setMenu] = useState<Menu | null>(null);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<OrderResult | null>(null);

  async function loadMenu() {
    setMenuLoading(true);
    setMenuError(null);
    const r = await fetchMenu();
    if (r.ok && menuUsable(r.data)) {
      setMenu(r.data);
    } else {
      setMenu(null);
      setMenuError(r.ok ? "The menu is currently unavailable. Ordering is paused." : r.message);
    }
    setMenuLoading(false);
  }

  // Load the menu once on mount (FR-7); ordering is gated on it (FR-9).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMenu();
  }, []);

  // Entering the Build step always opens on a fully-empty clean slate — nothing
  // pre-selected — so the customer picks base / pizza / toppings from scratch.
  useEffect(() => {
    if (step !== "builder" || !menu || draft) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(emptyDraft());
  }, [step, menu, draft]);

  const previewBill =
    menu && cart.length > 0
      ? computeBill(
          cart.map<Selected>((s) => ({
            base: priced(find(menu.bases, s.baseCode)),
            pizza: priced(find(menu.pizzas, s.pizzaCode)),
            toppings: s.toppingCodes.map((c) => priced(find(menu.toppings, c))),
          })),
        )
      : null;

  /** Append a fully-configured pizza to the cart (capped at MAX_QTY). */
  function addLine(line: OrderLineItem) {
    setCart((c) => (c.length >= MAX_QTY ? c : [...c, line]));
  }

  /** Builder "Add to cart": commit the draft, then reset to a clean slate. */
  function addDraftToCart() {
    if (!draft || cart.length >= MAX_QTY) return;
    if (!draft.baseCode || !draft.pizzaCode || draft.toppingCodes.length === 0) return;
    setCart((c) => [...c, draft]);
    setDraft(emptyDraft());
  }

  /** Accept the AI pick — add it to the cart (default base + the recommended
   *  pizza + topping), then continue to the (clean-slate) builder. */
  function useRecommendation(rec: Recommendation) {
    const base = menu?.bases[0];
    if (base) {
      addLine({ baseCode: base.code, pizzaCode: rec.pizzaCode, toppingCodes: [rec.toppingCode] });
    }
    setStep("builder");
  }

  /** Resolve a "What's on your mind" craving to a concrete pizza line (default
   *  base + first topping; the pizza is matched by name, falling back to the first). */
  function pickCraving(cr: Craving) {
    if (!menu) return;
    const pizza = menu.pizzas.find((p) => cr.match.test(p.name)) ?? menu.pizzas[0];
    const base = menu.bases[0];
    const topping = menu.toppings[0];
    if (!pizza || !base || !topping) return;
    addLine({ baseCode: base.code, pizzaCode: pizza.code, toppingCodes: [topping.code] });
  }

  function removeFromCart(index: number) {
    setCart((c) => c.filter((_, i) => i !== index));
  }

  /** Open the bill step, stamping the invoice time once. */
  function openBill() {
    setBillAt(formatTs(new Date()));
    setStep("bill");
  }

  function reset() {
    setStep("intake");
    setSessionStartedAt(null);
    setCustomer({ name: "", phone: "" });
    setCart([]);
    setDraft(null);
    setPaymentMode("Cash");
    setBillAt(null);
    setRecommendation(null);
    setSubmitError(null);
    setResult(null);
  }

  async function placeOrder() {
    setSubmitError(null);
    const body = {
      name: customer.name,
      phone: customer.phone,
      sessionStartedAt,
      paymentMode,
      lineItems: cart,
    };
    // Final client-side guard with the shared schema (server re-validates anyway).
    if (!orderBodySchema.safeParse(body).success) {
      setSubmitError("Please review your order — something looks off.");
      return;
    }
    setSubmitting(true);
    const r = await submitOrder(body);
    setSubmitting(false);
    if (r.ok) {
      setResult(r.data);
      setStep("confirm");
    } else if (r.code === "MENU_ITEM_NOT_FOUND") {
      setSubmitError("The menu changed while you were ordering. Reloading it — please rebuild.");
      void loadMenu();
    } else {
      setSubmitError(r.message);
    }
  }

  // FR-9: menu can't load → clear error + retry, ordering disabled, never crash.
  const orderingBlocked = !menuLoading && !!menuError;

  return (
    <div
      className={`container-x py-14 md:py-20 ${
        step === "builder" || step === "intake" ? "max-w-5xl" : "max-w-3xl"
      }`}
    >
      <StepIndicator current={step} />

      {orderingBlocked && (
        <div className="card p-5 border-ruby/40 flex flex-col gap-3 mt-8" role="alert" aria-live="polite">
          <p className="text-ink">{menuError}</p>
          <div>
            <button type="button" className="btn btn-secondary" onClick={() => void loadMenu()}>
              Retry
            </button>
          </div>
        </div>
      )}

      {!orderingBlocked && (
        <div className="mt-8">
          {step === "intake" && (
            <IntakeForm
              initial={customer}
              cartCount={cart.length}
              onPickCraving={pickCraving}
              onNext={(c) => {
                setCustomer(c);
                if (!sessionStartedAt) setSessionStartedAt(new Date().toISOString());
                setStep("recommend");
              }}
            />
          )}

          {step === "recommend" && (
            <RecommendCard
              phone={customer.phone}
              cached={recommendation}
              onFetched={setRecommendation}
              cart={cart}
              menu={menu}
              onRemovePick={removeFromCart}
              onPickCraving={pickCraving}
              onUseThis={useRecommendation}
              onSkip={() => setStep("builder")}
            />
          )}

          {step === "builder" && (
            <div className="flex flex-col gap-5">
              <div>
                <p className="eyebrow mb-2">— Step 3 · Build your pizzas</p>
                <h2 className="text-2xl font-semibold text-ink">Build your perfect pizza</h2>
                <p className="mt-1 text-sm text-ink-mute">
                  Pick a base, pizza &amp; up to {5} toppings, then add it to your cart — up to {MAX_QTY} pizzas.
                </p>
              </div>
              {menuLoading || !menu || !draft ? (
                <p className="text-ink-mute">Loading the menu…</p>
              ) : (
                <div className="grid gap-6 md:grid-cols-[1fr_320px]">
                  <PizzaBuilder
                    menu={menu}
                    value={draft}
                    onChange={setDraft}
                    onAdd={addDraftToCart}
                    cartCount={cart.length}
                    max={MAX_QTY}
                  />
                  <div>
                    <Cart
                      cart={cart}
                      menu={menu}
                      bill={previewBill}
                      onRemove={removeFromCart}
                      onReview={openBill}
                    />
                    <CartBar qty={cart.length} bill={previewBill} onReview={openBill} />
                  </div>
                </div>
              )}
              <div>
                <button type="button" className="btn btn-secondary" onClick={() => setStep("recommend")}>
                  Back
                </button>
              </div>
            </div>
          )}

          {step === "bill" && previewBill && (
            <div className="flex flex-col gap-5">
              <div>
                <p className="eyebrow mb-2">— Step 4 · Your bill</p>
                <h2 className="text-2xl font-semibold text-ink">Here&apos;s the damage</h2>
              </div>
              <BillTable
                bill={previewBill}
                customerName={customer.name}
                customerPhone={customer.phone}
                timestamp={billAt ?? undefined}
              />
              <div className="flex gap-3">
                <button type="button" className="btn btn-secondary" onClick={() => setStep("builder")}>
                  Back
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setStep("payment")}>
                  Continue to payment
                </button>
              </div>
            </div>
          )}

          {step === "payment" && (
            <PaymentStep
              value={paymentMode}
              onChange={setPaymentMode}
              onBack={() => setStep("bill")}
              onPlaceOrder={() => void placeOrder()}
              submitting={submitting}
              error={submitError ?? undefined}
              totalPaise={previewBill?.totalPaise}
            />
          )}

          {step === "confirm" && result && (
            <Confirmation
              customer={customer}
              paymentMode={paymentMode}
              bill={result.bill}
              onReset={reset}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Slim checkout-style progress rail — a bar on mobile, numbered steps on desktop. */
function StepIndicator({ current }: { current: Step }) {
  const activeIdx = STEPS.findIndex((s) => s.key === current);
  const pct = ((activeIdx + 1) / STEPS.length) * 100;

  return (
    <div>
      {/* Mobile: labelled progress bar */}
      <div className="sm:hidden">
        <p className="eyebrow mb-1.5">
          Step {activeIdx + 1} of {STEPS.length} · {STEPS[activeIdx]?.label}
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-canvas-soft">
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Desktop: numbered rail with connectors */}
      <ol className="hidden items-center gap-1 sm:flex" aria-label="Order progress">
        {STEPS.map((s, i) => {
          const state = i < activeIdx ? "done" : i === activeIdx ? "active" : "todo";
          const last = i === STEPS.length - 1;
          return (
            <li
              key={s.key}
              aria-current={state === "active" ? "step" : undefined}
              className={`flex items-center gap-2 ${last ? "" : "flex-1"}`}
            >
              <span
                className={
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs tnum " +
                  (state === "done"
                    ? "bg-primary text-white"
                    : state === "active"
                      ? "border-2 border-primary bg-canvas font-semibold text-primary"
                      : "border border-hairline text-ink-mute")
                }
              >
                {state === "done" ? <Check size={13} aria-hidden /> : i + 1}
              </span>
              <span
                className={
                  "hidden text-xs md:inline " +
                  (state === "active"
                    ? "font-medium text-ink"
                    : state === "done"
                      ? "text-ink-secondary"
                      : "text-ink-mute")
                }
              >
                {s.label}
              </span>
              {!last && <span className={`h-px flex-1 ${i < activeIdx ? "bg-primary" : "bg-hairline"}`} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
