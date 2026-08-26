"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { FrappeApiError } from "@/lib/frappe/client";
import { createWorkOrder, type WorkOrder } from "@/lib/frappe/work-orders";

export interface CreateWorkOrderState {
  error: string | null;
}

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export async function createWorkOrderAction(
  _prevState: CreateWorkOrderState,
  formData: FormData
): Promise<CreateWorkOrderState> {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "recepcion")) {
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
    description: str(formData, "description"),
  };

  if (!payload.customer_type_id || !payload.customer_name || !payload.license_plate) {
    return { error: "Tipo de cliente, nombre del cliente y patente son obligatorios." };
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

  redirect(`/work-orders/${created.name}`);
}
