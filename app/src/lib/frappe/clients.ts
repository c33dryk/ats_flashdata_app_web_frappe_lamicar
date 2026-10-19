import { createDoc, getDoc, getList, updateDoc } from "./resource";
import { normalizePlate, type WoClient, type WoVehicle } from "@/lib/clients-shared";

// Acceso a `WO Client` y `WO Vehicle` (maestros de clientes y flota). Al migrar a Frappe esto ya
// es nativo: son DocTypes con Link desde Work Order.

const CLIENT_FIELDS = ["name", "client_name", "customer_type_id", "tax_id", "phone", "email", "address", "is_active", "modified"];
const VEHICLE_FIELDS = ["name", "license_plate", "client_id", "vehicle_type_id", "brand_model", "year", "color", "vin", "is_active", "modified"];

export function getClients() {
  return getList<WoClient>("WO Client", { fields: CLIENT_FIELDS, limit: 0, orderBy: "client_name asc" });
}

/** Búsqueda para el autocompletar: por nombre o CUIT/DNI, solo activos. */
export function searchClients(q: string, limit = 10) {
  const like = `%${q.trim()}%`;
  return getList<WoClient>("WO Client", {
    fields: CLIENT_FIELDS,
    filters: [["is_active", "=", 1]],
    orFilters: [
      ["client_name", "like", like],
      ["tax_id", "like", like],
      ["phone", "like", like],
    ],
    limit,
    orderBy: "client_name asc",
  });
}

export function getClient(name: string) {
  return getDoc<WoClient>("WO Client", name);
}

export function createClient(data: Partial<WoClient>) {
  return createDoc<WoClient>("WO Client", data);
}

export function updateClient(name: string, data: Partial<WoClient>) {
  return updateDoc<WoClient>("WO Client", name, data);
}

export function getVehicles() {
  return getList<WoVehicle>("WO Vehicle", { fields: VEHICLE_FIELDS, limit: 0, orderBy: "modified desc" });
}

/** Búsqueda por patente (normalizada) o marca/modelo, solo activas. */
export function searchVehicles(q: string, limit = 10) {
  const plate = normalizePlate(q);
  return getList<WoVehicle>("WO Vehicle", {
    fields: VEHICLE_FIELDS,
    filters: [["is_active", "=", 1]],
    orFilters: [
      ...(plate ? [["license_plate", "like", `%${plate}%`] as [string, string, unknown]] : []),
      ["brand_model", "like", `%${q.trim()}%`],
    ],
    limit,
    orderBy: "modified desc",
  });
}

export function getVehicle(plate: string) {
  return getDoc<WoVehicle>("WO Vehicle", normalizePlate(plate));
}

export function createVehicle(data: Partial<WoVehicle>) {
  return createDoc<WoVehicle>("WO Vehicle", { ...data, license_plate: normalizePlate(data.license_plate ?? "") });
}

export function updateVehicle(plate: string, data: Partial<WoVehicle>) {
  // La patente es el nombre del registro: no se cambia por update (sería un rename en Frappe).
  const rest = { ...data };
  delete rest.license_plate;
  return updateDoc<WoVehicle>("WO Vehicle", normalizePlate(plate), rest);
}
