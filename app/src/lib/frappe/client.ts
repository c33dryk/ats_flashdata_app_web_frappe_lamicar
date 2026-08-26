// Cliente base para hablar con Frappe Cloud vía su REST API estándar, autenticado con el
// service account (API key + secret) — no con la sesión del usuario final. Ver `auth.ts` para
// el único caso que usa credenciales de usuario (login).
export class FrappeApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "FrappeApiError";
  }
}

function getBaseUrl(): string {
  const url = process.env.FRAPPE_URL;
  if (!url) throw new Error("FRAPPE_URL no configurado (ver .env en la raíz del repo)");
  return url.replace(/\/$/, "");
}

function authHeader(): string {
  const key = process.env.FRAPPE_API_KEY;
  const secret = process.env.FRAPPE_API_SECRET;
  if (!key || !secret) {
    throw new Error("FRAPPE_API_KEY / FRAPPE_API_SECRET no configurados (ver .env en la raíz del repo)");
  }
  return `token ${key}:${secret}`;
}

// Wrapper de fetch contra la API de Frappe usando el service account. `path` es relativo
// (ej. "/api/resource/User" o "/api/method/frappe.client.get_count").
export async function frappeFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    throw new FrappeApiError(`Frappe API error ${res.status} en ${path}`, res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
