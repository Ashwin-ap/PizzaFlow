import { NextResponse } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAdmin } from "@/lib/admin-auth";
import { computeTop3PeakHours, type ForecastPoint } from "@/lib/forecast";

// GET /api/admin/forecast (PRD §11.3, §13/§14) — admin only. Returns the latest forecast
// run (all 7 days × operating hours) + the top-3 predicted peak hours + the model/RMSE it
// was generated with. Read through the caller's user-scoped client so RLS (is_admin)
// applies. No Python at request time — this just reads demand_forecasts.
export const dynamic = "force-dynamic";

interface ForecastRow {
  target_date: string;
  hour_of_day: number;
  predicted_orders: number | string; // numeric comes back as a string from PostgREST
  model_version: string;
  rmse: number | string | null;
}

export async function GET(request: Request) {
  try {
    const gate = await requireAdmin(request);
    if (gate instanceof NextResponse) return gate;
    const { supabase } = gate;

    // The most recent run is a single generated_at stamp shared by all its rows.
    const { data: latest, error: latestErr } = await supabase
      .from("demand_forecasts")
      .select("generated_at")
      .order("generated_at", { ascending: false })
      .limit(1);
    if (latestErr) {
      console.error("admin forecast latest query failed:", latestErr.message);
      return err("INTERNAL", "Failed to load forecast");
    }
    if (!latest?.length) {
      return ok({ generatedAt: null, model: null, rmse: null, points: [], top3PeakHours: [] });
    }

    const generatedAt = latest[0].generated_at as string;
    const { data, error } = await supabase
      .from("demand_forecasts")
      .select("target_date, hour_of_day, predicted_orders, model_version, rmse")
      .eq("generated_at", generatedAt)
      .order("target_date", { ascending: true })
      .order("hour_of_day", { ascending: true });
    if (error) {
      console.error("admin forecast query failed:", error.message);
      return err("INTERNAL", "Failed to load forecast");
    }

    const rows = (data ?? []) as ForecastRow[];
    const points: ForecastPoint[] = rows.map((r) => ({
      date: r.target_date,
      hour: r.hour_of_day,
      predicted: Number(r.predicted_orders),
    }));

    return ok({
      generatedAt,
      model: rows[0]?.model_version ?? null,
      rmse: rows[0]?.rmse != null ? Number(rows[0].rmse) : null,
      points,
      top3PeakHours: computeTop3PeakHours(points),
    });
  } catch (e) {
    console.error("admin forecast route error:", e);
    return err("INTERNAL", "Failed to load forecast");
  }
}
