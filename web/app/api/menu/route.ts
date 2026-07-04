import { ok, err } from "@/lib/response";
import { createAnonClient } from "@/lib/supabase/browser";

// Live menu (PRD §11.3). Public; read through the anon client so RLS enforces
// "available items only". Uncached so a re-seed / availability change shows immediately.
export const dynamic = "force-dynamic";

interface MenuRow {
  id: string;
  code: string;
  name: string;
  price_paise: number;
  category: "base" | "pizza" | "topping";
  sort_order: number;
}

export async function GET() {
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, code, name, price_paise, category, sort_order")
      .eq("is_available", true)
      .order("category")
      .order("sort_order");

    if (error) {
      console.error("menu query failed:", error.message);
      return err("INTERNAL", "Failed to load menu");
    }

    const rows = (data ?? []) as MenuRow[];
    const pick = (cat: MenuRow["category"]) =>
      rows
        .filter((r) => r.category === cat)
        .map((r) => ({ id: r.id, code: r.code, name: r.name, pricePaise: r.price_paise }));

    return ok({ bases: pick("base"), pizzas: pick("pizza"), toppings: pick("topping") });
  } catch (e) {
    console.error("menu route error:", e);
    return err("INTERNAL", "Failed to load menu");
  }
}
