import { rupees } from "@/lib/pricing";
import { formatHourIST } from "@/lib/metrics";
import type { AdminMetrics } from "@/lib/admin-api";

/** The four owner KPIs (FR-15..FR-17 + order count). Tabular numerals via `.tnum`. */
export function MetricCards({ metrics, loading }: { metrics: AdminMetrics | null; loading: boolean }) {
  const tiles: { label: string; value: string; hint?: string }[] = [
    { label: "Revenue", value: metrics ? rupees(metrics.revenuePaise) : "—" },
    { label: "Orders", value: metrics ? String(metrics.orderCount) : "—" },
    {
      label: "Top pizza",
      value: metrics?.topPizza ? metrics.topPizza.name : "—",
      hint: metrics?.topPizza ? `${metrics.topPizza.count} sold` : undefined,
    },
    {
      label: "Busiest hour (IST)",
      value: metrics?.busiestHour ? formatHourIST(metrics.busiestHour.hour) : "—",
      hint: metrics?.busiestHour ? `${metrics.busiestHour.count} orders` : undefined,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="card p-5">
          <p className="eyebrow mb-2">— {t.label}</p>
          <p className={`tnum text-2xl font-semibold text-ink ${loading ? "opacity-50" : ""}`}>
            {t.value}
          </p>
          {t.hint && <p className="tnum mt-1 text-sm text-ink-mute">{t.hint}</p>}
        </div>
      ))}
    </div>
  );
}
