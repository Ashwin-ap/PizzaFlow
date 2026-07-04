import { NextResponse } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAdmin } from "@/lib/admin-auth";
import { adminMetricsQuery, paramsToObject } from "@/lib/admin-query";
import {
  computeRevenuePaise,
  topSellingPizza,
  busiestHourIST,
  orderCount,
} from "@/lib/metrics";

// GET /api/admin/metrics (PRD §11.3, §14) — admin only. Revenue, top pizza, busiest
// hour (IST), order count over the filtered set. `payment` accepted (superset of the
// contract) so tiles match the active filter.
export const dynamic = "force-dynamic";

interface MetricsOrder {
  total_paise: number;
  placed_at: string;
  order_line_items: { pizza_name: string | null }[] | null;
}

export async function GET(request: Request) {
  try {
    const gate = await requireAdmin(request);
    if (gate instanceof NextResponse) return gate;
    const { supabase } = gate;

    const parsed = adminMetricsQuery.safeParse(
      paramsToObject(new URL(request.url).searchParams),
    );
    if (!parsed.success) return err("VALIDATION_ERROR", "Invalid query parameters.");
    const { from, to, payment } = parsed.data;

    let q = supabase
      .from("orders")
      .select("total_paise, placed_at, order_line_items(pizza_name)");
    if (from) q = q.gte("placed_at", from);
    if (to) q = q.lt("placed_at", to);
    if (payment) q = q.eq("payment_mode", payment);

    const { data, error } = await q;
    if (error) {
      console.error("admin metrics query failed:", error.message);
      return err("INTERNAL", "Failed to load metrics");
    }

    const orders = (data ?? []) as MetricsOrder[];
    const lineItems = orders.flatMap((o) => o.order_line_items ?? []);

    return ok({
      revenuePaise: computeRevenuePaise(orders),
      topPizza: topSellingPizza(lineItems),
      busiestHour: busiestHourIST(orders),
      orderCount: orderCount(orders),
    });
  } catch (e) {
    console.error("admin metrics route error:", e);
    return err("INTERNAL", "Failed to load metrics");
  }
}
