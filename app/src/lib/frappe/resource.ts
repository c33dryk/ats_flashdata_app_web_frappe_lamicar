import { frappeFetch } from "./client";

// Helpers genéricos sobre /api/resource/<doctype> y /api/method/<...>. Este es el punto de
// extensión del template: cada proyecto de cliente agrega acá (o en archivos hermanos) los
// doctypes propios de su Frappe, en vez de escribir fetch() sueltos por toda la app.

export type FrappeFilters = Array<[string, string, unknown]>;

export interface GetListOptions {
  fields?: string[];
  filters?: FrappeFilters;
  limit?: number;
  orderBy?: string;
}

interface FrappeListResponse<T> {
  data: T[];
}

interface FrappeDocResponse<T> {
  data: T;
}

export async function getList<T = Record<string, unknown>>(
  doctype: string,
  options: GetListOptions = {}
): Promise<T[]> {
  const params = new URLSearchParams();
  if (options.fields) params.set("fields", JSON.stringify(options.fields));
  if (options.filters) params.set("filters", JSON.stringify(options.filters));
  // Sin limit, Frappe devuelve solo 20 filas. limit: 0 = sin tope (todas).
  if (options.limit !== undefined) params.set("limit_page_length", String(options.limit));
  if (options.orderBy) params.set("order_by", options.orderBy);

  const query = params.toString();
  const res = await frappeFetch<FrappeListResponse<T>>(
    `/api/resource/${encodeURIComponent(doctype)}${query ? `?${query}` : ""}`
  );
  return res.data;
}

export async function getDoc<T = Record<string, unknown>>(doctype: string, name: string): Promise<T> {
  const res = await frappeFetch<FrappeDocResponse<T>>(
    `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`
  );
  return res.data;
}

export async function createDoc<T = Record<string, unknown>>(
  doctype: string,
  data: Record<string, unknown>
): Promise<T> {
  const res = await frappeFetch<FrappeDocResponse<T>>(`/api/resource/${encodeURIComponent(doctype)}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateDoc<T = Record<string, unknown>>(
  doctype: string,
  name: string,
  data: Record<string, unknown>
): Promise<T> {
  const res = await frappeFetch<FrappeDocResponse<T>>(
    `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
  return res.data;
}

export async function deleteDoc(doctype: string, name: string): Promise<void> {
  await frappeFetch(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

// Para whitelisted methods de Frappe (`@frappe.whitelist()`), ej. "frappe.client.get_count".
export async function callMethod<T = unknown>(
  dottedPath: string,
  params?: Record<string, unknown>
): Promise<T> {
  const query = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : "";
  return frappeFetch<T>(`/api/method/${dottedPath}${query}`);
}
