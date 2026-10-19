import { getClient, getVehicle } from "./clients";
import type { WorkOrder } from "./work-orders";

// Vincula una OT con su cliente y/o su unidad de los maestros (WO Client / WO Vehicle) y copia
// sus datos en la OT como foto del momento: si después cambia el teléfono del cliente o el color
// del auto, la OT conserva lo de ese día. Lo usan el alta (exige ambos) y la edición (vincula lo
// que se elija; lo no elegido queda como estaba). Server-side.
//
// Migración a Frappe: es lo que hace `fetch_from` en los campos de la OT (customer_name ←
// client_id.client_name, etc.), más la validación en el controller.

export async function resolveOrderParties({
  clientId,
  vehicleId,
}: {
  clientId?: string;
  vehicleId?: string;
}): Promise<{ ok: true; data: Partial<WorkOrder> } | { ok: false; error: string }> {
  const data: Partial<WorkOrder> = {};

  if (clientId) {
    const client = await getClient(clientId).catch(() => null);
    if (!client) return { ok: false, error: "No se encontró el cliente elegido. Volvé a buscarlo." };
    if (!client.customer_type_id) {
      return { ok: false, error: `El cliente ${client.client_name} no tiene tipo de cliente: completalo en Clientes.` };
    }
    Object.assign(data, {
      client_id: client.name,
      customer_type_id: client.customer_type_id,
      customer_name: client.client_name,
      customer_phone: client.phone ?? "",
      customer_email: client.email ?? "",
    });
  }

  if (vehicleId) {
    const vehicle = await getVehicle(vehicleId).catch(() => null);
    if (!vehicle) return { ok: false, error: "No se encontró la unidad elegida. Volvé a buscarla." };
    Object.assign(data, {
      vehicle_id: vehicle.name,
      vehicle_type_id: vehicle.vehicle_type_id ?? "",
      license_plate: vehicle.license_plate,
      vehicle_brand_model: vehicle.brand_model ?? "",
      vehicle_year: vehicle.year ?? "",
      vehicle_color: vehicle.color ?? "",
    });
  }

  return { ok: true, data };
}
