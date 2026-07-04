/**
 * Client-side fetchers for the admin dashboard. Same-origin, so the Supabase session
 * cookie is sent automatically — no Authorization header needed in the browser. A 401
 * means the session is gone (caller should send the user back to /admin/login).
 */
import type { ForecastPoint, HourAverage } from "@/lib/forecast";

export interface AdminLineItem {
  line_no: number;
  base_name: string;
  pizza_name: string;
  topping_name: string;
  unit_price_paise: number;
}

export interface AdminOrder {
  id: string;
  placed_at: string;
  customer_name: string;
  customer_phone: string;
  quantity: number;
  subtotal_paise: number;
  discount_paise: number;
  gst_paise: number;
  total_paise: number;
  payment_mode: string;
  order_line_items: AdminLineItem[];
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminMetrics {
  revenuePaise: number;
  topPizza: { name: string; count: number } | null;
  busiestHour: { hour: number; count: number } | null;
  orderCount: number;
}

export interface AdminFilter {
  from?: string;
  to?: string;
  payment?: "Cash" | "Card" | "UPI";
}

// Feature C — demand forecast. Shapes reuse the pure helpers in lib/forecast.
export type { ForecastPoint, HourAverage } from "@/lib/forecast";

export interface AdminForecast {
  generatedAt: string | null;
  model: string | null;
  rmse: number | null;
  points: ForecastPoint[];
  top3PeakHours: HourAverage[];
}

/** Thrown on 401 so the dashboard can redirect to login. */
export class AdminUnauthorizedError extends Error {}

export function filterToQuery(f: AdminFilter, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams();
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.payment) p.set("payment", f.payment);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.toString();
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  pagination?: Pagination;
  error?: { code: string; message: string };
}

async function getJson<T>(url: string): Promise<Envelope<T>> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new Error("Unexpected server response.");
  }
  if (res.status === 401) throw new AdminUnauthorizedError(body?.error?.message ?? "Session expired.");
  if (!res.ok || !body?.success) throw new Error(body?.error?.message ?? "Request failed.");
  return body;
}

export async function fetchAdminMetrics(f: AdminFilter): Promise<AdminMetrics> {
  const body = await getJson<AdminMetrics>(`/api/admin/metrics?${filterToQuery(f)}`);
  return body.data as AdminMetrics;
}

export async function fetchAdminOrders(
  f: AdminFilter,
  page: number,
  limit = 20,
): Promise<{ orders: AdminOrder[]; pagination: Pagination }> {
  const body = await getJson<AdminOrder[]>(
    `/api/admin/orders?${filterToQuery(f, { page: String(page), limit: String(limit) })}`,
  );
  return {
    orders: (body.data as AdminOrder[]) ?? [],
    pagination: body.pagination ?? { total: 0, page, limit, totalPages: 0 },
  };
}

/** Latest demand forecast (filter-independent — always the next 7 days). */
export async function fetchForecast(): Promise<AdminForecast> {
  const body = await getJson<AdminForecast>("/api/admin/forecast");
  return body.data as AdminForecast;
}
