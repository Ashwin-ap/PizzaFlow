/**
 * Query-param schemas for the admin routes (PRD §11.3). `from`/`to` are ISO date or
 * datetime strings (half-open range: placed_at >= from AND < to). `payment` reuses the
 * shared enum. Note: metrics/export accept `payment` too — a deliberate superset of the
 * §11.3 contract so the dashboard tiles stay coherent with the active filter (FR-15).
 */
import { z } from "zod";

const paymentFilter = z.enum(["Cash", "Card", "UPI"]).optional();
const isoish = z.string().min(1).optional();

export const adminMetricsQuery = z.object({
  from: isoish,
  to: isoish,
  payment: paymentFilter,
});

export const adminExportQuery = adminMetricsQuery;

export const adminOrdersQuery = z.object({
  from: isoish,
  to: isoish,
  payment: paymentFilter,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type AdminOrdersQuery = z.infer<typeof adminOrdersQuery>;
export type AdminMetricsQuery = z.infer<typeof adminMetricsQuery>;

/** Parse URLSearchParams into a plain object for a schema. */
export function paramsToObject(searchParams: URLSearchParams): Record<string, string> {
  return Object.fromEntries(searchParams.entries());
}
