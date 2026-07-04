import { NextResponse } from "next/server";
import { err } from "@/lib/response";
import { requireAdmin } from "@/lib/admin-auth";
import { adminExportQuery, paramsToObject } from "@/lib/admin-query";
import { SYNTHETIC_PHONE_LIKE } from "@/lib/synthetic";
import { ordersToCsv, type OrderCsvRow } from "@/lib/csv";

// GET /api/admin/export (PRD §11.3, §17) — admin only. Streams the filtered orders as
// an RFC-4180 CSV with the formula-injection guard. Returns raw text/csv (not the JSON
// envelope), with a Content-Disposition attachment.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const gate = await requireAdmin(request);
    if (gate instanceof NextResponse) return gate;
    const { supabase } = gate;

    const parsed = adminExportQuery.safeParse(
      paramsToObject(new URL(request.url).searchParams),
    );
    if (!parsed.success) return err("VALIDATION_ERROR", "Invalid query parameters.");
    const { from, to, payment } = parsed.data;

    let q = supabase
      .from("orders")
      .select(
        "id, placed_at, customer_name, customer_phone, quantity, subtotal_paise, discount_paise, gst_paise, total_paise, payment_mode",
      )
      // Exclude synthetic forecast-seed orders (phone prefix) from the export.
      .not("customer_phone", "like", SYNTHETIC_PHONE_LIKE)
      .order("placed_at", { ascending: false });
    if (from) q = q.gte("placed_at", from);
    if (to) q = q.lt("placed_at", to);
    if (payment) q = q.eq("payment_mode", payment);

    const { data, error } = await q;
    if (error) {
      console.error("admin export query failed:", error.message);
      return err("INTERNAL", "Failed to export orders");
    }

    const csv = ordersToCsv((data ?? []) as OrderCsvRow[]);
    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="slicematic-orders.csv"',
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("admin export route error:", e);
    return err("INTERNAL", "Failed to export orders");
  }
}
