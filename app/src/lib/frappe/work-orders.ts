import type { AppRole } from "@/lib/auth-shared";
import type { DashboardCatalogs } from "@/lib/dashboard-metrics";
import { createDoc, deleteDoc, getDoc, getList, updateDoc } from "./resource";

// Tipos y helpers para los doctypes del módulo "Lamicar Services" (work orders de taller).
// Fieldnames en snake_case porque son los nombres reales de campo en Frappe — el REST API
// los devuelve tal cual, sin transformar a camelCase.

export const WORK_ORDER_STATUSES = [
  "Nueva",
  "En Curso",
  "Pendiente",
  "Terminada",
  "Entregada",
  "Facturada",
  "Anulada",
] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export interface WorkOrderItem {
  name?: string;
  description: string;
  quantity: number;
  unit_price_net: number;
  amount_net?: number;
}

export interface WoEvidence {
  name?: string;
  type:
    | "photo_before"
    | "photo_during"
    | "photo_after"
    | "signature"
    | "delivery_note"
    | "invoice"
    | "dni"
    | "insurance_auth";
  zone?: string;
  url: string;
  filename?: string;
  notes?: string;
  signed_by?: string;
  signed_at?: string;
}

export interface WoWorkOrderEvent {
  name?: string;
  from_status?: string;
  to_status: string;
  user_id?: string;
  user_name?: string;
  reason?: string;
  event_datetime?: string;
}

export interface WorkOrder {
  name: string; // OT-YYYY-#####
  status: WorkOrderStatus;
  siniestro?: string;

  client_id?: string; // Link -> WO Client (maestro); customer_* quedan como copia histórica
  customer_type_id: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;

  vehicle_id?: string; // Link -> WO Vehicle (patente); vehicle_* quedan como copia histórica
  vehicle_type_id?: string;
  license_plate: string;
  vehicle_brand_model?: string;
  vehicle_year?: string;
  vehicle_color?: string;
  vehicle_mileage?: string;

  service_segment_id?: string;
  service_type_id?: string;
  description?: string;
  assigned_operator_id?: string;
  branch_id?: string; // Link -> WO Branch (sucursal)
  pending_reason?: string;

  items?: WorkOrderItem[];
  total_net?: number;

  delivery_date?: string;
  delivery_time?: string;
  delivery_signed_by?: string;
  delivery_signed_at?: string;
  delivery_signature_url?: string;
  delivery_note_file_name?: string;

  invoice_number?: string;
  invoice_date?: string;
  invoice_amount?: number;
  invoice_file_name?: string;
  invoice_file_url?: string;

  evidence?: WoEvidence[];
  events?: WoWorkOrderEvent[];
  row_version?: number;

  auditor_validated?: 0 | 1;
  auditor_note?: string;

  modified?: string;
  creation?: string;
}

export interface WoCustomerType {
  name: string; // = code (autoname field:code)
  code: string;
  customer_type_name: string;
  requires_claim_number?: 0 | 1;
  requires_insurance_auth?: 0 | 1;
  is_active?: 0 | 1;
}

export interface WoVehicleType {
  name: string;
  code: string;
  vehicle_type_name: string;
  description?: string;
  sort_order?: number;
  is_active?: 0 | 1;
}

export interface WoServiceSegment {
  name: string;
  code: string;
  segment_name: string;
  icon?: string;
  is_active?: 0 | 1;
}

export interface WoServiceType {
  name: string;
  code: string;
  service_name: string;
  segment: string; // Link -> WO Service Segment
  estimated_hours?: number;
  suggested_price?: number;
  is_active?: 0 | 1;
}

export interface WoOperator {
  name: string; // = employee_id
  employee_id: string;
  full_name: string;
  specialty_segment?: string;
  branch_id?: string; // Link -> WO Branch
  phone?: string;
  system_user?: string;
  is_active?: 0 | 1;
}

export interface WoBranch {
  name: string; // = code (autoname field:code)
  code: string;
  branch_name: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  is_active?: 0 | 1;
}

export interface WoEvidenceRequirement {
  name?: string;
  code: string;
  label: string;
  stage: "before" | "during" | "after" | "delivery";
  min_photos?: number;
  allow_exception?: 0 | 1;
}

export interface WoEvidencePolicy {
  name: string;
  code: string;
  policy_name: string;
  customer_type_id?: string;
  requirements?: WoEvidenceRequirement[];
  is_active?: 0 | 1;
  modified?: string;
}

// ── Work Order ────────────────────────────────────────────────────────────

// Filas livianas para el dashboard y /operaciones: todas las OTs (limit 0), solo los campos que
// usan lib/dashboard-metrics.ts y la lista/kanban. Las agregaciones se calculan en la app — al migrar a Frappe esto pasa
// a un whitelisted method / Report con GROUP BY en SQL en vez de traer todas las filas.
export type DashboardWorkOrder = Pick<
  WorkOrder,
  | "name"
  | "status"
  | "siniestro"
  | "pending_reason"
  | "customer_name"
  | "license_plate"
  | "vehicle_brand_model"
  | "customer_type_id"
  | "vehicle_type_id"
  | "service_segment_id"
  | "service_type_id"
  | "assigned_operator_id"
  | "branch_id"
  | "client_id"
  | "vehicle_id"
  | "description"
  | "total_net"
  | "invoice_amount"
  | "creation"
  | "modified"
