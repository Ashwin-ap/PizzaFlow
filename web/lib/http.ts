/** Request-body size cap (PRD §11.5) — a cheap guard against payload-flood abuse. */
export const MAX_BODY_BYTES = 10 * 1024; // ~10 kB

export type ReadResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "too_large" | "invalid_json" };

/**
 * Read a JSON request body with a byte cap. Rejects oversized bodies and malformed
 * JSON; the caller maps both to VALIDATION_ERROR (400). Uses TextEncoder (not Buffer)
 * so it works in either the Node or edge runtime.
 */
export async function readJsonWithCap(
  req: Request,
  maxBytes = MAX_BODY_BYTES,
): Promise<ReadResult> {
  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    return { ok: false, reason: "too_large" };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}
