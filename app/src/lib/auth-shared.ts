// Tipos y constantes de auth sin dependencias de servidor (node:crypto, next/headers) —
// esto es lo único de auth que un componente cliente puede importar sin romper el build.
//
// AppRole es un placeholder mínimo: cada proyecto de cliente que parta de este template debe
// ajustar los roles reales acá y en `lib/frappe/auth.ts` (mapFrappeRoleToAppRole).
export type AppRole = "admin" | "member";

export interface SessionPayload {
  userId: string;
  name: string;
  role: AppRole;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  member: "Miembro",
};
