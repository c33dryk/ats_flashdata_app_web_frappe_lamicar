"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { can, type Capability } from "@/lib/permissions";
import { FrappeApiError } from "@/lib/frappe/client";
import {
  createClient,
  getClient,
  createVehicle,
  getVehicle,
  searchClients,
  searchVehicles,
  updateClient,
  updateVehicle,
} from "@/lib/frappe/clients";
import { digitsOnly, normalizePlate, type WoClient, type WoVehicle } from "@/lib/clients-shared";
import { parseVehicleYear } from "@/lib/format";

// Server Actions de clientes y unidades: las usan los ABM (/clientes, /unidades) y el alta rápida
// desde el form de OT (pickers). Lógica de negocio server-side: permisos, normalización de
// patente, no duplicar CUIT/patente, ocultar CUIT a quien no corresponde.

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function requireAny(...caps: Capability[]) {
  const session = await getSession();
  if (!session) return { session: null, error: "Tu sesión expiró. Volvé a entrar." };
  if (!caps.some((c) => can(session.role, c))) return { session: null, error: "No tenés permiso para esta acción." };
  return { session, error: null };
}

function frappeMessage(err: unknown, fallback: string) {
  if (err instanceof FrappeApiError) {
    const body = err.body as { message?: string; exception?: string } | undefined;
    if (body?.exception?.includes("DuplicateEntryError")) return "Ya existe un registro con ese identificador.";
    return body?.message ?? `${fallback} (${err.status}).`;
  }
  return `${fallback}.`;
}

const hideTaxId = (c: WoClient, show: boolean): WoClient => (show ? c : { ...c, tax_id: undefined });

// ── Clientes ───────────────────────────────────────────────────────────────────

export async function searchClientsAction(q: string): Promise<Result<WoClient[]>> {
  const { session, error } = await requireAny("quickCreateClients", "manageClients", "createOrder");
  if (!session) return { ok: false, error: error! };
  if (q.trim().length < 2) return { ok: true, data: [] };
  try {
    const rows = await searchClients(q);
    return { ok: true, data: rows.map((c) => hideTaxId(c, can(session.role, "viewTaxId"))) };
  } catch (err) {
    return { ok: false, error: frappeMessage(err, "No se pudo buscar clientes") };
  }
}

export async function getClientAction(name: string): Promise<Result<WoClient>> {
  const { session, error } = await requireAny("quickCreateClients", "manageClients", "createOrder");
  if (!session) return { ok: false, error: error! };
  try {
    return { ok: true, data: hideTaxId(await getClient(name), can(session.role, "viewTaxId")) };
  } catch (err) {
    return { ok: false, error: frappeMessage(err, "No se pudo leer el cliente") };
  }
}

export interface ClientInput {
  name?: string; // vacío = alta
  client_name: string;
  customer_type_id?: string;
  tax_id?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export async function saveClientAction(input: ClientInput): Promise<Result<WoClient>> {
  const isNew = !input.name;
  const { session, error } = await requireAny(isNew ? "quickCreateClients" : "manageClients");
  if (!session) return { ok: false, error: error! };

  const client_name = input.client_name?.trim();
  if (!client_name) return { ok: false, error: "El nombre o razón social es obligatorio." };
  if (!input.customer_type_id) return { ok: false, error: "Elegí el tipo de cliente." };

  const payload: Partial<WoClient> = {
    client_name,
    customer_type_id: input.customer_type_id,
    phone: input.phone?.trim() || undefined,
    email: input.email?.trim() || undefined,
    address: input.address?.trim() || undefined,
  };
  // El CUIT solo lo toca quien puede verlo (si no, se pisaría con vacío).
  if (can(session.role, "viewTaxId")) {
    const taxId = input.tax_id?.trim() || "";
    if (taxId) {
      const dupes = (await searchClients(digitsOnly(taxId).slice(-8) || taxId, 20).catch(() => [])).filter(
        (c) => c.name !== input.name && c.tax_id && digitsOnly(c.tax_id) === digitsOnly(taxId)
      );
      if (dupes.length) return { ok: false, error: `Ya existe un cliente con ese CUIT/DNI: ${dupes[0].client_name}.` };
    }
    payload.tax_id = taxId || (isNew ? undefined : "");
  }

  try {
    const saved = isNew ? await createClient({ ...payload, is_active: 1 }) : await updateClient(input.name!, payload);
    revalidatePath("/clientes");
    return { ok: true, data: hideTaxId(saved, can(session.role, "viewTaxId")) };
  } catch (err) {
    return { ok: false, error: frappeMessage(err, "No se pudo guardar el cliente") };
  }
}

export async function setClientActiveAction(name: string, active: boolean): Promise<Result<null>> {
  const { session, error } = await requireAny("manageClients");
  if (!session) return { ok: false, error: error! };
  try {
    await updateClient(name, { is_active: active ? 1 : 0 });
    revalidatePath("/clientes");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: frappeMessage(err, "No se pudo actualizar el cliente") };
  }
}

