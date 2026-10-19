// Tipos y reglas de clientes y unidades (flota) compartidos entre server y cliente. Client-safe.
//
// Modelo (Frappe): `WO Client` (nombre CLI-#####) y `WO Vehicle` (nombre = patente normalizada).
// La unidad tiene su dueño (`WO Vehicle.client_id`) y la OT su cliente (`Work Order.client_id`):
// no son necesariamente el mismo — en un siniestro el cliente de la OT es la aseguradora y el
// dueño del vehículo es el asegurado.

export interface WoClient {
  name: string; // CLI-00001
  client_name: string;
  customer_type_id?: string;
  tax_id?: string; // CUIT / DNI — sensible: solo para roles con can(role, "viewTaxId")
  phone?: string;
  email?: string;
  address?: string;
  is_active?: 0 | 1;
  modified?: string;
}

export interface WoVehicle {
  name: string; // = license_plate
  license_plate: string;
  client_id?: string;
  vehicle_type_id?: string;
  brand_model?: string;
  year?: string;
  color?: string;
  vin?: string;
  is_active?: 0 | 1;
  modified?: string;
}

/** Patente normalizada: mayúsculas, sin espacios ni guiones ("ab 123-cd" → "AB123CD"). Es el
 *  nombre del registro en WO Vehicle, así la misma patente nunca se duplica por cómo se tipeó. */
export function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** CUIT/DNI solo con dígitos, para comparar/buscar sin guiones ni puntos. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}
