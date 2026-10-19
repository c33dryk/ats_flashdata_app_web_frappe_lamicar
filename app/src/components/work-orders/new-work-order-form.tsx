"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { createWorkOrderAction, type CreateWorkOrderState } from "@/app/work-orders/actions";
import { getClientAction } from "@/app/clientes/actions";
import { ClientPicker } from "@/components/clients/client-picker";
import { VehiclePicker } from "@/components/clients/vehicle-picker";
import type { WoClient, WoVehicle } from "@/lib/clients-shared";
import type {
  WoBranch,
  WoCustomerType,
  WoOperator,
  WoServiceSegment,
  WoServiceType,
  WoVehicleType,
} from "@/lib/frappe/work-orders";

const selectClassName = nativeSelectClassName;

const initialState: CreateWorkOrderState = { error: null };

export function NewWorkOrderForm({
  customerTypes,
  vehicleTypes,
  serviceSegments,
  serviceTypes,
  operators,
  branches = [],
  canViewTaxId = false,
  onCreated,
  onCancel,
}: {
  customerTypes: WoCustomerType[];
  vehicleTypes: WoVehicleType[];
  serviceSegments: WoServiceSegment[];
  serviceTypes: WoServiceType[];
  operators: WoOperator[];
  /** Sucursales activas: si hay al menos una, elegir sucursal es obligatorio. */
  branches?: WoBranch[];
  /** Mostrar/editar CUIT-DNI en el alta rápida de cliente (can(role, "viewTaxId")). */
  canViewTaxId?: boolean;
  /** Si se pasa, el form se queda en la pantalla (modal) y avisa la OT creada en vez de navegar. */
  onCreated?: (name: string) => void;
  /** Si se pasa, "Cancelar" llama esto (cerrar modal) en vez de volver a /work-orders. */
  onCancel?: () => void;
}) {
  const [state, formAction, pending] = useActionState(createWorkOrderAction, initialState);
  const [segment, setSegment] = useState<string>("");
  const [client, setClient] = useState<WoClient | null>(null);
  const [vehicle, setVehicle] = useState<WoVehicle | null>(null);
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

  // Avisar una sola vez por cada OT creada (state cambia de identidad en cada submit). El modal
  // desmonta el form al cerrarse, así que no hace falta limpiar los campos acá.
  useEffect(() => {
    if (state.createdName && onCreated) onCreated(state.createdName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const filteredServiceTypes = useMemo(
    () => (segment ? serviceTypes.filter((s) => s.segment === segment) : serviceTypes),
    [serviceTypes, segment]
  );

  return (
    <form action={formAction} className="@container space-y-4">
      {onCreated && <input type="hidden" name="stay" value="1" />}
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 @3xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input type="hidden" name="client_id" value={client?.name ?? ""} />
            <ClientPicker
              value={client}
              onChange={setClient}
              customerTypes={customerTypeOptions}
              canViewTaxId={canViewTaxId}
            />
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
              <Input id="siniestro" name="siniestro" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vehículo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input type="hidden" name="vehicle_id" value={vehicle?.name ?? ""} />
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
              <Input id="vehicle_mileage" name="vehicle_mileage" inputMode="numeric" />
            </div>
          </CardContent>
        </Card>

        <Card className="@3xl:col-span-2">
          <CardHeader>
            <CardTitle>Servicio</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="service_segment_id">Segmento</Label>
              <select
                id="service_segment_id"
                name="service_segment_id"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className={selectClassName}
              >
                <option value="">Sin especificar</option>
                {serviceSegments.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.segment_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="service_type_id">Tipo de servicio</Label>
              <select id="service_type_id" name="service_type_id" defaultValue="" className={selectClassName}>
                <option value="">Sin especificar</option>
                {filteredServiceTypes.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.service_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="assigned_operator_id">Operario asignado</Label>
              <select
                id="assigned_operator_id"
                name="assigned_operator_id"
                defaultValue=""
                className={selectClassName}
              >
                <option value="">Sin asignar</option>
                {operators.map((op) => (
                  <option key={op.name} value={op.name}>
                    {op.full_name}
                  </option>
                ))}
              </select>
            </div>
            {branches.length > 0 && (
              <div className="space-y-1">
                <Label htmlFor="branch_id">Sucursal{true ? " *" : ""}</Label>
                <select
                  id="branch_id"
                  name="branch_id"
                  defaultValue=""
                  required={true}
                  className={selectClassName}
                >
                  <option value="">{true ? "Elegí una sucursal" : "Sin sucursal"}</option>
                  {branches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.branch_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="col-span-2 space-y-1">
              <Label htmlFor="description">Descripción del trabajo</Label>
              <Textarea id="description" name="description" rows={4} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-0 flex items-center gap-2 border-t border-border bg-card py-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creando..." : "Crear Orden"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
        ) : (
          <Link href="/work-orders" className={buttonVariants({ variant: "outline" })}>
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}
