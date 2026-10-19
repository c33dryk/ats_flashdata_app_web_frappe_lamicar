import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { VehiclesBoard } from "@/components/clients/vehicles-board";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { FrappeApiError } from "@/lib/frappe/client";
import { getClients, getVehicles } from "@/lib/frappe/clients";
import { getCatalogOptions, getDashboardWorkOrders } from "@/lib/frappe/work-orders";
import { normalizePlate, type WoClient, type WoVehicle } from "@/lib/clients-shared";
import type { DashboardCatalogs } from "@/lib/dashboard-metrics";

// ABM de unidades / flota (WO Vehicle). Acceso: SCREEN_ACCESS["/unidades"].
export default async function UnidadesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const canViewTaxId = can(session.role, "viewTaxId");

  let vehicles: WoVehicle[] = [];
  let clients: WoClient[] = [];
  let orderCounts: Record<string, number> = {};
  let catalogs: DashboardCatalogs | null = null;
  let errorMessage: string | null = null;

  try {
    const [v, c, orders, cat] = await Promise.all([getVehicles(), getClients(), getDashboardWorkOrders(), getCatalogOptions()]);
    vehicles = v;
    clients = canViewTaxId ? c : c.map((x) => ({ ...x, tax_id: undefined }));
    catalogs = cat;
    // OTs por unidad: las vinculadas (vehicle_id) y las viejas por patente escrita (normalizada).
    orderCounts = orders.reduce<Record<string, number>>((acc, o) => {
      const plate = o.vehicle_id || normalizePlate(o.license_plate ?? "");
      if (plate) acc[plate] = (acc[plate] ?? 0) + 1;
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
        <Breadcrumbs items={[{ label: "Unidades" }]} />
      </Topbar>
      <div className="flex-1 space-y-4 p-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Unidades</h1>
          <p className="text-sm text-muted-foreground">Vehículos atendidos (flota), con su dueño</p>
        </div>
        {errorMessage || !catalogs ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : (
          <VehiclesBoard
            vehicles={vehicles}
            clients={clients}
            orderCounts={orderCounts}
            vehicleTypes={catalogs.vehicleTypes}
            customerTypes={catalogs.customerTypes}
            canViewTaxId={canViewTaxId}
          />
        )}
      </div>
    </div>
  );
}
