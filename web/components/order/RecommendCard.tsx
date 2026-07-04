import { Sparkles } from "lucide-react";

/**
 * Step 2 slot — AI "Recommended for you" (FR-4). Phase 4 renders a non-blocking
 * PLACEHOLDER; Phase 5 wires /api/recommend and fills in pizza + topping + reason
 * + a "Use this" prefill. Ordering must never block on this step, so it always
 * offers a way forward.
 */
export function RecommendCard({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="eyebrow mb-2">— Step 2 · Recommended for you</p>
        <h2 className="text-2xl font-semibold text-ink">A pick, just for you</h2>
      </div>

      <div className="card p-5 flex items-start gap-3">
        <Sparkles size={20} className="mt-0.5 text-primary" aria-hidden />
        <div>
          <p className="text-ink-secondary">
            Personalised recommendations arrive in the next release. For now, build your
            own perfect pizza on the next step.
          </p>
          <p className="mt-1 text-sm text-ink-mute">This step never blocks your order.</p>
        </div>
      </div>

      <div>
        <button type="button" className="btn btn-primary" onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}
