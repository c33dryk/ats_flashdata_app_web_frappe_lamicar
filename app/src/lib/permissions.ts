import type { AppRole } from "./auth-shared";

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
} satisfies Record<string, AppRole[]>;

export type Capability = keyof typeof CAPABILITY_ROLES;

export function can(role: AppRole | undefined | null, capability: Capability): boolean {
  return !!role && (CAPABILITY_ROLES[capability] as AppRole[]).includes(role);
}

// ── Pantallas (qué ve cada rol en el menú y qué rutas puede abrir) ──────────────
// Calcado del `screenAccess` del MVP. Pendiente de construir: Clientes y Flota (todos).
// "facturador" no ve el taller (Operaciones / Órdenes de Trabajo): factura y abre las OTs desde
// /facturacion, que usa el mismo panel lateral.
const SHOP_ROLES: AppRole[] = ["admin", "recepcion", "tecnico", "auditor"];

export const SCREEN_ACCESS: Array<{ prefix: string; roles: AppRole[] }> = [
  { prefix: "/dashboard", roles: ALL_ROLES },
  { prefix: "/operaciones", roles: SHOP_ROLES },
  { prefix: "/work-orders", roles: SHOP_ROLES },
  { prefix: "/facturacion", roles: ["admin", "facturador", "recepcion", "auditor"] },
  { prefix: "/remitos", roles: ALL_ROLES },
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
