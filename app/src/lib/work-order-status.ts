import type { WorkOrderStatus } from "./frappe/work-orders";

// Presentación y agrupaciones de estados de OT. Client-safe (solo `import type`). Calcado de
// STATUS_META / STATUS_GROUPS del MVP (D:\Lab\lamicar-workorders\src\index.ts) — usar esto en
// badges, filtros y KPIs en vez de repetir listas de estados sueltas por la app.

export const STATUS_GROUPS = {
  /** En taller sin terminar: cuentan como "Órdenes activas". */
  ACTIVE: ["Nueva", "En Curso", "Pendiente"],
  /** Valor todavía no facturado (pipeline). */
  PIPELINE: ["Nueva", "En Curso", "Pendiente", "Terminada", "Entregada"],
  /** Entregadas con remito firmado (incluye las ya facturadas). */
  DELIVERED: ["Entregada", "Facturada"],
  /** Estados que se muestran en flujo/kanban (Anulada queda afuera). */
  FLOW: ["Nueva", "En Curso", "Pendiente", "Terminada", "Entregada", "Facturada"],
} as const satisfies Record<string, readonly WorkOrderStatus[]>;

/**
 * Filtros nombrados de /operaciones (?filtro=<clave>). Los usan los indicadores de esa pantalla y
 * los del Dashboard para linkear ya filtrado. Además de estas claves, ?filtro= acepta un estado
 * suelto ("En Curso", "Anulada", ...).
 */
export const OPERATIONS_FILTERS = {
  activas: STATUS_GROUPS.ACTIVE,
  "por-entregar": ["Terminada"],
  "por-facturar": ["Entregada"],
  "no-facturadas": STATUS_GROUPS.PIPELINE,
  entregadas: STATUS_GROUPS.DELIVERED,
  facturadas: ["Facturada"],
} as const satisfies Record<string, readonly WorkOrderStatus[]>;

/** Estados que incluye un valor de ?filtro= (clave nombrada o estado suelto); null = sin filtro. */
export function resolveOperationsFilter(
  key: string | undefined,
  allStatuses: readonly string[]
): readonly string[] | null {
  if (!key) return null;
  if (key in OPERATIONS_FILTERS) return OPERATIONS_FILTERS[key as keyof typeof OPERATIONS_FILTERS];
  return allStatuses.includes(key) ? [key] : null;
}

export function isInGroup(status: string, group: keyof typeof STATUS_GROUPS): boolean {
  return (STATUS_GROUPS[group] as readonly string[]).includes(status);
}

// Colores de badge por estado (claro + oscuro). El texto siempre dice el estado, así que el
// color nunca es el único canal de información.
export const STATUS_BADGE_CLASS: Record<WorkOrderStatus, string> = {
  Nueva: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  "En Curso": "bg-brand text-brand-foreground",
  Pendiente: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  Terminada: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  Entregada: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  Facturada: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  Anulada: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
};