>;

export function getDashboardWorkOrders() {
  return getList<DashboardWorkOrder>("Work Order", {
    fields: [
      "name",
      "status",
      "siniestro",
      "pending_reason",
      "customer_name",
      "license_plate",
      "vehicle_brand_model",
      "customer_type_id",
      "vehicle_type_id",
      "service_segment_id",
      "service_type_id",
      "assigned_operator_id",
      "branch_id",
      "client_id",
      "vehicle_id",
      "description",
      "total_net",
      "invoice_amount",
      "creation",
      "modified", // control de concurrencia al mover tarjetas en el kanban
    ],
    limit: 0,
    orderBy: "creation desc",
  });
}

// Filas de /facturacion: lo entregado (por facturar) y lo ya facturado, con los campos de entrega
// y factura. Al migrar a Frappe: Report "Facturación" filtrado por estado.
export type BillingWorkOrder = Pick<
  WorkOrder,
  | "name"
  | "status"
  | "siniestro"
  | "customer_name"
  | "customer_type_id"
  | "license_plate"
  | "vehicle_brand_model"
  | "total_net"
  | "delivery_date"
  | "delivery_signed_at"
  | "delivery_signed_by"
  | "invoice_number"
  | "invoice_date"
  | "invoice_amount"
  | "invoice_file_url"
  | "modified"
>;

export function getBillingWorkOrders() {
  return getList<BillingWorkOrder>("Work Order", {
    fields: [
      "name",
      "status",
      "siniestro",
      "customer_name",
      "customer_type_id",
      "license_plate",
      "vehicle_brand_model",
      "total_net",
      "delivery_date",
      "delivery_signed_at",
      "delivery_signed_by",
      "invoice_number",
      "invoice_date",
      "invoice_amount",
      "invoice_file_url",
      "modified",
    ],
    filters: [["status", "in", ["Entregada", "Facturada"]]],
    limit: 0,
    orderBy: "modified desc",
  });
}

export function getWorkOrder(name: string) {
  return getDoc<WorkOrder>("Work Order", name);
}

export function createWorkOrder(data: Partial<WorkOrder>) {
  return createDoc<WorkOrder>("Work Order", data);
}

export function updateWorkOrder(name: string, data: Partial<WorkOrder>) {
  return updateDoc<WorkOrder>("Work Order", name, data);
}

// ── Catálogos ────────────────────────────────────────────────────────────

export function getCustomerTypes() {
  return getList<WoCustomerType>("WO Customer Type", {
    limit: 0, // catálogo completo: sin limit, Frappe corta en 20 filas
    fields: ["name", "code", "customer_type_name", "requires_claim_number", "requires_insurance_auth", "is_active"],
    filters: [["is_active", "=", 1]],
    orderBy: "customer_type_name asc",
  });
}

export function getVehicleTypes() {
  return getList<WoVehicleType>("WO Vehicle Type", {
    limit: 0, // catálogo completo: sin limit, Frappe corta en 20 filas
    fields: ["name", "code", "vehicle_type_name", "description", "sort_order", "is_active"],
    filters: [["is_active", "=", 1]],
    orderBy: "sort_order asc",
  });
}

export function getServiceSegments() {
  return getList<WoServiceSegment>("WO Service Segment", {
    limit: 0, // catálogo completo: sin limit, Frappe corta en 20 filas
    fields: ["name", "code", "segment_name", "icon", "is_active"],
    filters: [["is_active", "=", 1]],
    orderBy: "segment_name asc",
  });
}

export function getServiceTypes(segmentCode?: string) {
  return getList<WoServiceType>("WO Service Type", {
    limit: 0, // catálogo completo: sin limit, Frappe corta en 20 filas
    fields: ["name", "code", "service_name", "segment", "estimated_hours", "suggested_price", "is_active"],
    filters: segmentCode
      ? [
          ["is_active", "=", 1],
          ["segment", "=", segmentCode],
        ]
      : [["is_active", "=", 1]],
    orderBy: "service_name asc",
  });
}

export function getOperators() {
  return getList<WoOperator>("WO Operator", {
    limit: 0, // catálogo completo: sin limit, Frappe corta en 20 filas
    fields: ["name", "employee_id", "full_name", "specialty_segment", "branch_id", "phone", "system_user", "is_active"],
    filters: [["is_active", "=", 1]],
    orderBy: "full_name asc",
  });
}

export function getBranches() {
  return getList<WoBranch>("WO Branch", {
    limit: 0,
    fields: ["name", "code", "branch_name", "address", "city", "phone", "email", "is_active"],
    filters: [["is_active", "=", 1]],
    orderBy: "branch_name asc",
  });
}