// ── Unidades ───────────────────────────────────────────────────────────────────

export async function searchVehiclesAction(q: string): Promise<Result<WoVehicle[]>> {
  const { session, error } = await requireAny("quickCreateClients", "manageClients", "createOrder");
  if (!session) return { ok: false, error: error! };
  if (normalizePlate(q).length < 2 && q.trim().length < 3) return { ok: true, data: [] };
  try {
    return { ok: true, data: await searchVehicles(q) };
  } catch (err) {
    return { ok: false, error: frappeMessage(err, "No se pudo buscar unidades") };
  }
}

export interface VehicleInput {
  isNew: boolean;
  license_plate: string;
  client_id?: string;
  vehicle_type_id?: string;
  brand_model?: string;
  year?: string;
  color?: string;
  vin?: string;
}

export async function saveVehicleAction(input: VehicleInput): Promise<Result<WoVehicle>> {
  const { session, error } = await requireAny(input.isNew ? "quickCreateClients" : "manageClients");
  if (!session) return { ok: false, error: error! };

  const plate = normalizePlate(input.license_plate ?? "");
  if (plate.length < 5) return { ok: false, error: "Ingresá una patente válida." };
  const year = parseVehicleYear(input.year);
  if (!year.ok) return { ok: false, error: year.error };

  const payload: Partial<WoVehicle> = {
    license_plate: plate,
    client_id: input.client_id || undefined,
    vehicle_type_id: input.vehicle_type_id || undefined,
    brand_model: input.brand_model?.trim() || undefined,
    year: year.value || undefined,
    color: input.color?.trim() || undefined,
    vin: input.vin?.trim() || undefined,
  };

  try {
    if (input.isNew) {
      const existing = await getVehicle(plate).catch(() => null);
      if (existing) return { ok: false, error: `La patente ${plate} ya está cargada (${existing.brand_model ?? "sin modelo"}).` };
      const saved = await createVehicle({ ...payload, is_active: 1 });
      revalidatePath("/unidades");
      return { ok: true, data: saved };
    }
    // En edición, campos vaciados se limpian ("" en vez de omitirlos).
    const saved = await updateVehicle(plate, {
      client_id: input.client_id ?? "",
      vehicle_type_id: input.vehicle_type_id ?? "",
      brand_model: input.brand_model?.trim() ?? "",
      year: year.value,
      color: input.color?.trim() ?? "",
      vin: input.vin?.trim() ?? "",
    });
    revalidatePath("/unidades");
    return { ok: true, data: saved };
  } catch (err) {
    return { ok: false, error: frappeMessage(err, "No se pudo guardar la unidad") };
  }
}

export async function setVehicleActiveAction(plate: string, active: boolean): Promise<Result<null>> {
  const { session, error } = await requireAny("manageClients");
  if (!session) return { ok: false, error: error! };
  try {
    await updateVehicle(plate, { is_active: active ? 1 : 0 });
    revalidatePath("/unidades");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: frappeMessage(err, "No se pudo actualizar la unidad") };
  }
}
