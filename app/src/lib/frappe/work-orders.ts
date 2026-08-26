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

  customer_type_id: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;

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
  phone?: string;
  system_user?: string;
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
}

// ── Work Order ────────────────────────────────────────────────────────────

const WORK_ORDER_LIST_FIELDS = [
  "name",
  "status",
  "siniestro",
  "customer_type_id",
  "customer_name",
  "customer_phone",
  "vehicle_type_id",
  "license_plate",
  "vehicle_brand_model",
  "service_segment_id",
  "service_type_id",
  "assigned_operator_id",
  "total_net",
  "row_version",
  "modified",
  "creation",
];

export function getWorkOrders(options?: { status?: WorkOrderStatus; limit?: number }) {
  return getList<WorkOrder>("Work Order", {
    fields: WORK_ORDER_LIST_FIELDS,
    filters: options?.status ? [["status", "=", options.status]] : undefined,
    limit: options?.limit ?? 500,
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
    fields: ["name", "code", "customer_type_name", "requires_claim_number", "requires_insurance_auth", "is_active"],
    filters: [["is_active", "=", 1]],
    orderBy: "customer_type_name asc",
  });
}

export function getVehicleTypes() {
  return getList<WoVehicleType>("WO Vehicle Type", {
    fields: ["name", "code", "vehicle_type_name", "description", "sort_order", "is_active"],
    filters: [["is_active", "=", 1]],
    orderBy: "sort_order asc",
  });
}

export function getServiceSegments() {
  return getList<WoServiceSegment>("WO Service Segment", {
    fields: ["name", "code", "segment_name", "icon", "is_active"],
    filters: [["is_active", "=", 1]],
    orderBy: "segment_name asc",
  });
}

export function getServiceTypes(segmentCode?: string) {
  return getList<WoServiceType>("WO Service Type", {
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
    fields: ["name", "employee_id", "full_name", "specialty_segment", "phone", "system_user", "is_active"],
    filters: [["is_active", "=", 1]],
    orderBy: "full_name asc",
  });
}

export function getEvidencePolicies() {
  return getList<WoEvidencePolicy>("WO Evidence Policy", {
    fields: ["name", "code", "policy_name", "customer_type_id", "is_active"],
    filters: [["is_active", "=", 1]],
  });
}

export { deleteDoc };
