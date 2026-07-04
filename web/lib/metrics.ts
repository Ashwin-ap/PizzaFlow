/**
 * Dashboard metric computations (PRD §14) — pure & unit-tested. Money stays integer
 * paise; format to ₹ at display. The equivalent §14 reference SQL (kept for the Q&A
 * "explain one" requirement):
 *   revenue       : select sum(total_paise) from orders where placed_at >= :from and < :to
 *   top pizza     : select pizza_name, count(*) from order_line_items ... group by pizza_name order by count desc limit 1
 *   busiest hour  : select extract(hour from placed_at at time zone 'Asia/Kolkata'), count(*) ... order by count desc limit 1
 * We compute in TS so the logic is unit-testable; India has no DST, so IST is a fixed +05:30.
 */

const IST_OFFSET_MIN = 5 * 60 + 30; // +05:30, no DST

/** The 0–23 clock hour in IST for a UTC timestamp string. */
export function istHour(iso: string): number {
  const d = new Date(iso);
  const utcMinutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  return Math.floor((((utcMinutes + IST_OFFSET_MIN) % 1440) + 1440) % 1440 / 60);
}

/** `YYYY-MM-DD HH:MM IST` — a stable IST wall-clock string for the CSV export. */
export function istDateTime(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + IST_OFFSET_MIN * 60_000);
  return shifted.toISOString().slice(0, 16).replace("T", " ") + " IST";
}

export function computeRevenuePaise(orders: { total_paise: number }[]): number {
  return orders.reduce((sum, o) => sum + (o.total_paise ?? 0), 0);
}

export function orderCount(orders: unknown[]): number {
  return orders.length;
}

export interface TopPizza {
  name: string;
  count: number;
}

/** Most-sold pizza by line-item count (one row = one pizza). Null if no line items. */
export function topSellingPizza(lineItems: { pizza_name: string | null | undefined }[]): TopPizza | null {
  const counts = new Map<string, number>();
  for (const li of lineItems) {
    if (!li.pizza_name) continue;
    counts.set(li.pizza_name, (counts.get(li.pizza_name) ?? 0) + 1);
  }
  let best: TopPizza | null = null;
  for (const [name, count] of counts) {
    if (!best || count > best.count) best = { name, count };
  }
  return best;
}

export interface BusiestHour {
  hour: number; // 0–23, IST
  count: number;
}

/** Busiest hour of day in IST. Null if no orders. */
export function busiestHourIST(orders: { placed_at: string | null | undefined }[]): BusiestHour | null {
  const counts = new Map<number, number>();
  for (const o of orders) {
    if (!o.placed_at) continue;
    const h = istHour(o.placed_at);
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  let best: BusiestHour | null = null;
  for (const [hour, count] of counts) {
    if (!best || count > best.count) best = { hour, count };
  }
  return best;
}

/** `"7 PM"` style label for an IST hour (dashboard display). */
export function formatHourIST(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${period}`;
}
