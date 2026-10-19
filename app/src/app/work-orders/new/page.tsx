import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { NewWorkOrderForm } from "@/components/work-orders/new-work-order-form";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { FrappeApiError } from "@/lib/frappe/client";
import {
  getRawCatalogs,
  type RawCatalogs,
} from "@/lib/frappe/work-orders";

export default async function NewWorkOrderPage() {
  const session = await getSession();
  if (!session || !can(session.role, "createOrder")) {
    redirect("/work-orders");
  }

  let catalogs: RawCatalogs | null = null;
  let errorMessage: string | null = null;

  try {
    catalogs = await getRawCatalogs();
  } catch (err) {
    errorMessage =
      err instanceof FrappeApiError
        ? `No se pudo conectar con Frappe (${err.status}). Revisá FRAPPE_URL / FRAPPE_API_KEY / FRAPPE_API_SECRET en .env.`
        : "No se pudo conectar con Frappe. Revisá la configuración en .env.";
  }

  return (
    <div className="flex flex-1 flex-col">
      <Topbar>
        <Breadcrumbs
          items={[{ label: "Órdenes de Trabajo", href: "/work-orders" }, { label: "Nueva" }]}
        />
      </Topbar>

      <div className="flex-1 space-y-4 p-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Nueva Orden de Trabajo</h1>
          <p className="text-sm text-muted-foreground">
            Completá los datos del cliente, el vehículo y el servicio.
          </p>
        </div>

        {errorMessage ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : (
          catalogs && (
            <NewWorkOrderForm
              customerTypes={catalogs.customerTypes}
              vehicleTypes={catalogs.vehicleTypes}
              serviceSegments={catalogs.serviceSegments}
              serviceTypes={catalogs.serviceTypes}
              operators={catalogs.operators}
              branches={catalogs.branches}
              canViewTaxId={can(session.role, "viewTaxId")}
            />
          )
        )}
      </div>
    </div>
  );
}
