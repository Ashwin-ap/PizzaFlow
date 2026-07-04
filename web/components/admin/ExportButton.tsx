import { Download } from "lucide-react";
import { filterToQuery, type AdminFilter } from "@/lib/admin-api";

/**
 * CSV export (FR-18). A plain anchor GET to /api/admin/export — same-origin, so the
 * session cookie is sent and the server streams a Content-Disposition attachment.
 */
export function ExportButton({ filter }: { filter: AdminFilter }) {
  const href = `/api/admin/export?${filterToQuery(filter)}`;
  return (
    <a className="btn btn-secondary" href={href} download>
      <Download size={16} aria-hidden />
      Export CSV
    </a>
  );
}
