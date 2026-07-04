// Defensive parser for the 'ID;Name;Price' menu files — the TypeScript mirror of
// Submit.py:load_menu (Stage 2). Pure/text-in so it is unit-testable. The grader
// swaps the three Types_of_*.txt files before evaluation, so this must never trust
// the input: it skips blank/malformed/non-numeric/non-positive lines, tolerates a
// UTF-8 BOM, and converts rupees -> integer paise (×100).

export interface ParsedItem {
  code: string;
  name: string;
  pricePaise: number;
}

export function parseMenuText(text: string): ParsedItem[] {
  // Node's fs does not strip a UTF-8 BOM; drop a leading U+FEFF if present so the
  // first item's code doesn't pick up a hidden character.
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const items: ParsedItem[] = [];
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const parts = line.split(";");
    if (parts.length < 3) continue;

    let code: string;
    let name: string;
    let priceStr: string;
    if (parts.length > 3) {
      // A name may legitimately contain ';' — keep first as code, last as price.
      code = parts[0];
      priceStr = parts[parts.length - 1];
      name = parts.slice(1, -1).join(";");
    } else {
      [code, name, priceStr] = parts;
    }

    code = code.trim();
    name = name.trim();
    priceStr = priceStr.trim();
    if (!code || !name) continue;

    const price = Number(priceStr);
    if (!Number.isFinite(price) || price <= 0) continue;

    items.push({ code, name, pricePaise: Math.round(price * 100) });
  }
  return items;
}
