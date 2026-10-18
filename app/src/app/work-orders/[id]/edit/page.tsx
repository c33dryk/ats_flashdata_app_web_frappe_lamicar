import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { EditWorkOrderForm } from "@/components/work-orders/edit-work-order-form";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { FrappeApiError } from "@/lib/frappe/client";
import {
  getCustomerTypes,
  getOperators,
  getServiceSegments,
  getServiceTypes,
  getVehicleTypes,
  getWorkOrder,
} from "@/lib/frappe/work-orders";

const LOCKED_STATUSES = ["Facturada", "Anulada"] as const;

export default async function EditWorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || !can(session.role, "editOrder")) {
    redirect(`/work-orders/${id}`);
  }

  let wo: Awaited<ReturnType<typeof getWorkOrder>>;
  try {
    wo = await getWorkOrder(id);
  } catch (err) {
    if (err instanceof FrappeApiError && err.status === 404) notFound();
    throw err;
  }

  if (LOCKED_STATUSES.includes(wo.status as (typeof LOCKED_STATUSES)[number])) {
    redirect(`/work-orders/${id}`);
  }

  let catalogs: {
    customerTypes: Awaited<ReturnType<typeof getCustomerTypes>>;
    vehicleTypes: Awaited<ReturnType<typeof getVehicleTypes>>;
    serviceSegments: Awaited<ReturnType<typeof getServiceSegments>>;
    serviceTypes: Awaited<ReturnType<typeof getServiceTypes>>;
    operators: Awaited<ReturnType<typeof getOperators>>;
  } | null = null;
  let errorMessage: string | null = null;

  try {
    const [customerTypes, vehicleTypes, serviceSegments, serviceTypes, operators] =
      await Promise.all([
        getCustomerTypes(),
        getVehicleTypes(),
        getServiceSegments(),
        getServiceTypes(),
        getOperators(),
      ]);
    catalogs = { customerTypes, vehicleTypes, serviceSegments, serviceTypes, operators };
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
          items={[
            { label: "Órdenes de Trabajo", href: "/work-orders" },
            { label: id, href: `/work-orders/${id}` },
            { label: "Editar" },
          ]}
        />
      </Topbar>

      <div className="flex-1 space-y-4 p-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Editar {id}</h1>
          <p className="text-sm text-muted-foreground">
            Actualizá los datos y los ítems de trabajo.
          </p>
        </div>

        {errorMessage ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : (
          catalogs && (
            <EditWorkOrderForm
              workOrder={wo}
              customerTypes={catalogs.customerTypes}
              vehicleTypes={catalogs.vehicleTypes}
              serviceSegments={catalogs.serviceSegments}
              serviceTypes={catalogs.serviceTypes}
              operators={catalogs.operators}
            />
          )
        )}
      </div>
    </div>
  );
}
