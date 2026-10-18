import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { OperationsBoard } from "@/components/operations/operations-board";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { FrappeApiError } from "@/lib/frappe/client";
import {
  getDashboardWorkOrders,
  getRawCatalogs,
  toCatalogOptions,
  type DashboardWorkOrder,
  type RawCatalogs,
} from "@/lib/frappe/work-orders";
import type { DashboardCatalogs } from "@/lib/dashboard-metrics";

// Módulo de Operaciones: nueva versión del listado de OTs (indicadores + lista por defecto +
// kanban por estado). Convive con /work-orders, que queda como estaba hasta validar esta pantalla;
// el detalle/edición/transiciones siguen siendo /work-orders/[id].
export default async function OperacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; filtro?: string }>;
}) {
  const { vista, filtro } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  let rows: DashboardWorkOrder[] = [];
  let raw: RawCatalogs | null = null;
  let catalogs: DashboardCatalogs | null = null;
  let errorMessage: string | null = null;

  try {
    [rows, raw] = await Promise.all([getDashboardWorkOrders(), getRawCatalogs()]);
    catalogs = toCatalogOptions(raw);
  } catch (err) {
    errorMessage =
      err instanceof FrappeApiError
        ? `No se pudo conectar con Frappe (${err.status}). Revisá FRAPPE_URL / FRAPPE_API_KEY / FRAPPE_API_SECRET en .env.`
        : "No se pudo conectar con Frappe. Revisá la configuración en .env.";
  }

  return (
    <div className="flex flex-1 flex-col">
      <Topbar>
        <Breadcrumbs items={[{ label: "Operaciones" }]} />
      </Topbar>

      <div className="flex-1 space-y-4 p-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Operaciones</h1>
          <p className="text-sm text-muted-foreground">Órdenes de trabajo del taller</p>
        </div>

        {errorMessage || !catalogs ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : (
          <OperationsBoard
            rows={rows}
            catalogs={catalogs}
            initialView={vista === "kanban" ? "kanban" : "list"}
            initialFilter={filtro}
            role={session.role}
            newOrderCatalogs={raw && can(session.role, "createOrder") ? raw : undefined}
          />
        )}
      </div>
    </div>
  );
}
