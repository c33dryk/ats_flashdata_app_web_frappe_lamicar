"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getClientAction } from "@/app/clientes/actions";
import { ClientPicker } from "@/components/clients/client-picker";
import { VehiclePicker } from "@/components/clients/vehicle-picker";
import type { WoClient, WoVehicle } from "@/lib/clients-shared";
import type { WoCustomerType, WoVehicleType, WorkOrder } from "@/lib/frappe/work-orders";

// Tarjetas "Cliente" y "Vehículo" del form de OT (alta y edición): cliente y unidad salen de los
// maestros con autocompletar y alta rápida. Envían client_id / vehicle_id (+ siniestro y km);
// el server copia los datos del maestro en la OT (ver lib/frappe/order-parties.ts).

export function OrderParties({
  customerTypes,
  vehicleTypes,
  canViewTaxId,
  initialClient = null,
  initialVehicle = null,
  workOrder,
}: {
  customerTypes: WoCustomerType[];
  vehicleTypes: WoVehicleType[];
  canViewTaxId: boolean;
  initialClient?: WoClient | null;
  initialVehicle?: WoVehicle | null;
  /** En edición: la OT, para mostrar los datos cargados si todavía no está vinculada. */
  workOrder?: WorkOrder;
}) {
  const [client, setClient] = useState<WoClient | null>(initialClient);
  const [vehicle, setVehicle] = useState<WoVehicle | null>(initialVehicle);
  // Dueño de la unidad elegida: se ofrece como cliente de la OT (no se asigna solo — en un
  // siniestro el cliente es la aseguradora, no el dueño).
  const [vehicleOwner, setVehicleOwner] = useState<WoClient | null>(null);

  const customerTypeOptions = useMemo(
    () => customerTypes.map((c) => ({ key: c.name, label: c.customer_type_name })),
    [customerTypes]
  );
  const vehicleTypeOptions = useMemo(
    () => vehicleTypes.map((v) => ({ key: v.name, label: v.vehicle_type_name })),
    [vehicleTypes]
  );

  async function selectVehicle(v: WoVehicle | null) {
    setVehicle(v);
    setVehicleOwner(null);
    if (v?.client_id && v.client_id !== client?.name) {
      const res = await getClientAction(v.client_id);
      if (res.ok) setVehicleOwner(res.data);
    }
  }

  const legacyNote = (text: string) => (
    <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
      {text}
    </p>
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input type="hidden" name="client_id" value={client?.name ?? ""} />
          {workOrder && !workOrder.client_id && !client &&
            legacyNote(`OT sin vincular al maestro. Cargada como: ${workOrder.customer_name}. Buscalo o crealo para vincularla.`)}
          <ClientPicker value={client} onChange={setClient} customerTypes={customerTypeOptions} canViewTaxId={canViewTaxId} />
          {!client && vehicleOwner && (
            <button
              type="button"
              onClick={() => setClient(vehicleOwner)}
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Usar el dueño de la unidad ({vehicleOwner.client_name})
            </button>
          )}
          <div className="space-y-1">
            <Label htmlFor="siniestro">Nº Siniestro</Label>
            <Input id="siniestro" name="siniestro" defaultValue={workOrder?.siniestro} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vehículo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input type="hidden" name="vehicle_id" value={vehicle?.name ?? ""} />
          {workOrder && !workOrder.vehicle_id && !vehicle &&
            legacyNote(
              `OT sin vincular al maestro. Cargada como: ${workOrder.license_plate}${workOrder.vehicle_brand_model ? ` · ${workOrder.vehicle_brand_model}` : ""}. Buscala por patente o creala para vincularla.`
            )}
          <VehiclePicker
            value={vehicle}
            onChange={selectVehicle}
            vehicleTypes={vehicleTypeOptions}
            customerTypes={customerTypeOptions}
            canViewTaxId={canViewTaxId}
            suggestedOwner={client}
          />
          <div className="space-y-1">
            <Label htmlFor="vehicle_mileage">Kilometraje al ingreso</Label>
            <Input id="vehicle_mileage" name="vehicle_mileage" inputMode="numeric" defaultValue={workOrder?.vehicle_mileage} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
