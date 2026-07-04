import { NextResponse } from "next/server";
import { paginated, err } from "@/lib/response";
import { requireAdmin } from "@/lib/admin-auth";
import { adminOrdersQuery, paramsToObject } from "@/lib/admin-query";
import { SYNTHETIC_PHONE_LIKE } from "@/lib/synthetic";

// GET /api/admin/orders (PRD §11.3) — admin only. Date + payment filters, pagination.
// Read through the caller's user-scoped client so RLS (is_admin) enforces access too.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const gate = await requireAdmin(request);
    if (gate instanceof NextResponse) return gate;
    const { supabase } = gate;

    const parsed = adminOrdersQuery.safeParse(
      paramsToObject(new URL(request.url).searchParams),
    );
    if (!parsed.success) return err("VALIDATION_ERROR", "Invalid query parameters.");
    const { from, to, payment, page, limit } = parsed.data;

    let q = supabase
      .from("orders")
      .select("*, order_line_items(*)", { count: "exact" })
      // Exclude synthetic forecast-seed orders (phone prefix); count stays accurate.
      .not("customer_phone", "like", SYNTHETIC_PHONE_LIKE)
      .order("placed_at", { ascending: false });
    if (from) q = q.gte("placed_at", from);
    if (to) q = q.lt("placed_at", to);
    if (payment) q = q.eq("payment_mode", payment);

    const offset = (page - 1) * limit;
    const { data, count, error } = await q.range(offset, offset + limit - 1);
    if (error) {
      console.error("admin orders query failed:", error.message);
      return err("INTERNAL", "Failed to load orders");
    }

    return paginated(data ?? [], { total: count ?? 0, page, limit });
  } catch (e) {
    console.error("admin orders route error:", e);
    return err("INTERNAL", "Failed to load orders");
  }
}
