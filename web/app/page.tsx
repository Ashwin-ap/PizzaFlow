import { StatusChips } from "@/components/StatusChips";

const SWATCHES = [
  { name: "primary", className: "bg-primary" },
  { name: "brand-dark", className: "bg-brand-dark" },
  { name: "ink", className: "bg-ink" },
  { name: "canvas-soft", className: "bg-canvas-soft border border-hairline" },
  { name: "ruby", className: "bg-ruby" },
  { name: "star", className: "bg-star" },
  { name: "green", className: "bg-green" },
];

export default function Home() {
  return (
    <div className="container-x py-20 md:py-28">
      {/* Hero */}
      <section className="max-w-2xl">
        <p className="eyebrow mb-4">— Stage 3 · SliceMatic</p>
        <h1 className="text-4xl md:text-6xl font-semibold tracking-[-1px] leading-[1.05] text-ink">
          Pizza ordering,
          <br />
          <span className="text-ink-mute">done right.</span>
        </h1>
        <p className="mt-6 text-base md:text-lg font-light text-ink-secondary max-w-xl">
          A production rebuild of the SliceMatic ordering flow — server-authoritative
          pricing, an AI recommendation engine, and an owner dashboard. This is the
          Phase&nbsp;1 foundation.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" disabled aria-disabled>
            Order now
          </button>
          <button type="button" className="btn btn-secondary" disabled aria-disabled>
            View menu
          </button>
          <span className="self-center tag-soft">Live flow → Phase 4</span>
        </div>

        <div className="mt-8">
          <StatusChips />
        </div>
      </section>

      {/* Design-system proof strip */}
      <section className="mt-20 card p-6 md:p-8">
        <p className="eyebrow mb-4">— Design system</p>
        <div className="flex flex-wrap gap-3">
          {SWATCHES.map((s) => (
            <div key={s.name} className="flex flex-col items-center gap-2">
              <span className={`w-14 h-14 rounded-xl ${s.className}`} />
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">
                {s.name}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span className="text-2xl font-semibold text-ink">Inter</span>
          <span className="text-2xl font-light text-ink-secondary">300 / 400 / 500 / 600</span>
          <span className="font-mono text-sm text-ink-mute tnum">JetBrains Mono · ₹3,594.87</span>
        </div>
      </section>
    </div>
  );
}
