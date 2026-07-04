import { formatHourIST, istDateTime } from "@/lib/metrics";
import { averageByHour } from "@/lib/forecast";
import type { AdminForecast } from "@/lib/admin-api";

// Feature C dashboard widget (FR-20). Dependency-free inline-SVG bar chart of the average
// predicted orders per operating hour (across the next 7 days), the top-3 predicted peak
// hours, and a caption documenting the model + RMSE. Reuses formatHourIST/istDateTime so
// hours read the same as the rest of the dashboard.

const W = 720;
const H = 220;
const PAD = { left: 12, right: 12, top: 20, bottom: 30 };

export function ForecastChart({
  forecast,
  loading,
}: {
  forecast: AdminForecast | null;
  loading: boolean;
}) {
  if (!forecast || forecast.generatedAt === null) {
    return (
      <section className="card p-6">
        <p className="eyebrow mb-1">— Demand forecast · next 7 days</p>
        <p className="text-sm text-ink-mute">
          {loading
            ? "Loading forecast…"
            : "No forecast yet — run training to populate the 7-day outlook."}
        </p>
      </section>
    );
  }

  const avgs = averageByHour(forecast.points);
  const peaks = new Set(forecast.top3PeakHours.map((p) => p.hour));
  const max = Math.max(1, ...avgs.map((a) => a.avgPredicted));
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const band = avgs.length ? chartW / avgs.length : chartW;
  const barW = band * 0.6;

  const ariaLabel = `Predicted orders per hour for the next 7 days. Busiest hours: ${forecast.top3PeakHours
    .map((p) => `${formatHourIST(p.hour)} at ${p.avgPredicted.toFixed(1)} orders`)
    .join(", ")}.`;

  return (
    <section className="card p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow">— Demand forecast · next 7 days</p>
        <p className="tnum text-xs text-ink-mute">
          Model {forecast.model ?? "—"}
          {forecast.rmse != null ? ` · RMSE ${forecast.rmse.toFixed(2)} orders/hr` : ""}
          {` · generated ${istDateTime(forecast.generatedAt)}`}
        </p>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={ariaLabel}
        className={`max-w-full ${loading ? "opacity-50" : ""}`}
      >
        {avgs.map((a, i) => {
          const barH = (a.avgPredicted / max) * chartH;
          const x = PAD.left + i * band + (band - barW) / 2;
          const y = PAD.top + (chartH - barH);
          const isPeak = peaks.has(a.hour);
          return (
            <g key={a.hour}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={3}
                className={isPeak ? "fill-primary" : "fill-primary-subdued"}
              />
              <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize="10" className="fill-ink-mute">
                {a.avgPredicted.toFixed(1)}
              </text>
              <text x={x + barW / 2} y={H - 10} textAnchor="middle" fontSize="10" className="fill-ink-mute">
                {formatHourIST(a.hour)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="grid gap-3 sm:grid-cols-3">
        {forecast.top3PeakHours.map((p, i) => (
          <div key={p.hour} className="card p-4">
            <p className="eyebrow mb-1">— Peak #{i + 1}</p>
            <p className="text-xl font-semibold text-ink">{formatHourIST(p.hour)}</p>
            <p className="tnum text-sm text-ink-mute">{p.avgPredicted.toFixed(1)} orders/day (avg)</p>
          </div>
        ))}
      </div>
    </section>
  );
}
