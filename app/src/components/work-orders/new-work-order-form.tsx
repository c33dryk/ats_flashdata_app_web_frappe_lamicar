"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createWorkOrderAction, type CreateWorkOrderState } from "@/app/work-orders/actions";
import type {
  WoCustomerType,
  WoOperator,
  WoServiceSegment,
  WoServiceType,
  WoVehicleType,
} from "@/lib/frappe/work-orders";

const selectClassName = cn(
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30"
);

const initialState: CreateWorkOrderState = { error: null };

export function NewWorkOrderForm({
  customerTypes,
  vehicleTypes,
  serviceSegments,
  serviceTypes,
  operators,
}: {
  customerTypes: WoCustomerType[];
  vehicleTypes: WoVehicleType[];
  serviceSegments: WoServiceSegment[];
  serviceTypes: WoServiceType[];
  operators: WoOperator[];
}) {
  const [state, formAction, pending] = useActionState(createWorkOrderAction, initialState);
  const [segment, setSegment] = useState<string>("");

  const filteredServiceTypes = useMemo(
    () => (segment ? serviceTypes.filter((s) => s.segment === segment) : serviceTypes),
    [serviceTypes, segment]
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="customer_type_id">Tipo de cliente *</Label>
              <select
                id="customer_type_id"
                name="customer_type_id"
                required
                defaultValue=""
                className={selectClassName}
              >
                <option value="" disabled>
                  Seleccionar...
                </option>
                {customerTypes.map((ct) => (
                  <option key={ct.name} value={ct.name}>
                    {ct.customer_type_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="customer_name">Nombre *</Label>
              <Input id="customer_name" name="customer_name" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="customer_phone">Teléfono</Label>
              <Input id="customer_phone" name="customer_phone" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="customer_email">Email</Label>
              <Input id="customer_email" name="customer_email" type="email" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="siniestro">Nº Siniestro</Label>
              <Input id="siniestro" name="siniestro" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vehículo</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="vehicle_type_id">Categoría</Label>
              <select
                id="vehicle_type_id"
                name="vehicle_type_id"
                defaultValue=""
                className={selectClassName}
              >
                <option value="">Sin especificar</option>
                {vehicleTypes.map((vt) => (
                  <option key={vt.name} value={vt.name}>
                    {vt.vehicle_type_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="license_plate">Patente *</Label>
              <Input id="license_plate" name="license_plate" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vehicle_brand_model">Marca / Modelo</Label>
              <Input id="vehicle_brand_model" name="vehicle_brand_model" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vehicle_year">Año</Label>
              <Input id="vehicle_year" name="vehicle_year" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vehicle_color">Color</Label>
              <Input id="vehicle_color" name="vehicle_color" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="vehicle_mileage">Kilometraje</Label>
              <Input id="vehicle_mileage" name="vehicle_mileage" />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Servicio</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
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

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creando..." : "Crear Orden"}
        </Button>
        <Link href="/work-orders" className={buttonVariants({ variant: "outline" })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
