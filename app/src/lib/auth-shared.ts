// Tipos y constantes de auth sin dependencias de servidor (node:crypto, next/headers) —
// esto es lo único de auth que un componente cliente puede importar sin romper el build.
//
// Roles reales del proyecto Lamicar (taller), calcados de los 5 Roles de Frappe ya creados en
// hub.lamicar.app: WO Admin, WO Recepcion, WO Tecnico, WO Facturador, WO Auditor.
export type AppRole = "admin" | "recepcion" | "tecnico" | "facturador" | "auditor";

export interface SessionPayload {
  userId: string;
  name: string;
  role: AppRole;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  recepcion: "Recepción",
  tecnico: "Técnico",
  facturador: "Facturador",
  auditor: "Auditor",
};
