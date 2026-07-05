"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser-ssr";

/**
 * Admin login (FR-13). Supabase Auth email/password — the session is persisted to the
 * Supabase cookie by @supabase/ssr, so the server routes/`/admin` gate can read it.
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await createBrowserSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setSubmitting(false);
      setError("Invalid email or password.");
      return;
    }
    // Full navigation so the server component re-reads the fresh session cookie.
    router.replace("/admin");
    router.refresh();
  }

  return (
    <div className="container-x py-20 max-w-md">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-ink-secondary no-underline hover:text-primary mb-8"
      >
        <span aria-hidden="true">←</span> Back to ordering
      </Link>
      <p className="eyebrow mb-2">— SliceMatic · Admin</p>
      <h1 className="text-3xl font-semibold text-ink mb-6">Owner sign in</h1>

      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <label htmlFor="email" className="flex flex-col gap-1">
          <span className="text-sm text-ink-secondary">Email</span>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label htmlFor="password" className="flex flex-col gap-1">
          <span className="text-sm text-ink-secondary">Password</span>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <p role="alert" aria-live="polite" className="field-error">
            {error}
          </p>
        )}

        <div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
