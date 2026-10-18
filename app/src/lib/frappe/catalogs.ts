// Config de los catálogos administrables desde /admin/configuracion. Módulo de datos puro (sin
// "use client"/"use server") — lo importan tanto el Server Action (para saber qué campos parsear
// y a qué doctype pegarle) como el componente cliente (para renderizar el form), así quedan
// sincronizados por definición en vez de por convención.

export type CatalogFieldType = "text" | "number" | "checkbox" | "segment-select";

export interface CatalogFieldConfig {
  name: string;
  label: string;
  type: CatalogFieldType;
  required?: boolean;
}

export interface CatalogDef {
  key: string;
  doctype: string;
  label: string;
  newLabel: string;
  idField: string;
  fields: CatalogFieldConfig[];
  listColumns: string[];
}

export const CATALOG_DEFS: CatalogDef[] = [
  {
    key: "customer-types",
    doctype: "WO Customer Type",
    label: "Tipos de Cliente",
    newLabel: "Nuevo Tipo de Cliente",
    idField: "code",
    fields: [
      { name: "code", label: "Código", type: "text", required: true },
      { name: "customer_type_name", label: "Nombre", type: "text", required: true },
      { name: "requires_claim_number", label: "Requiere Siniestro", type: "checkbox" },
      { name: "requires_insurance_auth", label: "Requiere Autorización de Aseguradora", type: "checkbox" },
      { name: "is_active", label: "Activo", type: "checkbox" },
    ],
    listColumns: ["code", "customer_type_name"],
  },
  {
    key: "vehicle-types",
    doctype: "WO Vehicle Type",
    label: "Tipos de Vehículo",
    newLabel: "Nuevo Tipo de Vehículo",
    idField: "code",
    fields: [
      { name: "code", label: "Código", type: "text", required: true },
      { name: "vehicle_type_name", label: "Nombre", type: "text", required: true },
      { name: "description", label: "Descripción / Ejemplos", type: "text" },
      { name: "sort_order", label: "Orden", type: "number" },
      { name: "is_active", label: "Activo", type: "checkbox" },
    ],
    listColumns: ["code", "vehicle_type_name", "sort_order"],
  },
  {
    key: "segments",
    doctype: "WO Service Segment",
    label: "Segmentos",
    newLabel: "Nuevo Segmento",
    idField: "code",
    fields: [
      { name: "code", label: "Código", type: "text", required: true },
      { name: "segment_name", label: "Nombre del Segmento", type: "text", required: true },
      { name: "icon", label: "Ícono", type: "text" },
      { name: "is_active", label: "Activo", type: "checkbox" },
    ],
    listColumns: ["code", "segment_name"],
  },
  {
    key: "services",
    doctype: "WO Service Type",
    label: "Tipos de Servicio",
    newLabel: "Nuevo Tipo de Servicio",
    idField: "code",
    fields: [
      { name: "code", label: "Código", type: "text", required: true },
      { name: "service_name", label: "Nombre del Servicio", type: "text", required: true },
      { name: "segment", label: "Segmento", type: "segment-select", required: true },
      { name: "estimated_hours", label: "Horas Estimadas", type: "number" },
      { name: "suggested_price", label: "Precio Sugerido Neto", type: "number" },
      { name: "is_active", label: "Activo", type: "checkbox" },
    ],
    listColumns: ["code", "service_name", "segment"],
  },
  {
    key: "operators",
    doctype: "WO Operator",
    label: "Operarios",
    newLabel: "Nuevo Operario",
    idField: "employee_id",
    fields: [
      { name: "employee_id", label: "Legajo / ID", type: "text", required: true },
      { name: "full_name", label: "Nombre Completo", type: "text", required: true },
      { name: "specialty_segment", label: "Especialidad Principal", type: "segment-select" },
      { name: "phone", label: "Teléfono", type: "text" },
      { name: "is_active", label: "Activo", type: "checkbox" },
    ],
    listColumns: ["employee_id", "full_name", "specialty_segment"],
  },
  {
    // Único catálogo con tabla hija (requirements -> WO Evidence Requirement). Se suma acá solo
    // para reusar listado/sidebar/activar-desactivar genéricos — el alta/edición es bespoke
    // (EvidencePolicyForm), ver branch por catalogKey en new/page.tsx y [rowId]/edit/page.tsx.
    key: "evidence-policies",
    doctype: "WO Evidence Policy",
    label: "Políticas de Evidencia",
    newLabel: "Nueva Política de Evidencia",
    idField: "code",
    fields: [
      { name: "code", label: "Código", type: "text", required: true },
      { name: "policy_name", label: "Nombre", type: "text", required: true },
      { name: "customer_type_id", label: "Tipo de Cliente", type: "text" },
      { name: "is_active", label: "Activo", type: "checkbox" },
    ],
    listColumns: ["code", "policy_name", "customer_type_id"],
  },
];
