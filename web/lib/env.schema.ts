import { z } from "zod";

/**
 * Environment schema (PRD §6). No side effects — safe to import anywhere,
 * including tests. The validated singleton + boot-time crash lives in `env.ts`.
 *
 * Required now (Phase 1). OpenRouter is required from Phase 5; the forecast /
 * cron vars from Phase 7 — kept optional so local dev isn't blocked early.
 */
export const envSchema = z.object({
  // Supabase (new-format keys: sb_publishable_ / sb_secret_)
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),

  // App
  NEXT_PUBLIC_APP_URL: z.url(),

  // OpenRouter (Phase 5) — optional until then; slugs default to :free models
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_MODEL: z.string().min(1).default("meta-llama/llama-4-scout:free"),
  OPENROUTER_FALLBACK_MODEL: z
    .string()
    .min(1)
    .default("meta-llama/llama-3.3-70b-instruct:free"),

  // Forecast service + cron (Phase 7) — optional until then
  FORECAST_SERVICE_URL: z.url().optional(),
  FORECAST_SERVICE_TOKEN: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;
