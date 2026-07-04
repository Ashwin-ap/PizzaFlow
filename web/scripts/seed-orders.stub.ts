// seed-orders — STUB (deferred to Phase 7, Feature C demand-forecasting bonus).
//
// When built, this will generate ~60–90 days of synthetic historical orders that
// match the SliceMatic economics curve (~38 weekday / ~68 weekend/day, a lunch bump
// 12–14h and a strong dinner peak 19–22h) so the forecast model has signal on day
// one (PRD §7.4, §13 cold-start). Synthetic rows must carry a recognisable phone
// prefix so they can be excluded from real revenue. It writes via the service-role
// client and needs no running app. NOT executed in Phase 2.
export function seedOrders(): never {
  throw new Error("seed-orders is a Phase 7 stub — not implemented yet.");
}
