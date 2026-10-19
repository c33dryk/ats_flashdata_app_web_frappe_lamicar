"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { createWorkOrderAction, type CreateWorkOrderState } from "@/app/work-orders/actions";
import { BranchField } from "@/components/work-orders/branch-field";
import { OrderParties } from "@/components/work-orders/order-parties";
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
  canManageBranches = false,
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
  /** Admin: si no hay sucursales, muestra el link para cargarlas. */
  canManageBranches?: boolean;
  /** OT creada: el panel se cierra y avisa (el alta vive en el panel lateral de Operaciones). */
  onCreated: (name: string) => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(createWorkOrderAction, initialState);
  const [segment, setSegment] = useState<string>("");
  // Avisar una sola vez por cada OT creada (state cambia de identidad en cada submit). El modal
  // desmonta el form al cerrarse, así que no hace falta limpiar los campos acá.
  useEffect(() => {
    if (state.createdName) onCreated(state.createdName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const filteredServiceTypes = useMemo(
    () => (segment ? serviceTypes.filter((s) => s.segment === segment) : serviceTypes),
    [serviceTypes, segment]
  );

  return (
    <form action={formAction} className="@container space-y-4">
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <BranchField branches={branches} required canManage={canManageBranches} />

      <div className="grid gap-4 @3xl:grid-cols-2">
        <OrderParties customerTypes={customerTypes} vehicleTypes={vehicleTypes} canViewTaxId={canViewTaxId} />

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
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
