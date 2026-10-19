"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { updateWorkOrderAction, type EditWorkOrderState } from "@/app/work-orders/[id]/edit/actions";
import { BranchField } from "@/components/work-orders/branch-field";
import { OrderParties } from "@/components/work-orders/order-parties";
import type { WoClient, WoVehicle } from "@/lib/clients-shared";
import type {
  WoCustomerType,
  WoBranch,
  WoOperator,
  WoServiceSegment,
  WoServiceType,
  WoVehicleType,
  WorkOrder,
  WorkOrderItem,
} from "@/lib/frappe/work-orders";

const selectClassName = nativeSelectClassName;

const moneyFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const initialState: EditWorkOrderState = { error: null, success: false };

export function EditWorkOrderForm({
  workOrder,
  customerTypes,
  vehicleTypes,
  serviceSegments,
  serviceTypes,
  operators,
  branches = [],
  canViewTaxId = false,
  initialClient = null,
  initialVehicle = null,
  onSaved,
  onCancel,
}: {
  workOrder: WorkOrder;
  customerTypes: WoCustomerType[];
  vehicleTypes: WoVehicleType[];
  serviceSegments: WoServiceSegment[];
  serviceTypes: WoServiceType[];
  operators: WoOperator[];
  branches?: WoBranch[];
  canViewTaxId?: boolean;
  /** Cliente / unidad vinculados (si la OT ya está vinculada a los maestros). */
  initialClient?: WoClient | null;
  initialVehicle?: WoVehicle | null;
  /** En el panel lateral: al guardar / cancelar vuelve a la vista de la OT en vez de navegar. */
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateWorkOrderAction, initialState);
  const [segment, setSegment] = useState<string>(workOrder.service_segment_id ?? "");
  const [items, setItems] = useState<WorkOrderItem[]>(workOrder.items ?? []);

  useEffect(() => {
    if (!state.success) return;
    if (onSaved) onSaved();
    else router.push(`/work-orders/${workOrder.name}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const filteredServiceTypes = useMemo(
    () => (segment ? serviceTypes.filter((s) => s.segment === segment) : serviceTypes),
    [serviceTypes, segment]
  );

  const total = items.reduce((acc, it) => acc + (it.quantity || 0) * (it.unit_price_net || 0), 0);

  function updateItem(index: number, patch: Partial<WorkOrderItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: 1, unit_price_net: 0 }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(formData: FormData) {
    formData.set("items_json", JSON.stringify(items));
    formAction(formData);
  }

  return (
    <form action={handleSubmit} className="@container space-y-4">
      <input type="hidden" name="order_id" value={workOrder.name} />
      <input type="hidden" name="expected_modified" value={workOrder.modified ?? ""} />

      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <BranchField branches={branches} required={false} defaultValue={workOrder.branch_id ?? ""} />

      <div className="grid gap-4 @3xl:grid-cols-2">
        <OrderParties
          customerTypes={customerTypes}
          vehicleTypes={vehicleTypes}
          canViewTaxId={canViewTaxId}
          initialClient={initialClient}
          initialVehicle={initialVehicle}
          workOrder={workOrder}
        />

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
              <select
                id="service_type_id"
                name="service_type_id"
                defaultValue={workOrder.service_type_id ?? ""}
                className={selectClassName}
              >
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
                defaultValue={workOrder.assigned_operator_id ?? ""}
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
              <Textarea id="description" name="description" rows={4} defaultValue={workOrder.description} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ítems</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Precio unitario</TableHead>
                  <TableHead>Subtotal</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(i, { description: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        className="w-20"
                        value={item.quantity}
                        onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-28"
                        value={item.unit_price_net}
                        onChange={(e) => updateItem(i, { unit_price_net: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>{moneyFmt.format((item.quantity || 0) * (item.unit_price_net || 0))}</TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(i)}>
                        Quitar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              Agregar ítem
            </Button>
            <p className="text-sm font-medium">Total neto: {moneyFmt.format(total)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 flex items-center gap-2 border-t border-border bg-card py-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Guardar cambios"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
        ) : (
          <Link href={`/work-orders/${workOrder.name}`} className={buttonVariants({ variant: "outline" })}>
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}
