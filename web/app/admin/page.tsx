import { redirect } from "next/navigation";
import { getAdminPageStatus } from "@/lib/admin-auth";
import { Dashboard } from "@/components/admin/Dashboard";

// /admin — server-gated (PRD §15.2). Unauthed → login; authed non-admin → 403 message;
// admin → the dashboard. Real authorization lives here + in the API routes (not proxy).
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const status = await getAdminPageStatus();

  if (!status.ok && status.reason === "unauthed") {
    redirect("/admin/login");
  }
  if (!status.ok) {
    return (
      <div className="container-x py-20 max-w-lg">
        <p className="eyebrow mb-2">— 403 · Forbidden</p>
        <h1 className="text-2xl font-semibold text-ink">Not an admin account</h1>
        <p className="mt-3 text-ink-secondary">
          You&apos;re signed in, but this account isn&apos;t on the admin allowlist. Contact the
          owner to be added.
        </p>
      </div>
    );
  }

  return <Dashboard adminEmail={status.user.email ?? "admin"} />;
}
