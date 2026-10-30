import Link from "next/link";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { segmentedGroupClass, segmentedItemClass } from "@/components/ui/segmented";
import { OperationalDashboard } from "@/components/dashboard/operational-dashboard";
import { ManagementDashboard } from "@/components/dashboard/management-dashboard";
import { BillingDashboard, ReceptionDashboard, WorkshopDashboard } from "@/components/dashboard/role-dashboards";
import type { DashboardCatalogs } from "@/lib/dashboard-metrics";
import { FrappeApiError } from "@/lib/frappe/client";
import {
  getDashboardWorkOrders,
  getRawCatalogs,
  toCatalogOptions,
  type DashboardWorkOrder,
  type WoOperator,
} from "@/lib/frappe/work-orders";
import { todayInShopTZ } from "@/lib/format";
import { getSession } from "@/lib/auth";
import { DASHBOARD_VIEWS, can, canAccessPath, type DashboardView } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { visibleOrdersFor } from "@/lib/work-order-visibility";

// Dashboard principal. Cada rol entra a su tablero (DASHBOARD_VIEWS en lib/permissions.ts):
// Recepción, Taller (técnico) y Facturación muestran lo que ese puesto necesita hoy; "Operativo"
// (foto del taller) y "Gestión" (evolución con filtros cruzados) son las vistas generales. El admin
// ve todas. La vista va en la URL (?vista=) para que se pueda linkear y sobreviva a un refresh.
const VIEW_META: Record<DashboardView, { label: string; hint: string }> = {
  operativo: { label: "Operativo", hint: "Capacidad viva y flujo en taller" },
  gestion: { label: "Gestión", hint: "Evolución, facturación y cortes por tablas maestras" },
  recepcion: { label: "Recepción", hint: "Ingresos, entregas y esperas del día" },
  taller: { label: "Taller", hint: "Trabajos asignados, por estado" },
  facturacion: { label: "Facturación", hint: "Cola de facturación y lo facturado en el mes" },
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; tecnico?: string }>;
}) {
  const { vista, tecnico } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const views = DASHBOARD_VIEWS[session.role];
  const view = views.find((v) => v === vista) ?? views[0];
  const shopAccess = canAccessPath(session.role, "/operaciones");
  const todayISO = todayInShopTZ();

  let rows: DashboardWorkOrder[] = [];
  let catalogs: DashboardCatalogs | null = null;
  let operators: WoOperator[] = [];
  let errorMessage: string | null = null;

  try {
    const [r, raw] = await Promise.all([getDashboardWorkOrders(), getRawCatalogs()]);
    rows = visibleOrdersFor(session.role, r);
    operators = raw.operators;
    catalogs = toCatalogOptions(raw);
  } catch (err) {
    errorMessage =
      err instanceof FrappeApiError
        ? `No se pudo conectar con Frappe (${err.status}). Revisá FRAPPE_URL / FRAPPE_API_KEY / FRAPPE_API_SECRET en .env.`
        : "No se pudo conectar con Frappe. Revisá la configuración en .env.";
  }

  // Taller: el técnico ve lo suyo (operario vinculado a su usuario); el admin elige (?tecnico=).
  const isTechnician = session.role === "tecnico";
  const ownOperator = isTechnician
    ? operators.find((o) => o.system_user?.toLowerCase() === session.userId.toLowerCase())
    : undefined;
  const operatorId = isTechnician ? (ownOperator?.name ?? "") : (tecnico ?? "");

  return (
    <div className="flex flex-1 flex-col">
      <Topbar>
        <Breadcrumbs items={[{ label: "Dashboard" }]} />
      </Topbar>

      <div className="flex-1 space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">
              {isTechnician && ownOperator ? `Hola, ${ownOperator.full_name.split(" ")[0]}` : "Dashboard"}
            </h1>
            <p className="text-sm text-muted-foreground">{VIEW_META[view].hint}</p>
          </div>
          {views.length > 1 && (
            <nav className="-mx-4 max-w-[calc(100%+2rem)] overflow-x-auto px-4 sm:mx-0 sm:max-w-full sm:px-0" aria-label="Vista del dashboard">
              <div className={cn(segmentedGroupClass, "w-max")}>
                {views.map((v) => (
                  <Link
                    key={v}
                    href={v === views[0] ? "/dashboard" : `/dashboard?vista=${v}`}
                    aria-current={v === view ? "page" : undefined}
                    className={segmentedItemClass(v === view)}
                  >
                    {VIEW_META[v].label}
                  </Link>
                ))}
              </div>
            </nav>
          )}
        </div>

        {errorMessage || !catalogs ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : view === "operativo" ? (
          <OperationalDashboard rows={rows} catalogs={catalogs} shopAccess={shopAccess} />
        ) : view === "gestion" ? (
          <ManagementDashboard rows={rows} catalogs={catalogs} todayISO={todayISO} />
        ) : view === "recepcion" ? (
          <ReceptionDashboard
            rows={rows}
            catalogs={catalogs}
            todayISO={todayISO}
            canCreate={can(session.role, "createOrder")}
          />
        ) : view === "taller" ? (
          <WorkshopDashboard
            rows={rows}
            catalogs={catalogs}
            todayISO={todayISO}
            operatorId={operatorId}
            canPickOperator={!isTechnician}
            notLinked={isTechnician && !ownOperator}
          />
        ) : (
          <BillingDashboard rows={rows} catalogs={catalogs} todayISO={todayISO} />
        )}
      </div>
    </div>
  );
}
