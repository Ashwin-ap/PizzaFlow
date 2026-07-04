import { envSchema, type Env } from "./env.schema";

/**
 * Validated env singleton (PRD §6). Parsed once at server boot; on misconfig it
 * prints the offending vars and hard-exits so the app never runs misconfigured.
 *
 * Server-only by convention: only import from route handlers / server code.
 * The service-role secret key must never reach a client bundle.
 */
function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (parsed.success) return parsed.data;

  const lines = parsed.error.issues.map(
    (i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`,
  );
  console.error(
    "\n❌ Invalid environment configuration:\n" + lines.join("\n") + "\n",
  );

  // Never abort the test runner / browser; hard-exit only on a real server boot.
  if (typeof process !== "undefined" && process.env.VITEST) {
    throw new Error("Invalid environment configuration");
  }
  process.exit(1);
}

export const env: Env = loadEnv();
