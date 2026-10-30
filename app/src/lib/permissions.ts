import type { AppRole } from "./auth-shared";
import { STATUS_GROUPS } from "./work-order-status";

// Fuente única de permisos por rol (RBAC) de la app. Client-safe (sin imports de servidor): lo
// usan el sidebar (cliente), proxy.ts, las páginas y las Server Actions. Calcado de los helpers
// `can*` y `screenAccess` del MVP de referencia (D:\Lab\lamicar-workorders\app\page.tsx).
//
// Migración a Frappe: cada capacidad mapea a un permiso de DocType/Role ("WO Recepcion" puede
// crear "Work Order", etc.) y SCREEN_ACCESS a qué Workspace/página ve cada Role. Las transiciones
// de estado tienen su propio mapa (`COMMAND_ROLES` en lib/frappe/work-orders.ts).

const ALL_ROLES: AppRole[] = ["admin", "recepcion", "tecnico", "facturador", "auditor"];

// ── Capacidades (acciones) ──────────────────────────────────────────────────────
export const CAPABILITY_ROLES = {
  createOrder: ["admin", "recepcion"],
  editOrder: ["admin", "recepcion", "tecnico"],
  uploadEvidence: ["admin", "recepcion", "tecnico"],
  manageCatalogs: ["admin"],
  /** Descargar el expediente ZIP (fotos, firma, factura) de una o varias OTs. */
  exportDossier: ["admin", "facturador", "auditor"],
  /** ABM de clientes y unidades (pantallas /clientes y /unidades). */
  manageClients: ["admin", "recepcion", "facturador"],
  /** Alta rápida de cliente/unidad desde el form de OT (= quien puede crear OTs, + ABM). */
  quickCreateClients: ["admin", "recepcion", "facturador"],
  /** Ver importes (total neto, precios de ítems, factura). El técnico no los ve en ningún lado:
   *  el server los quita de los datos antes de mandarlos (lib/work-order-visibility.ts). */
  viewAmounts: ["admin", "recepcion", "facturador", "auditor"],
  /** Ver CUIT/DNI del cliente (en Frappe es permlevel 1: Admin, Recepción, Facturador). */
  viewTaxId: ["admin", "recepcion", "facturador"],
} satisfies Record<string, AppRole[]>;

export type Capability = keyof typeof CAPABILITY_ROLES;

export function can(role: AppRole | undefined | null, capability: Capability): boolean {
  return !!role && (CAPABILITY_ROLES[capability] as AppRole[]).includes(role);
}

// ── Pantallas (qué ve cada rol en el menú y qué rutas puede abrir) ──────────────
// Calcado del `screenAccess` del MVP, ajustado con Lamicar: Facturación y Remitos son del área
// administrativa (todos menos el técnico); Clientes/Unidades, de quien da de alta y factura.
// "facturador" no ve el taller (Operaciones / Órdenes de Trabajo): factura y abre las OTs desde
// /facturacion, que usa el mismo panel lateral.
const SHOP_ROLES: AppRole[] = ["admin", "recepcion", "tecnico", "auditor"];

export const SCREEN_ACCESS: Array<{ prefix: string; roles: AppRole[] }> = [
  { prefix: "/dashboard", roles: ALL_ROLES },
  { prefix: "/operaciones", roles: SHOP_ROLES },
  { prefix: "/work-orders", roles: SHOP_ROLES },
  { prefix: "/facturacion", roles: ["admin", "facturador", "recepcion", "auditor"] },
  { prefix: "/remitos", roles: ["admin", "facturador", "recepcion", "auditor"] },
  { prefix: "/clientes", roles: ["admin", "recepcion", "facturador"] },
  { prefix: "/unidades", roles: ["admin", "recepcion", "facturador"] },
  { prefix: "/admin", roles: ["admin"] },
];

/** true si el rol puede abrir la ruta. Rutas no listadas en SCREEN_ACCESS quedan abiertas a
 *  cualquier usuario con sesión (el proxy ya exige sesión para todo lo no público). */
export function canAccessPath(role: AppRole, pathname: string): boolean {
  const rule = SCREEN_ACCESS.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)
  );
  return !rule || rule.roles.includes(role);
}

// ── Dashboard (qué vistas ve cada rol; la primera es la de entrada) ─────────────
// Cada rol entra a "su" tablero con lo que necesita para trabajar; el admin ve todos (incluidos
// los de cada rol, para revisarlos). El técnico no ve montos ni la vista de Gestión.
// Migración a Frappe: cada vista es un Workspace (o Dashboard) asignado a su Role.
export type DashboardView = "operativo" | "gestion" | "recepcion" | "taller" | "facturacion";

export const DASHBOARD_VIEWS: Record<AppRole, DashboardView[]> = {
  admin: ["operativo", "gestion", "recepcion", "taller", "facturacion"],
  recepcion: ["recepcion", "operativo"],
  tecnico: ["taller"],
  facturador: ["facturacion", "gestion"],
  auditor: ["operativo", "gestion"],
};

// ── Estados de OT visibles por rol ──────────────────────────────────────────────
// Roles no listados ven todos los estados. El técnico solo ve el circuito de taller: una OT
// entregada, facturada o anulada desaparece de sus listas y no la puede abrir.
// Migración a Frappe: User Permission / permission_query_conditions sobre Work Order.status.
export const ROLE_VISIBLE_STATUSES: Partial<Record<AppRole, readonly string[]>> = {
  tecnico: STATUS_GROUPS.WORKSHOP,
};

/** Estados que ve el rol, o null si los ve todos. */
export function visibleStatuses(role: AppRole): readonly string[] | null {
  return ROLE_VISIBLE_STATUSES[role] ?? null;
}

export function canSeeStatus(role: AppRole, status: string): boolean {
  const allowed = visibleStatuses(role);
  return !allowed || allowed.includes(status);
}
