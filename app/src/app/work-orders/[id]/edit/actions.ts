"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { can, canSeeStatus } from "@/lib/permissions";
import { str } from "@/lib/form-data";
import { FrappeApiError } from "@/lib/frappe/client";
import { resolveOrderParties } from "@/lib/frappe/order-parties";
import { parseMileage } from "@/lib/format";
import { applyServerPrices, keepOwnRowNames, parseItems, sumItems } from "@/lib/work-order-items";
import {
  getEvidencePoliciesForCustomerType,
  getServiceTypes,
  getWorkOrder,
  updateWorkOrder,
  type WorkOrder,
} from "@/lib/frappe/work-orders";

export interface EditWorkOrderState {
  error: string | null;
  success: boolean;
}

const LOCKED_STATUSES = ["Facturada", "Anulada"] as const;

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
  if (!canSeeStatus(session.role, fresh.status)) {
    return { error: "No tenés acceso a esta orden.", success: false };
  }

  let items = parseItems(str(formData, "items_json"));
  if (items === null) {
    return { error: "Los ítems cargados no son válidos.", success: false };
  }
  items = keepOwnRowNames(items, fresh.items ?? []);
  // Quien no ve importes (técnico) no manda precios: los pone el server (ver applyServerPrices).
  if (!can(session.role, "viewAmounts")) {
    items = applyServerPrices(items, fresh.items ?? [], await getServiceTypes().catch(() => []));
  }
  const totalNet = sumItems(items);

  // Cliente / unidad: si se eligió alguno en el form, se vincula y se copian sus datos del maestro;
  // lo no elegido queda como estaba (OTs viejas sin vincular siguen editables).
  const parties = await resolveOrderParties({
    clientId: str(formData, "client_id"),
    vehicleId: str(formData, "vehicle_id"),
  });
  if (!parties.ok) return { error: parties.error, success: false };
  const mileage = parseMileage(str(formData, "vehicle_mileage"));
  if (!mileage.ok) return { error: mileage.error, success: false };

  // Política de fotos (solo la manda el form con pestañas): tiene que ser del tipo de cliente que
  // queda en la OT. Vacío = no tocar (OTs viejas sin política siguen editables).
  const evidencePolicyId = str(formData, "evidence_policy_id");
  if (evidencePolicyId) {
    const policies = await getEvidencePoliciesForCustomerType(
      parties.data.customer_type_id ?? fresh.customer_type_id
    ).catch(() => []);
    if (!policies.some((p) => p.name === evidencePolicyId)) {
      return { error: "La política de fotos elegida no corresponde al tipo de cliente de la orden.", success: false };
    }
  }

  const payload: Partial<WorkOrder> = {
    ...parties.data,
    evidence_policy_id: evidencePolicyId,
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
