/**
 * OpenRouter transport (PRD §12.2/§12.3). Server-only. The API key never reaches
 * the client. Everything here is I/O + defensive parsing; the recommendation DOMAIN
 * (prompt, menu-validation, fallback selection) lives in lib/recommend.ts.
 *
 * Two guardrails from the PRD:
 *  - 4 s timeout → fall back rather than stall the ordering path.
 *  - Free models are inconsistent with `response_format: json_schema`, so we request
 *    a plain json_object and parse DEFENSIVELY with extractJsonObject (below).
 */
export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterResult {
  content: string;
  modelUsed: string;
  latencyMs: number;
}

interface CallOpts {
  apiKey: string;
  model: string;
  fallbackModel?: string;
  messages: ChatMessage[];
  timeoutMs?: number;
}

async function callOnce(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  timeoutMs: number,
): Promise<{ content: string; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "x-title": "SliceMatic",
      },
      body: JSON.stringify({
        model,
        messages,
        // A hint only — we still parse defensively (free models often ignore this).
        response_format: { type: "json_object" },
        temperature: 0.4,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return { content: "", status: res.status };
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return { content: data.choices?.[0]?.message?.content ?? "", status: 200 };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call OpenRouter with the primary model, rotating to the fallback `:free` model on
 * a 429 (throttle) or a timeout/network error. Throws if both attempts fail, so the
 * caller can drop to the deterministic pick. Logs are the caller's responsibility.
 */
export async function callOpenRouter(opts: CallOpts): Promise<OpenRouterResult> {
  const { apiKey, model, fallbackModel, messages, timeoutMs = 4000 } = opts;
  const started = Date.now();

  const attempt = async (m: string): Promise<string | null> => {
    try {
      const { content, status } = await callOnce(apiKey, m, messages, timeoutMs);
      if (status === 429) return null; // throttled → rotate
      if (!content) return null;
      return content;
    } catch {
      return null; // abort/timeout/network → rotate
    }
  };

  const primary = await attempt(model);
  if (primary !== null) return { content: primary, modelUsed: model, latencyMs: Date.now() - started };

  if (fallbackModel && fallbackModel !== model) {
    const fb = await attempt(fallbackModel);
    if (fb !== null) return { content: fb, modelUsed: fallbackModel, latencyMs: Date.now() - started };
  }
  throw new Error("OpenRouter unavailable (primary + fallback failed)");
}

/**
 * Extract the first complete JSON object from arbitrary model text — tolerating code
 * fences, prose before/after, and trailing tokens. Brace-matched (string-aware) so a
 * `}` inside a quoted value doesn't close early. Returns null if none parses.
 */
export function extractJsonObject(text: string): unknown | null {
  if (!text) return null;
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
