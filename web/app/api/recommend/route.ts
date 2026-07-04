import { ok, err } from "@/lib/response";
import { supabaseService } from "@/lib/supabase/server";
import { phoneSchema } from "@/lib/validation";
import { getClientIp, rateLimit } from "@/lib/ratelimit";
import { readJsonWithCap } from "@/lib/http";
import { env } from "@/lib/env";
import { callOpenRouter, extractJsonObject } from "@/lib/openrouter";
import {
  SYSTEM_PROMPT,
  buildUserMessage,
  summarizeHistory,
  validateModelPick,
  pickDeterministic,
  toResponse,
  type MenuLite,
  type Counts,
} from "@/lib/recommend";

// AI Feature A — recommendation (PRD §12, §23.3). Server-only OpenRouter call.
// Returning customers (with history) get an LLM pick; new/cold-start phones get a
// deterministic pick (no LLM). ANY failure/invalid-code path → deterministic pick.
// Ordering is never blocked: the only non-200s are RATE_LIMITED / VALIDATION_ERROR.
export const dynamic = "force-dynamic";

interface MenuRow {
  id: string;
  code: string;
  name: string;
  price_paise: number;
  category: "pizza" | "topping";
}

export async function POST(request: Request) {
  try {
    // 1) Per-IP rate limit (~10 / 60s — LLM-cost-sensitive).
    const ip = getClientIp(request);
    if (!(await rateLimit(`recommend:${ip}`, 10, 60))) {
      return err("RATE_LIMITED", "Too many requests. Please wait a moment.");
    }

    // 2) Body cap + parse + validate the phone.
    const read = await readJsonWithCap(request);
    if (!read.ok) {
      return err(
        "VALIDATION_ERROR",
        read.reason === "too_large" ? "Request body too large." : "Invalid JSON body.",
      );
    }
    const phoneParsed = phoneSchema.safeParse((read.value as { phone?: unknown })?.phone);
    if (!phoneParsed.success) {
      return err("VALIDATION_ERROR", "A valid 10-digit phone is required.");
    }
    const phone = phoneParsed.data;

    // 3) Live available menu (pizzas + toppings) + id→code map.
    const { data: menuData, error: menuErr } = await supabaseService
      .from("menu_items")
      .select("id, code, name, price_paise, category")
      .eq("is_available", true)
      .in("category", ["pizza", "topping"]);
    const rows = (menuData ?? []) as MenuRow[];
    const pizzas = rows.filter((r) => r.category === "pizza").map(toLite);
    const toppings = rows.filter((r) => r.category === "topping").map(toLite);
    if (menuErr || pizzas.length === 0 || toppings.length === 0) {
      // No menu → can't recommend, but must never block ordering.
      return err("AI_UNAVAILABLE", "Recommendations are unavailable right now.", { status: 200 });
    }
    const menu: MenuLite = { pizzas, toppings };
    const idToItem = new Map(rows.map((r) => [r.id, r]));

    // 4) Global popularity counts (keyed by current menu code). Synthetic forecast-seed
    // orders (phone prefix "9990") carry NO order_line_items, so they never pollute these
    // counts — the exclusion is by construction. If synthetic line items are ever added,
    // filter them here (join orders, drop isSyntheticPhone) to keep this honest.
    const counts: Counts = { pizza: {}, topping: {} };
    const { data: liData } = await supabaseService
      .from("order_line_items")
      .select("pizza_item_id, topping_item_id");
    for (const li of (liData ?? []) as { pizza_item_id: string | null; topping_item_id: string | null }[]) {
      const p = li.pizza_item_id ? idToItem.get(li.pizza_item_id) : undefined;
      if (p?.category === "pizza") counts.pizza[p.code] = (counts.pizza[p.code] ?? 0) + 1;
      const t = li.topping_item_id ? idToItem.get(li.topping_item_id) : undefined;
      if (t?.category === "topping") counts.topping[t.code] = (counts.topping[t.code] ?? 0) + 1;
    }

    // 5) This customer's recent history (names only, for the prompt).
    const { data: historyData } = await supabaseService
      .from("orders")
      .select("placed_at, order_line_items(pizza_name, topping_name)")
      .eq("customer_phone", phone)
      .order("placed_at", { ascending: false })
      .limit(10);
    const history = summarizeHistory(historyData ?? []);

    // 6) Cold start (no history) OR no API key → deterministic, no LLM.
    if (history.length === 0 || !env.OPENROUTER_API_KEY) {
      return ok({ recommendation: toResponse(pickDeterministic(menu, counts), menu) });
    }

    // 7) Returning customer → LLM, with defensive parse + menu-validation.
    try {
      const { content, modelUsed, latencyMs } = await callOpenRouter({
        apiKey: env.OPENROUTER_API_KEY,
        model: env.OPENROUTER_MODEL,
        fallbackModel: env.OPENROUTER_FALLBACK_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(menu, history) },
        ],
        timeoutMs: 4000,
      });
      console.info(`[recommend] model=${modelUsed} latency=${latencyMs}ms`);
      const pick = validateModelPick(extractJsonObject(content), menu);
      if (pick) return ok({ recommendation: toResponse(pick, menu) });
      console.warn("[recommend] model output invalid or off-menu — deterministic fallback");
    } catch (e) {
      console.warn("[recommend] OpenRouter failed — deterministic fallback:", (e as Error).message);
    }
    return ok({ recommendation: toResponse(pickDeterministic(menu, counts), menu) });
  } catch (e) {
    console.error("recommend route error:", e);
    // Graceful, non-blocking: the client just proceeds without a suggestion.
    return err("AI_UNAVAILABLE", "Recommendations are unavailable right now.", { status: 200 });
  }
}

const toLite = (r: MenuRow) => ({ code: r.code, name: r.name, pricePaise: r.price_paise });
