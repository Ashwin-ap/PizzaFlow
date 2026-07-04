"use client";

import { useEffect, useState } from "react";
import { computeBill, type Selected } from "@/lib/pricing";
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
import { QuantityStep } from "./QuantityStep";
import { PizzaBuilderRow } from "./PizzaBuilderRow";
import { BillTable } from "./BillTable";
import { PaymentStep } from "./PaymentStep";
import { Confirmation } from "./Confirmation";

type Step = "intake" | "recommend" | "quantity" | "builder" | "bill" | "payment" | "confirm";

const STEPS: { key: Step; label: string }[] = [
  { key: "intake", label: "Details" },
  { key: "recommend", label: "For you" },
  { key: "quantity", label: "Quantity" },
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

export function Stepper() {
  const [step, setStep] = useState<Step>("intake");
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [quantity, setQuantity] = useState<number | null>(null);
  const [selections, setSelections] = useState<OrderLineItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("Cash");

  // AI recommendation (Feature A): cached so re-entry doesn't refetch; `prefill`
  // carries an accepted pick into the first builder row.
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [prefill, setPrefill] = useState<{ pizzaCode: string; toppingCode: string } | null>(null);

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
  // Fetching external data is the intended use of an effect; loadMenu's internal
  // setState is what the lint rule flags, so we suppress it here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMenu();
  }, []);

  // Size the builder rows to the chosen quantity, defaulting each to the first
  // item of every category — preserving existing choices on resize (FR-6/FR-8).
  useEffect(() => {
    if (step !== "builder" || !menu || !quantity) return;
    // One-time (re)size when entering the builder or when quantity/menu changes;
    // preserves existing choices. Deriving this state is a deliberate sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelections((prev) => {
      if (prev.length === quantity) return prev;
      // Row 0 honours an accepted recommendation (pizza + topping only — base stays
      // the default); guard each prefilled code against the live menu (swap-safety).
      const build = (i: number): OrderLineItem => ({
        baseCode: menu.bases[0].code,
        pizzaCode:
          i === 0 && prefill && find(menu.pizzas, prefill.pizzaCode)
            ? prefill.pizzaCode
            : menu.pizzas[0].code,
        toppingCode:
          i === 0 && prefill && find(menu.toppings, prefill.toppingCode)
            ? prefill.toppingCode
            : menu.toppings[0].code,
      });
      return Array.from({ length: quantity }, (_, i) => prev[i] ?? build(i));
    });
  }, [step, menu, quantity, prefill]);

  const previewBill =
    menu && selections.length > 0
      ? computeBill(
          selections.map<Selected>((s) => ({
            base: priced(find(menu.bases, s.baseCode)),
            pizza: priced(find(menu.pizzas, s.pizzaCode)),
            topping: priced(find(menu.toppings, s.toppingCode)),
          })),
        )
      : null;

  function reset() {
    setStep("intake");
    setSessionStartedAt(null);
    setCustomer({ name: "", phone: "" });
    setQuantity(null);
    setSelections([]);
    setPaymentMode("Cash");
    setRecommendation(null);
    setPrefill(null);
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
      lineItems: selections,
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
    <div className="container-x py-14 md:py-20 max-w-3xl">
      <StepIndicator current={step} />

      {orderingBlocked && (
        <div className="card p-5 border-ruby/40 flex flex-col gap-3" role="alert" aria-live="polite">
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
              onUseThis={(rec) => {
                setPrefill({ pizzaCode: rec.pizzaCode, toppingCode: rec.toppingCode });
                setStep("quantity");
              }}
              onSkip={() => setStep("quantity")}
            />
          )}

          {step === "quantity" && (
            <QuantityStep
              initial={quantity}
              onBack={() => setStep("intake")}
              onNext={(q) => {
                setQuantity(q);
                setStep("builder");
              }}
            />
          )}

          {step === "builder" && (
            <div className="flex flex-col gap-5">
              <div>
                <p className="eyebrow mb-2">— Step 4 · Build your pizzas</p>
                <h2 className="text-2xl font-semibold text-ink">
                  Pick a base, pizza &amp; topping for each
                </h2>
              </div>
              {menuLoading || !menu ? (
                <p className="text-ink-mute">Loading the menu…</p>
              ) : (
                <>
                  <div className="flex flex-col gap-4">
                    {selections.map((sel, i) => (
                      <PizzaBuilderRow
                        key={i}
                        index={i}
                        menu={menu}
                        value={sel}
                        onChange={(next) =>
                          setSelections((prev) => prev.map((s, j) => (j === i ? next : s)))
                        }
                      />
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button type="button" className="btn btn-secondary" onClick={() => setStep("quantity")}>
                      Back
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={selections.length === 0}
                      onClick={() => setStep("bill")}
                    >
                      Review bill
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {step === "bill" && previewBill && (
            <div className="flex flex-col gap-5">
              <div>
                <p className="eyebrow mb-2">— Step 5 · Your bill</p>
                <h2 className="text-2xl font-semibold text-ink">Here&apos;s the damage</h2>
              </div>
              <BillTable bill={previewBill} />
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

/** Compact 7-step progress header (PRD §16.2 nav-underline / active-chip pattern). */
function StepIndicator({ current }: { current: Step }) {
  const activeIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Order progress">
      {STEPS.map((s, i) => {
        const state = i < activeIdx ? "done" : i === activeIdx ? "active" : "todo";
        return (
          <li
            key={s.key}
            aria-current={state === "active" ? "step" : undefined}
            className={
              "tnum text-xs px-2.5 py-1 rounded-full border " +
              (state === "active"
                ? "bg-primary text-white border-primary"
                : state === "done"
                  ? "bg-canvas-soft text-ink-secondary border-hairline"
                  : "text-ink-mute border-hairline")
            }
          >
            {i + 1}. {s.label}
          </li>
        );
      })}
    </ol>
  );
}
