import type { DashboardWorkOrder } from "./frappe/work-orders";
import { STATUS_GROUPS, isInGroup } from "./work-order-status";

// Lógica de negocio del dashboard: funciones puras sobre las filas de getDashboardWorkOrders().
// Client-safe (la vista de Gestión las corre en el navegador al cambiar filtros).
//
// Migración a Frappe: cada función de acá es una consulta agregada (COUNT/SUM + GROUP BY) — van a
// un whitelisted method o a un Script/Query Report, y la UI pasa a pedir los totales ya
// calculados en vez de todas las filas.

/** Opción de catálogo ya resuelta a etiqueta (para filtros, tablas y desgloses). */
export interface CatalogOption {
  key: string;
  label: string;
  sublabel?: string;
  parent?: string; // servicios: segmento al que pertenecen
}

export interface DashboardCatalogs {
  operators: CatalogOption[];
  segments: CatalogOption[];
  services: CatalogOption[];
  customerTypes: CatalogOption[];
  vehicleTypes: CatalogOption[];
}

/** Etiqueta de `key` en una lista de opciones, o undefined si no está (ej. registro inactivo). */
export function labelOf(list: CatalogOption[], key?: string): string | undefined {
  return (key && list.find((x) => x.key === key)?.label) || undefined;
}

/** Valor monetario de una OT: neto de sus ítems (igual que el MVP). */
export function orderValue(wo: DashboardWorkOrder): number {
  return wo.total_net || 0;
}

/** Monto facturado: el de la factura si se cargó, si no el neto de la OT. */
export function invoicedValue(wo: DashboardWorkOrder): number {
  return wo.invoice_amount || wo.total_net || 0;
}

// ── Dashboard operativo ─────────────────────────────────────────────────────────

export function computeOperationalStats(rows: DashboardWorkOrder[]) {
  const countBy = (status: string) => rows.filter((w) => w.status === status).length;
  const invoiced = rows.filter((w) => w.status === "Facturada");
  return {
    total: rows.length,
    active: rows.filter((w) => isInGroup(w.status, "ACTIVE")).length,
    inProgress: countBy("En Curso"),
    pending: countBy("Pendiente"),
    invoicedCount: invoiced.length,
    invoicedAmount: invoiced.reduce((acc, w) => acc + invoicedValue(w), 0),
    pipelineValue: rows
      .filter((w) => isInGroup(w.status, "PIPELINE"))
      .reduce((acc, w) => acc + orderValue(w), 0),
    deliveredCount: rows.filter((w) => isInGroup(w.status, "DELIVERED")).length,
    byStatus: STATUS_GROUPS.FLOW.map((status) => ({ status, count: countBy(status) })),
  };
}

// ── Dashboard de gestión ────────────────────────────────────────────────────────

export type Metric = "revenue" | "count";
export type Granularity = "day" | "month" | "year";

/** "" = sin filtro en esa dimensión. */
export interface DashboardFilters {
  operator: string;
  segment: string;
  service: string;
  customerType: string;
  vehicleType: string;
  status: string;
}

export const EMPTY_FILTERS: DashboardFilters = {
  operator: "",
  segment: "",
  service: "",
  customerType: "",
  vehicleType: "",
  status: "",
};

/** Las anuladas nunca suman a la muestra de gestión (no son trabajo ni facturación real). */
export function applyFilters(rows: DashboardWorkOrder[], f: DashboardFilters) {
  return rows.filter(
    (w) =>
      w.status !== "Anulada" &&
      (!f.operator || w.assigned_operator_id === f.operator) &&
      (!f.segment || w.service_segment_id === f.segment) &&
      (!f.service || w.service_type_id === f.service) &&
      (!f.customerType || w.customer_type_id === f.customerType) &&
      (!f.vehicleType || w.vehicle_type_id === f.vehicleType) &&
      (!f.status || w.status === f.status)
  );
}

export interface TimeBucket {
  key: string; // prefijo de fecha: "YYYY-MM-DD" | "YYYY-MM" | "YYYY"
  label: string;
  revenue: number;
  count: number;
}

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const BUCKET_COUNT: Record<Granularity, number> = { day: 14, month: 12, year: 5 };

/**
 * Agrupa por fecha de alta de la OT (`creation`) en los últimos N períodos que terminan en
 * `todayISO` ("YYYY-MM-DD", calculado en el server con la zona horaria del taller para que server
 * y navegador coincidan). Compara por prefijo de string: `creation` viene de Frappe como
 * "YYYY-MM-DD HH:MM:SS" en hora del sitio, sin conversión de zona.
 */
export function buildTimeBuckets(
  rows: DashboardWorkOrder[],
  granularity: Granularity,
  todayISO: string
): TimeBucket[] {
  const [y, m, d] = todayISO.split("-").map(Number);
  const n = BUCKET_COUNT[granularity];
  const pad = (v: number) => String(v).padStart(2, "0");

  const keys: Array<{ key: string; label: string }> = [];
  for (let i = n - 1; i >= 0; i--) {
    if (granularity === "day") {
      const dt = new Date(Date.UTC(y, m - 1, d - i));
      const key = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
      keys.push({ key, label: `${pad(dt.getUTCDate())}/${pad(dt.getUTCMonth() + 1)}` });
    } else if (granularity === "month") {
      const dt = new Date(Date.UTC(y, m - 1 - i, 1));
      const key = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}`;
      keys.push({ key, label: `${MONTHS[dt.getUTCMonth()]} ${String(dt.getUTCFullYear()).slice(2)}` });
    } else {
      keys.push({ key: String(y - i), label: String(y - i) });
    }
  }

  return keys.map(({ key, label }) => {
    const orders = rows.filter((w) => (w.creation ?? "").startsWith(key));
    return {
      key,
      label,
      count: orders.length,
      revenue: orders.reduce((acc, w) => acc + orderValue(w), 0),
    };
  });
}

export interface BreakdownRow {
  key: string;
  label: string;
  sublabel?: string;
  count: number;
  revenue: number;
  avgTicket: number;
  share: number; // 0..100, sobre la facturación de la muestra
}

/**
 * Desglose de la muestra por una dimensión. Las OTs sin valor en esa dimensión (ej. sin técnico
 * asignado) van a una fila "Sin asignar" para que la participación sume 100%.
 */
export function buildBreakdown(
  rows: DashboardWorkOrder[],
  getKey: (w: DashboardWorkOrder) => string | undefined,
  dimensions: Array<{ key: string; label: string; sublabel?: string }>
): BreakdownRow[] {
  const total = rows.reduce((acc, w) => acc + orderValue(w), 0);
  const known = new Set(dimensions.map((d) => d.key));
  const toRow = (key: string, label: string, orders: DashboardWorkOrder[], sublabel?: string) => {
    const revenue = orders.reduce((acc, w) => acc + orderValue(w), 0);
    return {
      key,
      label,
      sublabel,
      count: orders.length,
      revenue,
      avgTicket: orders.length ? revenue / orders.length : 0,
      share: total > 0 ? (revenue / total) * 100 : 0,
    };
  };

  const result = dimensions.map((d) =>
    toRow(d.key, d.label, rows.filter((w) => getKey(w) === d.key), d.sublabel)
  );
  const unassigned = rows.filter((w) => {
    const k = getKey(w);
    return !k || !known.has(k);
  });
  if (unassigned.length) result.push(toRow("__none__", "Sin asignar", unassigned));
  return result;
}
