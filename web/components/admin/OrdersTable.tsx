import { rupees } from "@/lib/pricing";
import { istDateTime } from "@/lib/metrics";
import type { AdminOrder, Pagination } from "@/lib/admin-api";

/** Paginated orders list (FR-14). Each row shows the order summary; pizzas are listed
 *  compactly beneath. Money right-aligned with `.tnum`. */
export function OrdersTable({
  orders,
  pagination,
  loading,
  onPage,
}: {
  orders: AdminOrder[];
  pagination: Pagination;
  loading: boolean;
  onPage: (page: number) => void;
}) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-mute border-b border-hairline">
              <th className="py-3 px-4 font-medium">Placed (IST)</th>
              <th className="py-3 px-4 font-medium">Customer</th>
              <th className="py-3 px-4 font-medium">Pizzas</th>
              <th className="py-3 px-4 font-medium text-right">Qty</th>
              <th className="py-3 px-4 font-medium text-right">Total</th>
              <th className="py-3 px-4 font-medium">Payment</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 px-4 text-center text-ink-mute">
                  {loading ? "Loading orders…" : "No orders match these filters."}
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="border-b border-hairline align-top">
                  <td className="py-3 px-4 tnum whitespace-nowrap text-ink-secondary">
                    {istDateTime(o.placed_at)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-ink">{o.customer_name}</div>
                    <div className="tnum text-xs text-ink-mute">{o.customer_phone}</div>
                  </td>
                  <td className="py-3 px-4 text-ink-secondary">
                    {(o.order_line_items ?? [])
                      .map((li) => `${li.pizza_name} · ${li.topping_name}`)
                      .join("; ")}
                  </td>
                  <td className="py-3 px-4 tnum text-right text-ink-secondary">{o.quantity}</td>
                  <td className="py-3 px-4 tnum text-right font-medium text-ink">
                    {rupees(o.total_paise)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="tag-soft">{o.payment_mode}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-hairline">
        <span className="tnum text-sm text-ink-mute">
          {pagination.total} order{pagination.total === 1 ? "" : "s"} · page {pagination.page} of{" "}
          {Math.max(pagination.totalPages, 1)}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="chip"
            disabled={pagination.page <= 1 || loading}
            onClick={() => onPage(pagination.page - 1)}
          >
            Prev
          </button>
          <button
            type="button"
            className="chip"
            disabled={pagination.page >= pagination.totalPages || loading}
            onClick={() => onPage(pagination.page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
