import { ok } from "@/lib/response";

// Liveness probe — no DB call (PRD §11.3 / §11.5).
export async function GET() {
  return ok({ status: "ok" });
}
