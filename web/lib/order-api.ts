/**
 * Client-side API helpers for the customer ordering flow (Phase 4).
 * Talks to the already-implemented server routes:
 *   - GET  /api/menu    → grouped { bases, pizzas, toppings } (PRD §11.3)
 *   - POST /api/orders   → server-authoritative { order, bill } (PRD §11.4)
 *
 * The client sends CODES ONLY — never prices (server re-prices from the DB).
 * Every response is the standard envelope from lib/response.ts; we unwrap it into
 * a discriminated Result so callers can show inline errors without try/catch noise.
 */
import type { ErrorCode } from "@/lib/response";
import type { Bill } from "@/lib/pricing";

export interface MenuItem {
  id: string;
  code: string;
  name: string;
  pricePaise: number;
}

export interface Menu {
  bases: MenuItem[];
  pizzas: MenuItem[];
  toppings: MenuItem[];
}

/** One configured pizza as the order body expects it — codes only. 1–5 toppings. */
export interface OrderLineItem {
  baseCode: string;
  pizzaCode: string;
  toppingCodes: string[];
}

/** Mirrors the payment_mode enum (DB) and paymentSchema (Zod). */
export type PaymentMode = "Cash" | "Card" | "UPI";

export interface OrderRequest {
  name: string;
  phone: string;
  sessionStartedAt: string | null;
  paymentMode: PaymentMode;
  lineItems: OrderLineItem[];
}

/** AI recommendation (Feature A) — pizza + topping only, never a base (PRD §12/§23.3). */
export interface Recommendation {
  pizzaCode: string;
  toppingCode: string;
  pizzaName: string;
  toppingName: string;
  reason: string;
}

/** The persisted order row returned by the create_order RPC (opaque to the UI). */
export type PersistedOrder = Record<string, unknown>;

export interface OrderResult {
  order: PersistedOrder;
  bill: Bill;
}

/** "NETWORK" covers fetch rejection / non-JSON; otherwise a server error code. */
export type ClientErrorCode = ErrorCode | "NETWORK";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; code: ClientErrorCode; message: string; fields?: Record<string, string[]> };

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code: ErrorCode; message: string; fields?: Record<string, string[]> };
}

async function parseEnvelope<T>(res: Response): Promise<Result<T>> {
  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    return { ok: false, code: "NETWORK", message: "Unexpected server response. Please try again." };
  }
  if (res.ok && body?.success && body.data !== undefined) {
    return { ok: true, data: body.data };
  }
  const err = body?.error;
  return {
    ok: false,
    code: err?.code ?? "INTERNAL",
    message: err?.message ?? "Something went wrong. Please try again.",
    fields: err?.fields,
  };
}

/** Load the live menu. FR-7: from the DB, not the text files. */
export async function fetchMenu(): Promise<Result<Menu>> {
  try {
    const res = await fetch("/api/menu", { headers: { accept: "application/json" } });
    return await parseEnvelope<Menu>(res);
  } catch {
    return { ok: false, code: "NETWORK", message: "Couldn't reach the menu. Check your connection and retry." };
  }
}

/**
 * Fetch an AI recommendation for a phone (FR-4). The server always answers with a
 * pick (deterministic fallback on any model failure), so a non-ok here is only a
 * transport/rate-limit issue — the caller just proceeds without a suggestion.
 */
export async function fetchRecommendation(
  phone: string,
): Promise<Result<{ recommendation: Recommendation }>> {
  try {
    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ phone }),
    });
    return await parseEnvelope<{ recommendation: Recommendation }>(res);
  } catch {
    return { ok: false, code: "NETWORK", message: "Couldn't load a recommendation." };
  }
}

/**
 * Place the order. Sends a fresh Idempotency-Key per attempt so a retry can't
 * double-insert (the route maps a replayed key → 409 CONFLICT). Success is 201.
 */
export async function submitOrder(body: OrderRequest): Promise<Result<OrderResult>> {
  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    });
    return await parseEnvelope<OrderResult>(res);
  } catch {
    return { ok: false, code: "NETWORK", message: "Couldn't place the order. Check your connection and retry." };
  }
}
