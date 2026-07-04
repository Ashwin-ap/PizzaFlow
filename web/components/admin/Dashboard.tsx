"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser-ssr";
import {
  fetchAdminMetrics,
  fetchAdminOrders,
  AdminUnauthorizedError,
  type AdminFilter,
  type AdminMetrics,
  type AdminOrder,
  type Pagination,
} from "@/lib/admin-api";
import { MetricCards } from "./MetricCards";
import { FilterBar } from "./FilterBar";
import { OrdersTable } from "./OrdersTable";
import { ExportButton } from "./ExportButton";

const PAGE_SIZE = 20;

export function Dashboard({ adminEmail }: { adminEmail: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<AdminFilter>({}); // all-time by default
  const [presetKey, setPresetKey] = useState("all");
  const [page, setPage] = useState(1);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, o] = await Promise.all([
        fetchAdminMetrics(filter),
        fetchAdminOrders(filter, page, PAGE_SIZE),
      ]);
      setMetrics(m);
      setOrders(o.orders);
      setPagination(o.pagination);
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) {
        router.push("/admin/login");
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to load the dashboard.");
    } finally {
      setLoading(false);
    }
  }, [filter, page, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function signOut() {
    await createBrowserSupabase().auth.signOut();
    router.push("/admin/login");
  }

  return (
    <div className="container-x py-10 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">— SliceMatic · Owner dashboard</p>
          <h1 className="text-3xl font-semibold text-ink">Orders &amp; metrics</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-mute">{adminEmail}</span>
          <button type="button" className="btn btn-secondary" onClick={() => void signOut()}>
            <LogOut size={16} aria-hidden />
            Sign out
          </button>
        </div>
      </div>

      <FilterBar
        filter={filter}
        presetKey={presetKey}
        onChange={({ filter: f, presetKey: k }) => {
          setFilter(f);
          setPresetKey(k);
          setPage(1);
        }}
      />

      {error && (
        <div className="card p-4 border-ruby/40" role="alert" aria-live="polite">
          <p className="text-ink">{error}</p>
          <button type="button" className="btn btn-secondary mt-3" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      <MetricCards metrics={metrics} loading={loading} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Orders</h2>
        <ExportButton filter={filter} />
      </div>

      <OrdersTable orders={orders} pagination={pagination} loading={loading} onPage={setPage} />
    </div>
  );
}
