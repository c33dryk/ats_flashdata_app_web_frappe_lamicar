import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { ClientsBoard } from "@/components/clients/clients-board";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { FrappeApiError } from "@/lib/frappe/client";
import { getClients, getVehicles } from "@/lib/frappe/clients";
import { getCatalogOptions, getDashboardWorkOrders } from "@/lib/frappe/work-orders";
import type { WoClient, WoVehicle } from "@/lib/clients-shared";
import type { DashboardCatalogs } from "@/lib/dashboard-metrics";

// ABM de clientes (WO Client). Acceso: SCREEN_ACCESS["/clientes"].
export default async function ClientesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const canViewTaxId = can(session.role, "viewTaxId");

  let clients: WoClient[] = [];
  let vehicles: WoVehicle[] = [];
  let orderCounts: Record<string, number> = {};
  let catalogs: DashboardCatalogs | null = null;
  let errorMessage: string | null = null;

  try {
    const [c, v, orders, cat] = await Promise.all([getClients(), getVehicles(), getDashboardWorkOrders(), getCatalogOptions()]);
    // El CUIT no viaja al navegador de quien no debe verlo.
    clients = canViewTaxId ? c : c.map((x) => ({ ...x, tax_id: undefined }));
    vehicles = v;
    catalogs = cat;
    orderCounts = orders.reduce<Record<string, number>>((acc, o) => {
      if (o.client_id) acc[o.client_id] = (acc[o.client_id] ?? 0) + 1;
      return acc;
    }, {});
  } catch (err) {
    errorMessage =
      err instanceof FrappeApiError
        ? `No se pudo conectar con Frappe (${err.status}). Revisá FRAPPE_URL / FRAPPE_API_KEY / FRAPPE_API_SECRET en .env.`
        : "No se pudo conectar con Frappe. Revisá la configuración en .env.";
  }

  return (
    <div className="flex flex-1 flex-col">
      <Topbar>
        <Breadcrumbs items={[{ label: "Clientes" }]} />
      </Topbar>
      <div className="flex-1 space-y-4 p-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">Particulares, aseguradoras y flotas</p>
        </div>
        {errorMessage || !catalogs ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : (
          <ClientsBoard
            clients={clients}
            vehicles={vehicles}
            orderCounts={orderCounts}
            customerTypes={catalogs.customerTypes}
            canViewTaxId={canViewTaxId}
          />
        )}
      </div>
    </div>
  );
}
