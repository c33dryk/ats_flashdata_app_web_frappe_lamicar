"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { str } from "@/lib/form-data";
import { FrappeApiError } from "@/lib/frappe/client";
import { resolveOrderParties } from "@/lib/frappe/order-parties";
import { parseMileage } from "@/lib/format";
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

  // Cliente / unidad: si se eligió alguno en el form, se vincula y se copian sus datos del maestro;
  // lo no elegido queda como estaba (OTs viejas sin vincular siguen editables).
  const parties = await resolveOrderParties({
    clientId: str(formData, "client_id"),
    vehicleId: str(formData, "vehicle_id"),
  });
  if (!parties.ok) return { error: parties.error, success: false };
  const mileage = parseMileage(str(formData, "vehicle_mileage"));
  if (!mileage.ok) return { error: mileage.error, success: false };

  const payload: Partial<WorkOrder> = {
    ...parties.data,
    siniestro: str(formData, "siniestro") ?? "",
    vehicle_mileage: mileage.value,
    service_segment_id: str(formData, "service_segment_id"),
    service_type_id: str(formData, "service_type_id"),
    assigned_operator_id: str(formData, "assigned_operator_id"),
    // Solo si el form mostró el combo (hay sucursales activas); "" = quitar la sucursal.
    branch_id: formData.has("branch_id") ? (str(formData, "branch_id") ?? "") : undefined,
    description: str(formData, "description"),
    items,
    total_net: totalNet,
  };

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
  revalidatePath("/operaciones");
  return { error: null, success: true };
}
