import type {
  WoEvidence,
  WoEvidenceRequirement,
  WorkOrder,
  WorkOrderStatus,
} from "./frappe/work-orders";

// Reglas de evidencia (fotos/archivos de la OT) compartidas entre el server (route de upload) y
// el panel. Client-safe: solo `import type`.
//
// Cada foto se asocia a un requisito de la WO Evidence Policy por su `code`, guardado en el campo
// `zone` de WO Evidence. Si Frappe rechaza ese valor (si `zone` fuera un Select con opciones fijas
// del MVP), el route lo guarda como prefijo "[CODE] " en `notes` — `matchesRequirement` entiende
// las dos formas. Al migrar a Frappe: conviene un Link explícito WO Evidence → requisito.

export const EVIDENCE_LOCKED_STATUSES: WorkOrderStatus[] = ["Facturada", "Anulada"];

/** Tope por archivo: el proxy de Next bufferea hasta 10MB por request (proxyClientMaxBodySize). */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const STAGES: Array<{ key: WoEvidenceRequirement["stage"]; label: string }> = [
  { key: "before", label: "Antes del trabajo" },
  { key: "during", label: "Durante" },
  { key: "after", label: "Después" },
  { key: "delivery", label: "Entrega" },
];

/** Tipo de WO Evidence con el que se guarda una carga hecha desde un requisito de esa etapa. */
export const STAGE_EVIDENCE_TYPE: Record<WoEvidenceRequirement["stage"], WoEvidence["type"]> = {
  before: "photo_before",
  during: "photo_during",
  after: "photo_after",
  delivery: "delivery_note",
};

/** Tipos que se pueden cargar a mano en "Otros archivos". */
export const OTHER_FILE_TYPES: Array<{ value: WoEvidence["type"]; label: string }> = [
  { value: "insurance_auth", label: "Autorización del seguro" },
  { value: "dni", label: "DNI / documentación" },
  { value: "photo_during", label: "Foto adicional" },
];

export const UPLOADABLE_TYPES = new Set<WoEvidence["type"]>([
  "photo_before",
  "photo_during",
  "photo_after",
  "delivery_note",
  "insurance_auth",
  "dni",
]);

export const EVIDENCE_TYPE_LABEL: Record<WoEvidence["type"], string> = {
  photo_before: "Foto antes",
  photo_during: "Foto durante",
  photo_after: "Foto después",
  signature: "Firma de entrega",
  delivery_note: "Remito",
  invoice: "Factura",
  dni: "DNI",
  insurance_auth: "Autorización seguro",
};

const notePrefix = (code: string) => `[${code}]`;

export function matchesRequirement(e: WoEvidence, code: string): boolean {
  return e.zone === code || !!e.notes?.startsWith(notePrefix(code));
}

/** Notas sin el prefijo técnico "[CODE] " (para mostrarlas). */
export function visibleNotes(e: WoEvidence): string | undefined {
  return e.notes?.replace(/^\[[^\]]+\]\s*/, "") || undefined;
}

export function withRequirementPrefix(code: string, notes?: string): string {
  return `${notePrefix(code)} ${notes ?? ""}`.trim();
}

/** Cuántas evidencias cumplen un requisito. La firma de entrega cuenta para los de etapa "delivery". */
export function requirementCount(wo: WorkOrder, req: WoEvidenceRequirement): number {
  const files = (wo.evidence ?? []).filter((e) => matchesRequirement(e, req.code)).length;
  return req.stage === "delivery" && wo.delivery_signed_at ? files + 1 : files;
}

export function isImage(e: Pick<WoEvidence, "url" | "filename">): boolean {
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(e.filename || e.url);
}

/**
 * URL para ver un archivo desde el navegador: los de Frappe ("/private/files/...") pasan por el
 * proxy /api/files; los que ya son URLs públicas absolutas (datos de ejemplo del MVP) van directo.
 */
export const fileHref = (url: string) =>
  /^https?:\/\//i.test(url) ? url : `/api/files?path=${encodeURIComponent(url)}`;
