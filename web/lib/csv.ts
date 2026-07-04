/**
 * CSV export (PRD §10.3 RFC-4180 + §17 formula-injection guard). Pure & unit-tested.
 * Guard: any cell whose value starts with = + - @ (or tab/CR) is prefixed with a single
 * quote so spreadsheet apps don't evaluate it as a formula. Then RFC-4180 field quoting.
 */
import { istDateTime } from "@/lib/metrics";

const INJECTION_LEAD = /^[=+\-@\t\r]/;

/** One RFC-4180 field with the injection guard applied first. */
export function csvField(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (INJECTION_LEAD.test(s)) s = "'" + s; // neutralize a dangerous leading char
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'; // RFC-4180 quoting
  return s;
}

export function toCsvRow(fields: unknown[]): string {
  return fields.map(csvField).join(",");
}

/** RFC-4180 uses CRLF line breaks. */
export function toCsv(rows: unknown[][]): string {
  return rows.map(toCsvRow).join("\r\n");
}

const rupees2 = (paise: number) => (paise / 100).toFixed(2);

export interface OrderCsvRow {
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
}

const HEADER = [
  "Order ID",
  "Placed At (IST)",
  "Customer",
  "Phone",
  "Quantity",
  "Subtotal (INR)",
  "Discount (INR)",
  "GST (INR)",
  "Total (INR)",
  "Payment",
];

/** One row per order. Money as plain rupee decimals (spreadsheet-friendly). */
export function ordersToCsv(orders: OrderCsvRow[]): string {
  const rows: unknown[][] = [HEADER];
  for (const o of orders) {
    rows.push([
      o.id,
      istDateTime(o.placed_at),
      o.customer_name,
      o.customer_phone,
      o.quantity,
      rupees2(o.subtotal_paise),
      rupees2(o.discount_paise),
      rupees2(o.gst_paise),
      rupees2(o.total_paise),
      o.payment_mode,
    ]);
  }
  return toCsv(rows);
}
