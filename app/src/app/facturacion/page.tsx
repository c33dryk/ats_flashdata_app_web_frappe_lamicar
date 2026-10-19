import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { BillingBoard } from "@/components/billing/billing-board";
import { getSession } from "@/lib/auth";
import { FrappeApiError } from "@/lib/frappe/client";
import { getBillingWorkOrders, getCatalogOptions, type BillingWorkOrder } from "@/lib/frappe/work-orders";
import type { DashboardCatalogs } from "@/lib/dashboard-metrics";
import { todayInShopTZ } from "@/lib/format";

// Facturación: entregadas por facturar + facturadas, expedientes ZIP. Acceso por SCREEN_ACCESS
// (lib/permissions.ts); la acción "Facturar" sigue COMMAND_ROLES.invoice.
export default async function FacturacionPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let rows: BillingWorkOrder[] = [];
  let catalogs: DashboardCatalogs | null = null;
  let errorMessage: string | null = null;

  try {
    [rows, catalogs] = await Promise.all([getBillingWorkOrders(), getCatalogOptions()]);
  } catch (err) {
    errorMessage =
      err instanceof FrappeApiError
        ? `No se pudo conectar con Frappe (${err.status}). Revisá FRAPPE_URL / FRAPPE_API_KEY / FRAPPE_API_SECRET en .env.`
        : "No se pudo conectar con Frappe. Revisá la configuración en .env.";
  }

  return (
    <div className="flex flex-1 flex-col">
      <Topbar>
        <Breadcrumbs items={[{ label: "Facturación" }]} />
      </Topbar>

      <div className="flex-1 space-y-4 p-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Facturación</h1>
          <p className="text-sm text-muted-foreground">Órdenes entregadas por facturar y comprobantes emitidos</p>
        </div>

        {errorMessage || !catalogs ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : (
          <BillingBoard rows={rows} catalogs={catalogs} role={session.role} todayISO={todayInShopTZ()} />
        )}
      </div>
    </div>
  );
}
