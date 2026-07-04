import { ok, err } from "@/lib/response";
import { supabaseService } from "@/lib/supabase/server";
import { orderBodySchema, fieldErrors } from "@/lib/validation";
import { computeBill, type PricedItem, type Selected } from "@/lib/pricing";
import { getClientIp, rateLimit } from "@/lib/ratelimit";
import { readJsonWithCap } from "@/lib/http";

// Server-authoritative order creation (PRD §9, §11.4). Client sends CODES only —
// prices are always looked up from the DB and re-computed here. Order + all line
// items commit atomically via the create_order RPC; a replayed Idempotency-Key → 409.

interface MenuItemRow {
  id: string;
  code: string;
  name: string;
  price_paise: number;
  category: "base" | "pizza" | "topping";
}

export async function POST(request: Request) {
  try {
    // 1) Per-IP rate limit (~10 / 60s on order creation).
    const ip = getClientIp(request);
    if (!(await rateLimit(`orders:${ip}`, 10, 60))) {
      return err("RATE_LIMITED", "Too many orders from this device. Please wait a moment.");
    }

    // 2) Body size cap + JSON parse.
    const read = await readJsonWithCap(request);
    if (!read.ok) {
      return err(
        "VALIDATION_ERROR",
        read.reason === "too_large" ? "Request body too large." : "Invalid JSON body.",
      );
    }

    // 3) Re-validate with the shared Zod schema (never trust the client).
    const parsed = orderBodySchema.safeParse(read.value);
    if (!parsed.success) {
      return err("VALIDATION_ERROR", "Please correct the highlighted fields.", {
        fields: fieldErrors(parsed.error),
      });
    }
    const body = parsed.data;

    // 4) Idempotency key (our client sends a per-attempt UUID header).
    const idempotencyKey = request.headers.get("idempotency-key")?.trim() || null;

    // 5) Resolve every code to a DB row (available items only).
    const codes = Array.from(
      new Set(body.lineItems.flatMap((li) => [li.baseCode, li.pizzaCode, li.toppingCode])),
    );
    const { data: menuData, error: menuErr } = await supabaseService
      .from("menu_items")
      .select("id, code, name, price_paise, category")
      .in("code", codes)
      .eq("is_available", true);
    if (menuErr) {
      console.error("menu lookup failed:", menuErr.message);
      return err("INTERNAL", "Failed to price order");
    }
    const rows = (menuData ?? []) as MenuItemRow[];
    const find = (category: MenuItemRow["category"], code: string) =>
      rows.find((r) => r.category === category && r.code === code);

    // 6) Build Selected[] from DB prices; unknown/unavailable code → 422.
    const selected: Selected[] = [];
    const dbLines: { base: MenuItemRow; pizza: MenuItemRow; topping: MenuItemRow }[] = [];
    const toPriced = (r: MenuItemRow): PricedItem => ({
      code: r.code,
      name: r.name,
      pricePaise: r.price_paise,
    });
    for (const li of body.lineItems) {
      const base = find("base", li.baseCode);
      const pizza = find("pizza", li.pizzaCode);
      const topping = find("topping", li.toppingCode);
      if (!base || !pizza || !topping) {
        const missing = [
          !base && li.baseCode,
          !pizza && li.pizzaCode,
          !topping && li.toppingCode,
        ]
          .filter(Boolean)
          .join(", ");
        return err("MENU_ITEM_NOT_FOUND", `Unknown or unavailable menu item(s): ${missing}`);
      }
      selected.push({ base: toPriced(base), pizza: toPriced(pizza), topping: toPriced(topping) });
      dbLines.push({ base, pizza, topping });
    }

    // 7) The ONLY pricer. Client-sent prices (if any) were already stripped by Zod.
    const bill = computeBill(selected);

    // 8) Atomic write via the create_order RPC.
    const payload = {
      customerName: body.name,
      customerPhone: body.phone,
      sessionStartedAt: body.sessionStartedAt ?? null,
      quantity: bill.quantity,
      subtotalPaise: bill.subtotalPaise,
      discountPaise: bill.discountPaise,
      discountApplied: bill.discountApplied,
      gstPaise: bill.gstPaise,
      totalPaise: bill.totalPaise,
      paymentMode: body.paymentMode,
      idempotencyKey,
      lineItems: bill.lineItems.map((li, i) => ({
        lineNo: i + 1,
        baseItemId: dbLines[i]!.base.id,
        pizzaItemId: dbLines[i]!.pizza.id,
        toppingItemId: dbLines[i]!.topping.id,
        baseName: li.base.name,
        pizzaName: li.pizza.name,
        toppingName: li.topping.name,
        basePricePaise: li.base.pricePaise,
        pizzaPricePaise: li.pizza.pricePaise,
        toppingPricePaise: li.topping.pricePaise,
        unitPricePaise: li.unitPricePaise,
      })),
    };

    const { data: order, error: rpcErr } = await supabaseService.rpc("create_order", { payload });
    if (rpcErr) {
      if (rpcErr.code === "23505") {
        return err("CONFLICT", "This order was already submitted.");
      }
      console.error("create_order failed:", rpcErr.message);
      return err("INTERNAL", "Failed to place order");
    }

    return ok({ order, bill }, { status: 201 });
  } catch (e) {
    console.error("orders route error:", e);
    return err("INTERNAL", "Failed to place order");
  }
}
