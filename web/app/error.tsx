"use client";

// Root route error boundary (PRD §10.3 / §16.1 "never white-screen"). Catches
// uncaught render errors in the page subtree and shows a branded recovery UI
// instead of a blank screen. Async/event-handler errors are handled explicitly
// in the Stepper's own state — this is the last-resort net.
//
// Next.js 16 passes `unstable_retry` (the classic `reset` was renamed); we accept
// either so the retry button works regardless.
import { useEffect } from "react";

export default function Error({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const retry = unstable_retry ?? reset;

  return (
    <div className="container-x py-20 max-w-xl flex flex-col gap-4">
      <p className="eyebrow">— Something went wrong</p>
      <h1 className="text-2xl font-semibold text-ink">We hit a snag</h1>
      <p className="text-ink-secondary">
        The page ran into an unexpected error. Your order was not placed. Please try again.
      </p>
      <div>
        <button type="button" className="btn btn-primary" onClick={() => retry?.()}>
          Try again
        </button>
      </div>
    </div>
  );
}
