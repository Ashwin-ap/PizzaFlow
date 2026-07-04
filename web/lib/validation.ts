/**
 * Shared Zod validators (PRD §10.1). The SAME schemas validate the client form
 * (React Hook Form, Phase 4) and re-validate on the server (route handlers) —
 * never trust the client. Error strings are VERBATIM from Stage 2 (Submit.py) so
 * the messages match across stages.
 */
import { z } from "zod";

export const NAME_ERR =
  "Name must be 2–40 letters (spaces allowed), no numbers or symbols.";
export const PHONE_ERR =
  "Phone must be exactly 10 digits and start with 6, 7, 8, or 9.";
export const QTY_ERR = "Quantity must be a whole number between 1 and 10.";
export const QTY_MAX_ERR = "Maximum 10 pizzas per order.";
export const PAYMENT_ERR = "Choose payment: 1 = Cash, 2 = Card, 3 = UPI.";

/** Name: trimmed, letters + spaces only, 2–40 chars. */
export const nameSchema = z
  .string()
  .transform((s) => s.trim())
  .refine((s) => /^[A-Za-z ]+$/.test(s) && s.length >= 2 && s.length <= 40, {
    message: NAME_ERR,
  });

/** Phone: exactly 10 digits, starts with 6/7/8/9. */
export const phoneSchema = z
  .string()
  .transform((s) => s.trim())
  .refine((s) => /^[6-9][0-9]{9}$/.test(s), { message: PHONE_ERR });

/**
 * Quantity: whole number 1–10, mirroring Submit.py (regex \d+ then range then cap).
 * Two distinct messages: out-of-range/non-integer vs. the >10 cap. Accepts a string
 * or number (the intake field is a text input).
 */
export const qtySchema = z.unknown().superRefine((v, ctx) => {
  const s = typeof v === "number" ? String(v) : String(v ?? "").trim();
  if (!/^\d+$/.test(s)) {
    ctx.addIssue({ code: "custom", message: QTY_ERR });
    return;
  }
  const n = parseInt(s, 10);
  if (n < 1) ctx.addIssue({ code: "custom", message: QTY_ERR });
  else if (n > 10) ctx.addIssue({ code: "custom", message: QTY_MAX_ERR });
});

/** Payment mode — the API string form. (The intake UI maps 1/2/3 → Cash/Card/UPI.) */
export const paymentSchema = z.enum(["Cash", "Card", "UPI"], {
  message: PAYMENT_ERR,
});

/** Item choice — an index 1..n into a category list (intake UI, Phase 4). */
export const choiceSchema = (n: number) =>
  z.unknown().superRefine((v, ctx) => {
    const s = String(v ?? "").trim();
    if (!/^\d+$/.test(s) || parseInt(s, 10) < 1 || parseInt(s, 10) > n) {
      ctx.addIssue({
        code: "custom",
        message: `Enter the item NUMBER from the list (1–${n}).`,
      });
    }
  });

/** One line item in the order body — CODES ONLY. No prices ever come from the client. */
export const lineItemSchema = z.object({
  baseCode: z.string().min(1),
  pizzaCode: z.string().min(1),
  toppingCode: z.string().min(1),
});

/**
 * POST /api/orders body. `.strip()` is Zod's default, so any injected `price*`
 * fields are silently dropped here — a first line of defense for server-authoritative
 * pricing (the route also rebuilds prices from the DB regardless).
 */
export const orderBodySchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  sessionStartedAt: z.string().optional().nullable(),
  paymentMode: paymentSchema,
  lineItems: z
    .array(lineItemSchema)
    .min(1, { message: "Add at least one pizza." })
    .max(10, { message: QTY_MAX_ERR }),
});

export type OrderBody = z.infer<typeof orderBodySchema>;

/** Flatten a ZodError into the envelope `fields` map (field → messages). */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