export function getEvidencePolicy(name: string) {
  return getDoc<WoEvidencePolicy>("WO Evidence Policy", name);
}

export function createEvidencePolicy(data: Partial<WoEvidencePolicy>) {
  return createDoc<WoEvidencePolicy>("WO Evidence Policy", data);
}

export function updateEvidencePolicy(name: string, data: Partial<WoEvidencePolicy>) {
  return updateDoc<WoEvidencePolicy>("WO Evidence Policy", name, data);
}

// No hay campo de link directo Work Order -> WO Evidence Policy (verificado contra Frappe en
// vivo) — la política aplicable se resuelve matcheando por customer_type_id.
/**
 * Todas las políticas activas de un tipo de cliente, completas (con requisitos), ordenadas por
 * nombre. Hoy hay varias por tipo (ej. una por aseguradora para "ASEG") y la OT no guarda cuál
 * aplica — el panel deja elegir. Cuando Work Order tenga un Link a la política, usar ese.
 */
export async function getEvidencePoliciesForCustomerType(
  customerTypeId?: string
): Promise<WoEvidencePolicy[]> {
  if (!customerTypeId) return [];
  const matches = await getList<WoEvidencePolicy>("WO Evidence Policy", {
    fields: ["name"],
    filters: [
      ["customer_type_id", "=", customerTypeId],
      ["is_active", "=", 1],
    ],
    orderBy: "name asc",
    limit: 0,
  });
  return Promise.all(matches.map((m) => getEvidencePolicy(m.name)));
}

export { deleteDoc };

// ── Máquina de estados y permisos ───────────────────────────────────────────
// Calcado del ciclo de vida documentado en el MVP de referencia
// (D:\Lab\lamicar-workorders\docs\DIAGRAMAS_ASCII.md) y de los roles reales de Lamicar.

export type WorkOrderCommand =
  | "start"
  | "mark_pending"
  | "finish"
  | "deliver"
  | "invoice"
  | "cancel";

export const ALLOWED_TRANSITIONS: Record<
  WorkOrderStatus,
  Partial<Record<WorkOrderCommand, WorkOrderStatus>>
> = {
  Nueva: { start: "En Curso", cancel: "Anulada" },
  "En Curso": { mark_pending: "Pendiente", finish: "Terminada", cancel: "Anulada" },
  Pendiente: { start: "En Curso", cancel: "Anulada" },
  Terminada: { deliver: "Entregada" },
  Entregada: { invoice: "Facturada" },
  Facturada: {},
  Anulada: {},
};

export const COMMAND_ROLES: Record<WorkOrderCommand, AppRole[]> = {
  start: ["admin", "recepcion", "tecnico"],
  mark_pending: ["admin", "recepcion", "tecnico"],
  finish: ["admin", "tecnico"],
  deliver: ["admin", "recepcion"],
  invoice: ["admin", "facturador"],
  cancel: ["admin"],
};

// ── Catálogos resueltos a etiquetas (dashboard / operaciones) ───────────────────

export interface RawCatalogs {
  customerTypes: WoCustomerType[];
  vehicleTypes: WoVehicleType[];
  serviceSegments: WoServiceSegment[];
  serviceTypes: WoServiceType[];
  operators: WoOperator[];
  branches: WoBranch[];
}

/** Los catálogos activos tal como vienen de Frappe (los usan los forms de alta/edición de OT). */
export async function getRawCatalogs(): Promise<RawCatalogs> {
  const [customerTypes, vehicleTypes, serviceSegments, serviceTypes, operators, branches] = await Promise.all([
    getCustomerTypes(),
    getVehicleTypes(),
    getServiceSegments(),
    getServiceTypes(),
    getOperators(),
    getBranches(),
  ]);
  return { customerTypes, vehicleTypes, serviceSegments, serviceTypes, operators, branches };
}

/** Catálogos ya mapeados a {key, label} para filtros y tablas. */
export function toCatalogOptions(raw: RawCatalogs): DashboardCatalogs {
  const { operators, serviceSegments: segments, serviceTypes: services, customerTypes, vehicleTypes, branches } = raw;
  const segmentLabel = new Map(segments.map((s) => [s.name, s.segment_name]));
  return {
    operators: operators.map((o) => ({
      key: o.name,
      label: o.full_name,
      sublabel: [o.employee_id, o.specialty_segment && segmentLabel.get(o.specialty_segment)]
        .filter(Boolean)
        .join(" · "),
    })),
    segments: segments.map((s) => ({ key: s.name, label: s.segment_name })),
    services: services.map((s) => ({ key: s.name, label: s.service_name, parent: s.segment })),
    customerTypes: customerTypes.map((c) => ({ key: c.name, label: c.customer_type_name })),
    vehicleTypes: vehicleTypes.map((v) => ({ key: v.name, label: v.vehicle_type_name })),
    branches: branches.map((b) => ({ key: b.name, label: b.branch_name, sublabel: b.city })),
  };
}

export async function getCatalogOptions(): Promise<DashboardCatalogs> {
  return toCatalogOptions(await getRawCatalogs());
}
