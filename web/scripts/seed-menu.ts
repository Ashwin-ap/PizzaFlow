// Swap-safe menu seed. Parses the three root Types_of_*.txt files and upserts them
// into menu_items keyed on (category, code). Idempotent: re-running the same files
// yields the same rows. Swap-safe: any (category, code) present in the DB but absent
// from the current files is DEACTIVATED (is_available=false), not deleted — deleting
// would break order_line_items FKs; the snapshot columns already preserve history.
//
// Run: npm run seed:menu   (loads web/.env.local; needs SUPABASE_SECRET_KEY)
// Override the menu dir for a swap test with MENU_DIR=/path.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseMenuText } from "./menu-parser";
import { serviceClient } from "./_env";

type Category = "base" | "pizza" | "topping";

const FILES: { category: Category; file: string }[] = [
  { category: "base", file: "Types_of_Base.txt" },
  { category: "pizza", file: "Types_of_Pizza.txt" },
  { category: "topping", file: "Types_of_Toppings.txt" },
];

async function main(): Promise<void> {
  // scripts/ -> web/ -> repo root, unless MENU_DIR overrides.
  const menuDir = process.env.MENU_DIR
    ? resolve(process.env.MENU_DIR)
    : resolve(__dirname, "..", "..");

  const supabase = serviceClient();
  let total = 0;

  for (const { category, file } of FILES) {
    const path = join(menuDir, file);

    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      console.error(`Menu file not found: ${path}`);
      process.exit(1);
    }

    const items = parseMenuText(text);
    if (items.length === 0) {
      // Mirrors Submit.py's MenuError: a file with zero valid items is a red flag,
      // not a reason to wipe the category. Abort rather than deactivate everything.
      console.error(`Menu file '${file}' contains no valid items — aborting.`);
      process.exit(1);
    }

    const rows = items.map((it, i) => ({
      category,
      code: it.code,
      name: it.name,
      price_paise: it.pricePaise,
      is_available: true,
      sort_order: i,
    }));

    const { error } = await supabase
      .from("menu_items")
      .upsert(rows, { onConflict: "category,code" });
    if (error) {
      console.error(`Upsert failed for ${category}: ${error.message}`);
      process.exit(1);
    }

    // Deactivate codes no longer present in the (possibly swapped) file.
    const codes = items.map((it) => it.code);
    const { error: deErr } = await supabase
      .from("menu_items")
      .update({ is_available: false })
      .eq("category", category)
      .not("code", "in", `(${codes.join(",")})`);
    if (deErr) {
      console.error(`Deactivation sweep failed for ${category}: ${deErr.message}`);
      process.exit(1);
    }

    total += rows.length;
    console.log(`  ${category.padEnd(8)} ${String(rows.length).padStart(2)} items upserted`);
  }

  console.log(`Seed complete: ${total} available menu items.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
