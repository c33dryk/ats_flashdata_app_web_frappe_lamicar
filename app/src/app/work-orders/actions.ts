"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { str } from "@/lib/form-data";
import { FrappeApiError } from "@/lib/frappe/client";
import { createWorkOrder, getBranches, type WorkOrder } from "@/lib/frappe/work-orders";

export interface CreateWorkOrderState {
  error: string | null;
  /** Nº de la OT creada, cuando el form pidió quedarse en la pantalla (stay=1). */
  createdName?: string;
}

export async function createWorkOrderAction(
  _prevState: CreateWorkOrderState,
  formData: FormData
): Promise<CreateWorkOrderState> {
  const session = await getSession();
  if (!session || !can(session.role, "createOrder")) {
    return { error: "No tenés permiso para crear órdenes de trabajo." };
  }

  const payload: Partial<WorkOrder> = {
    customer_type_id: str(formData, "customer_type_id"),
    customer_name: str(formData, "customer_name"),
    customer_phone: str(formData, "customer_phone"),
    customer_email: str(formData, "customer_email"),
    siniestro: str(formData, "siniestro"),
    vehicle_type_id: str(formData, "vehicle_type_id"),
    license_plate: str(formData, "license_plate"),
    vehicle_brand_model: str(formData, "vehicle_brand_model"),
    vehicle_year: str(formData, "vehicle_year"),
    vehicle_color: str(formData, "vehicle_color"),
    vehicle_mileage: str(formData, "vehicle_mileage"),
    service_segment_id: str(formData, "service_segment_id"),
    service_type_id: str(formData, "service_type_id"),
    assigned_operator_id: str(formData, "assigned_operator_id"),
    branch_id: str(formData, "branch_id"),
    description: str(formData, "description"),
  };

  if (!payload.customer_type_id || !payload.customer_name || !payload.license_plate) {
    return { error: "Tipo de cliente, nombre del cliente y patente son obligatorios." };
  }
  // Sucursal obligatoria en OTs nuevas cuando hay sucursales cargadas (en Frappe el campo es
  // opcional a propósito: las OTs viejas no la tienen y no deben trabarse al editarlas).
  if (!payload.branch_id) {
    const branches = await getBranches().catch(() => []);
    if (branches.length > 0) return { error: "Elegí la sucursal de la orden." };
  }

  let created: WorkOrder;
  try {
    created = await createWorkOrder(payload);
  } catch (err) {
    const message =
      err instanceof FrappeApiError
        ? ((err.body as { message?: string; exception?: string } | undefined)?.message ??
          `No se pudo crear la orden (${err.status}).`)
        : "No se pudo crear la orden de trabajo.";
    return { error: message };
  }

  // Desde el modal de /operaciones (stay=1): no navegar, devolver la OT creada y refrescar listas.
  if (formData.get("stay") === "1") {
    revalidatePath("/operaciones");
    revalidatePath("/dashboard");
    revalidatePath("/work-orders");
    return { error: null, createdName: created.name };
  }

  redirect(`/work-orders/${created.name}`);
}
