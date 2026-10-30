"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { str } from "@/lib/form-data";
import { FrappeApiError } from "@/lib/frappe/client";
import { getList } from "@/lib/frappe/resource";
import {
  createWorkOrder,
  getBranches,
  getCustomerTypes,
  getEvidencePoliciesForCustomerType,
  getServiceTypes,
  type WoEvidencePolicy,
  type WorkOrder,
} from "@/lib/frappe/work-orders";
import { resolveOrderParties } from "@/lib/frappe/order-parties";
import { parseMileage } from "@/lib/format";
import { applyServerPrices, parseItems, sumItems } from "@/lib/work-order-items";

export interface CreateWorkOrderState {
  error: string | null;
  /** Nº de la OT creada (el form vive en el panel lateral y la abre/avisa). */
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

  // Cliente y unidad salen de los maestros; sus datos se copian en la OT (order-parties.ts).
  const clientId = str(formData, "client_id");
  const vehicleId = str(formData, "vehicle_id");
  if (!clientId) return { error: "Elegí o creá el cliente de la orden." };
  if (!vehicleId) return { error: "Elegí o creá la unidad (patente) de la orden." };
  const parties = await resolveOrderParties({ clientId, vehicleId });
  if (!parties.ok) return { error: parties.error };
  const mileage = parseMileage(str(formData, "vehicle_mileage"));
  if (!mileage.ok) return { error: mileage.error };

  // Reglas del tipo de cliente (sale del maestro del cliente): siniestro obligatorio si el tipo lo
  // pide, y política de fotos/archivos obligatoria si el tipo tiene políticas (hoy: aseguradoras,
  // una por compañía). Migración a Frappe: validate() del controller de Work Order.
  const siniestro = str(formData, "siniestro");
  const evidencePolicyId = str(formData, "evidence_policy_id");
  const [customerType, policies] = await Promise.all([
    getCustomerTypes()
      .then((types) => types.find((t) => t.name === parties.data.customer_type_id))
      .catch(() => undefined),
    getEvidencePoliciesForCustomerType(parties.data.customer_type_id).catch(() => [] as WoEvidencePolicy[]),
  ]);
  if (customerType?.requires_claim_number && !siniestro) {
    return { error: `Para ${customerType.customer_type_name} el Nº de siniestro es obligatorio.` };
  }
  if (policies.length > 0 && !evidencePolicyId) {
    return { error: "Elegí la política de fotos y archivos de la aseguradora." };
  }
  if (evidencePolicyId && !policies.some((p) => p.name === evidencePolicyId)) {
    return { error: "La política de fotos elegida no corresponde a este tipo de cliente." };
  }

  // Presupuesto inicial (opcional). Quien no ve importes no manda precios: los pone el server.
  let items = parseItems(str(formData, "items_json"));
  if (items === null) return { error: "Los ítems del presupuesto no son válidos." };
  if (!can(session.role, "viewAmounts")) {
    items = applyServerPrices(items, [], await getServiceTypes().catch(() => []));
  }

  const payload: Partial<WorkOrder> = {
    ...parties.data,
    items,
    total_net: sumItems(items),
    siniestro,
    evidence_policy_id: evidencePolicyId,
    vehicle_mileage: mileage.value || undefined,
    service_segment_id: str(formData, "service_segment_id"),
    service_type_id: str(formData, "service_type_id"),
    assigned_operator_id: str(formData, "assigned_operator_id"),
    branch_id: str(formData, "branch_id"),
    description: str(formData, "description"),
  };

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

  revalidatePath("/operaciones");
  revalidatePath("/dashboard");
  return { error: null, createdName: created.name };
}

/** Políticas de fotos/archivos activas de un tipo de cliente (con sus requisitos), para el alta. */
export async function getEvidencePoliciesAction(
  customerTypeId: string
): Promise<{ ok: true; data: WoEvidencePolicy[] } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || !(can(session.role, "createOrder") || can(session.role, "editOrder"))) {
    return { ok: false, error: "Sin permiso." };
  }
  try {
    return { ok: true, data: await getEvidencePoliciesForCustomerType(customerTypeId) };
  } catch {
    return { ok: false, error: "No se pudieron leer las políticas de fotos." };
  }
}

/**
 * Política de fotos usada en la última OT del cliente (o null). Mientras `WO Client` no tenga su
 * propio Link a la política (ver schema/CAMBIOS_FRAPPE.md), así el alta la sugiere sola a partir
 * de la segunda OT de cada aseguradora.
 */
export async function getLastPolicyForClientAction(clientId: string): Promise<string | null> {
  const session = await getSession();
  if (!session || !can(session.role, "createOrder") || !clientId) return null;
  const rows = await getList<{ evidence_policy_id?: string }>("Work Order", {
    fields: ["evidence_policy_id"],
    filters: [
      ["client_id", "=", clientId],
      ["evidence_policy_id", "is", "set"],
    ],
    orderBy: "creation desc",
    limit: 1,
  }).catch(() => []);
  return rows[0]?.evidence_policy_id ?? null;
}
