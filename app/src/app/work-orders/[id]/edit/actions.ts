"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { str } from "@/lib/form-data";
import { FrappeApiError } from "@/lib/frappe/client";
import { getWorkOrder, updateWorkOrder, type WorkOrder, type WorkOrderItem } from "@/lib/frappe/work-orders";

export interface EditWorkOrderState {
  error: string | null;
  success: boolean;
}

const LOCKED_STATUSES = ["Facturada", "Anulada"] as const;

function parseItems(raw: string | undefined): WorkOrderItem[] | null {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const items: WorkOrderItem[] = [];
  for (const row of parsed) {
    if (typeof row !== "object" || row === null) return null;
    const r = row as Record<string, unknown>;
    const description = typeof r.description === "string" ? r.description.trim() : "";
    if (!description) continue;
    const quantity = Number(r.quantity);
    const unitPriceNet = Number(r.unit_price_net);
    if (!Number.isFinite(quantity) || quantity <= 0) return null;
    if (!Number.isFinite(unitPriceNet) || unitPriceNet < 0) return null;

    items.push({
      name: typeof r.name === "string" && r.name ? r.name : undefined,
      description,
      quantity,
      unit_price_net: unitPriceNet,
      amount_net: Math.round(quantity * unitPriceNet * 100) / 100,
    });
  }
  return items;
}

export async function updateWorkOrderAction(
  _prevState: EditWorkOrderState,
  formData: FormData
): Promise<EditWorkOrderState> {
  const session = await getSession();
  if (!session || !can(session.role, "editOrder")) {
    return { error: "No tenés permiso para editar órdenes de trabajo.", success: false };
  }

  const orderId = str(formData, "order_id");
  const expectedModified = str(formData, "expected_modified");
  if (!orderId) return { error: "Solicitud inválida.", success: false };

  let fresh: WorkOrder;
  try {
    fresh = await getWorkOrder(orderId);
  } catch {
    return { error: "No se pudo leer la orden de trabajo. Recargá la página.", success: false };
  }

  if (fresh.modified !== expectedModified) {
    return { error: "La orden fue modificada por otro usuario. Recargá la página.", success: false };
  }

  if (LOCKED_STATUSES.includes(fresh.status as (typeof LOCKED_STATUSES)[number])) {
    return { error: "Esta orden ya no se puede editar.", success: false };
  }

  const items = parseItems(str(formData, "items_json"));
  if (items === null) {
    return { error: "Los ítems cargados no son válidos.", success: false };
  }
  const totalNet = Math.round(items.reduce((acc, it) => acc + (it.amount_net ?? 0), 0) * 100) / 100;

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
    items,
    total_net: totalNet,
  };

  if (!payload.customer_type_id || !payload.customer_name || !payload.license_plate) {
    return {
      error: "Tipo de cliente, nombre del cliente y patente son obligatorios.",
      success: false,
    };
  }

  try {
    await updateWorkOrder(orderId, payload);
  } catch (err) {
    const message =
      err instanceof FrappeApiError
        ? ((err.body as { message?: string } | undefined)?.message ??
          `No se pudo guardar la orden (${err.status}).`)
        : "No se pudo guardar la orden de trabajo.";
    return { error: message, success: false };
  }

  revalidatePath(`/work-orders/${orderId}`);
  revalidatePath("/work-orders");
  return { error: null, success: true };
}
