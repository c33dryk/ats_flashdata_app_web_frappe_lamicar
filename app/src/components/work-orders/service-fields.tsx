"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { BranchField } from "@/components/work-orders/branch-field";
import { fmtMoney } from "@/lib/format";
import type { WoBranch, WoOperator, WoServiceSegment, WoServiceType, WorkOrder } from "@/lib/frappe/work-orders";

// Pestaña "Servicio" del form de OT con pestañas (alta y edición): sucursal, segmento, tipo de
// servicio, operario y descripción. En el alta `workOrder` no llega y todo arranca vacío.

export function ServiceFields({
  branches,
  branchRequired,
  canManageBranches,
  serviceSegments,
  serviceTypes,
  operators,
  workOrder,
  showPrices = false,
  onSegmentChange,
  onServiceChange,
}: {
  branches: WoBranch[];
  branchRequired: boolean;
  canManageBranches?: boolean;
  serviceSegments: WoServiceSegment[];
  serviceTypes: WoServiceType[];
  operators: WoOperator[];
  workOrder?: WorkOrder;
  /** Mostrar el precio de lista de cada tipo de trabajo (roles que ven importes). */
  showPrices?: boolean;
  onSegmentChange?: (segment: string) => void;
  /** Tipo de trabajo elegido (el alta lo agrega como primera fila del presupuesto). */
  onServiceChange?: (service: WoServiceType | undefined) => void;
}) {
  const [segment, setSegment] = useState<string>(workOrder?.service_segment_id ?? "");

  const filteredServiceTypes = useMemo(
    () => (segment ? serviceTypes.filter((s) => s.segment === segment) : serviceTypes),
    [serviceTypes, segment]
  );

  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
        <BranchField
          branches={branches}
          required={branchRequired}
          canManage={canManageBranches}
          defaultValue={workOrder?.branch_id ?? ""}
        />
        <div className="space-y-1">
          <Label htmlFor="assigned_operator_id">Operario asignado</Label>
          <select
            id="assigned_operator_id"
            name="assigned_operator_id"
            defaultValue={workOrder?.assigned_operator_id ?? ""}
            className={nativeSelectClassName}
          >
            <option value="">Sin asignar</option>
            {operators.map((op) => (
              <option key={op.name} value={op.name}>
                {op.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="service_segment_id">Segmento</Label>
          <select
            id="service_segment_id"
            name="service_segment_id"
            value={segment}
            onChange={(e) => {
              setSegment(e.target.value);
              onSegmentChange?.(e.target.value);
            }}
            className={nativeSelectClassName}
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
            defaultValue={workOrder?.service_type_id ?? ""}
            onChange={(e) => onServiceChange?.(serviceTypes.find((s) => s.name === e.target.value))}
            className={nativeSelectClassName}
          >
            <option value="">Sin especificar</option>
            {filteredServiceTypes.map((s) => (
              <option key={s.name} value={s.name}>
                {s.service_name}
                {showPrices && s.suggested_price ? ` (${fmtMoney(s.suggested_price)})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-full space-y-1">
          <Label htmlFor="description">Descripción del trabajo</Label>
          <Textarea id="description" name="description" rows={5} defaultValue={workOrder?.description} />
        </div>
      </div>
    </div>
  );
}
