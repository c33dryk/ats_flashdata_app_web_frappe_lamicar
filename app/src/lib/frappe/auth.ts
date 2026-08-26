import type { AppRole } from "@/lib/auth-shared";
import { getDoc } from "./resource";

function getBaseUrl(): string {
  const url = process.env.FRAPPE_URL;
  if (!url) throw new Error("FRAPPE_URL no configurado (ver .env en la raíz del repo)");
  return url.replace(/\/$/, "");
}

interface FrappeLoginResult {
  ok: boolean;
  fullName?: string;
}

// Única llamada a Frappe que usa credenciales del usuario final (no el service account de
// client.ts) — valida usuario/clave contra el login nativo de Frappe. No conservamos el `sid`
// que devuelve: la sesión de la app queda a cargo de `lib/auth.ts` (cookie propia).
export async function loginToFrappe(usr: string, pwd: string): Promise<FrappeLoginResult> {
  const res = await fetch(`${getBaseUrl()}/api/method/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ usr, pwd }).toString(),
  });

  if (!res.ok) return { ok: false };

  const body = (await res.json().catch(() => ({}))) as { full_name?: string };
  return { ok: true, fullName: body.full_name };
}

interface FrappeUser {
  roles?: Array<{ role: string }>;
}

// Mapeo Roles de Frappe -> AppRole del proyecto Lamicar. Un usuario puede tener varios roles de
// Frappe asignados; si tiene más de uno de los 5 propios de este proyecto, gana el de mayor
// privilegio según FRAPPE_ROLE_PRIORITY. Sin ninguno de los 5, cae a "auditor" (el de menor
// privilegio) en vez de romper — evita dejar afuera a un usuario mal configurado en Frappe.
//
// Usa GET /api/resource/User/<email> (campo child table `roles`) en vez de listar el doctype
// "Has Role" directo: Frappe deniega check_select_permission sobre child tables aunque tengan un
// Custom DocPerm propio. El service account necesita permiso Read sobre "User" — en Frappe, el
// campo `roles` de User vive en permlevel 1, así que además del Read en permlevel 0 hace falta un
// segundo Custom DocPerm en permlevel 1 para ese rol, o el campo vuelve vacío en la respuesta.
const FRAPPE_ROLE_PRIORITY: Array<[string, AppRole]> = [
  ["WO Admin", "admin"],
  ["WO Recepcion", "recepcion"],
  ["WO Tecnico", "tecnico"],
  ["WO Facturador", "facturador"],
  ["WO Auditor", "auditor"],
];

export async function getAppRoleForUser(userEmail: string): Promise<AppRole> {
  const user = await getDoc<FrappeUser>("User", userEmail);
  const roles = new Set((user.roles ?? []).map((r) => r.role));
  for (const [frappeRole, appRole] of FRAPPE_ROLE_PRIORITY) {
    if (roles.has(frappeRole)) return appRole;
  }
  return "auditor";
}
