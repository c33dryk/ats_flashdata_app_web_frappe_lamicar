import Link from "next/link";
import { Topbar } from "@/components/shell/topbar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { segmentedGroupClass, segmentedItemClass } from "@/components/ui/segmented";
import { OperationalDashboard } from "@/components/dashboard/operational-dashboard";
import { ManagementDashboard } from "@/components/dashboard/management-dashboard";
import type { DashboardCatalogs } from "@/lib/dashboard-metrics";
import { FrappeApiError } from "@/lib/frappe/client";
import {
  getCatalogOptions,
  getDashboardWorkOrders,
  type DashboardWorkOrder,
} from "@/lib/frappe/work-orders";
import { todayInShopTZ } from "@/lib/format";

// Dashboard principal (todos los roles). Dos vistas, como en el MVP: "Operativo" (foto del taller
// hoy) y "Gestión" (evolución en el tiempo con filtros cruzados). La vista va en la URL
// (?vista=gestion) para que se pueda linkear y sobreviva a un refresh.
const VIEWS = [
  { key: "operativo", label: "Operativo", hint: "Capacidad viva y flujo en taller" },
  { key: "gestion", label: "Gestión", hint: "Evolución, facturación y cortes por tablas maestras" },
] as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const { vista } = await searchParams;
  const view = VIEWS.find((v) => v.key === vista) ?? VIEWS[0];

  let rows: DashboardWorkOrder[] = [];
  let catalogs: DashboardCatalogs | null = null;
  let errorMessage: string | null = null;

  try {
    [rows, catalogs] = await Promise.all([getDashboardWorkOrders(), getCatalogOptions()]);
  } catch (err) {
    errorMessage =
      err instanceof FrappeApiError
        ? `No se pudo conectar con Frappe (${err.status}). Revisá FRAPPE_URL / FRAPPE_API_KEY / FRAPPE_API_SECRET en .env.`
        : "No se pudo conectar con Frappe. Revisá la configuración en .env.";
  }

  return (
    <div className="flex flex-1 flex-col">
      <Topbar>
        <Breadcrumbs items={[{ label: "Dashboard" }]} />
      </Topbar>

      <div className="flex-1 space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">{view.hint}</p>
          </div>
          <nav className={segmentedGroupClass} aria-label="Vista del dashboard">
            {VIEWS.map((v) => (
              <Link
                key={v.key}
                href={v.key === "operativo" ? "/dashboard" : `/dashboard?vista=${v.key}`}
                aria-current={v.key === view.key ? "page" : undefined}
                className={segmentedItemClass(v.key === view.key)}
              >
                {v.label}
              </Link>
            ))}
          </nav>
        </div>

        {errorMessage || !catalogs ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : view.key === "operativo" ? (
          <OperationalDashboard rows={rows} catalogs={catalogs} />
        ) : (
          <ManagementDashboard rows={rows} catalogs={catalogs} todayISO={todayInShopTZ()} />
        )}
      </div>
    </div>
  );
}
