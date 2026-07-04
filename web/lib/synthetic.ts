/**
 * Synthetic-order tagging (Phase 7, Feature C). The demand-forecasting seeder
 * (`scripts/seed-orders.ts`) writes ~60–90 days of fake historical orders so the model
 * has signal on day one (PRD §7.4, §13 cold-start). Those rows carry a recognisable
 * phone prefix so the customer-facing surfaces — admin revenue / top pizza / busiest
 * hour, and Feature A's popularity fallback — can EXCLUDE them, while the forecaster
 * still trains on every order.
 *
 * "9990" satisfies the `orders.customer_phone` CHECK (`^[6-9][0-9]{9}$`): it starts with
 * a 9 and leaves 6 free digits (a 1e6 space) for synthetic customers. A real customer
 * whose number happens to start 9990 would be treated as synthetic — an accepted,
 * negligible collision (documented).
 */
export const SYNTHETIC_PHONE_PREFIX = "9990";

/** SQL LIKE pattern for excluding synthetic rows in a Supabase `.not("customer_phone","like",…)`. */
export const SYNTHETIC_PHONE_LIKE = `${SYNTHETIC_PHONE_PREFIX}%`;

export function isSyntheticPhone(phone: string): boolean {
  return phone.startsWith(SYNTHETIC_PHONE_PREFIX);
}
