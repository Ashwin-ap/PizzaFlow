/**
 * Pure forecast helpers (Phase 7, Feature C) — shared by `/api/admin/forecast` and the
 * `ForecastChart`, so the peak-hour ranking is computed once and unit-tested. Each
 * "point" is one predicted (date, hour) bucket for the next 7 days; the model only writes
 * operating hours (IST 11–22), so these helpers simply aggregate whatever is present.
 */
export interface ForecastPoint {
  date: string; // target_date, YYYY-MM-DD (IST calendar day)
  hour: number; // 0–23 IST clock hour
  predicted: number; // predicted order count
}

export interface HourAverage {
  hour: number;
  avgPredicted: number;
}

/** Average predicted orders per hour-of-day across all forecast dates, ascending by hour. */
export function averageByHour(points: ForecastPoint[]): HourAverage[] {
  const sum = new Map<number, number>();
  const n = new Map<number, number>();
  for (const p of points) {
    sum.set(p.hour, (sum.get(p.hour) ?? 0) + p.predicted);
    n.set(p.hour, (n.get(p.hour) ?? 0) + 1);
  }
  return [...sum.keys()]
    .sort((a, b) => a - b)
    .map((hour) => ({ hour, avgPredicted: sum.get(hour)! / (n.get(hour) || 1) }));
}

/**
 * Top-3 peak hours by average predicted orders across the week (desc). Ties break on the
 * earlier hour so the result is deterministic.
 */
export function computeTop3PeakHours(points: ForecastPoint[]): HourAverage[] {
  return [...averageByHour(points)]
    .sort((a, b) => b.avgPredicted - a.avgPredicted || a.hour - b.hour)
    .slice(0, 3);
}
