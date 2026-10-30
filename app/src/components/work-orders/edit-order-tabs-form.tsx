"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { updateWorkOrderAction, type EditWorkOrderState } from "@/app/work-orders/[id]/edit/actions";
import { getEvidencePoliciesAction } from "@/app/work-orders/actions";
import { PolicyPicker } from "@/components/work-orders/policy-picker";
import { FormTabs } from "@/components/work-orders/form-tabs";
import { ItemsEditor } from "@/components/work-orders/items-editor";
import { OrderParties } from "@/components/work-orders/order-parties";
import { ServiceFields } from "@/components/work-orders/service-fields";
import type { WoClient, WoVehicle } from "@/lib/clients-shared";
import type {
  WoBranch,
  WoCustomerType,
  WoEvidencePolicy,
  WoOperator,
  WoServiceSegment,
  WoServiceType,
  WoVehicleType,
  WorkOrder,
  WorkOrderItem,
} from "@/lib/frappe/work-orders";

// Edición de OT en el panel lateral, en pestañas (Cliente y vehículo / Servicio / Trabajos).
// Versión nueva de EditWorkOrderForm (que sigue usando la página completa /work-orders/[id]/edit
// hasta validar esta): misma Server Action, mismos campos.

export type EditOrderTab = "parties" | "service" | "items" | "photos";

const initialState: EditWorkOrderState = { error: null, success: false };

export function EditOrderTabsForm({
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
  initialTab = "parties",
  showPrices = true,
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
  initialClient?: WoClient | null;
  initialVehicle?: WoVehicle | null;
  /** Pestaña de entrada (ej. "items" si se tocó Editar mirando los trabajos). */
  initialTab?: EditOrderTab;
  /** false = técnico: trabajos sin precios (el server conserva los existentes). */
  showPrices?: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateWorkOrderAction, initialState);
  const [tab, setTab] = useState<string>(initialTab);
  const [items, setItems] = useState<WorkOrderItem[]>(workOrder.items ?? []);
  // Políticas de fotos del tipo de cliente de la OT (si cambia el cliente a otro tipo, se guarda y
  // se vuelve a elegir: el server valida que la política sea del tipo que queda).
  const [policies, setPolicies] = useState<WoEvidencePolicy[] | null>(null);
  const [policyId, setPolicyId] = useState(workOrder.evidence_policy_id ?? "");
  const customerType = customerTypes.find((t) => t.name === workOrder.customer_type_id);

  useEffect(() => {
    if (!workOrder.customer_type_id) return;
    let cancelled = false;
    getEvidencePoliciesAction(workOrder.customer_type_id).then((res) => {
      if (!cancelled) setPolicies(res.ok ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [workOrder.customer_type_id]);

  useEffect(() => {
    if (state.success) onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleSubmit(formData: FormData) {
    formData.set("items_json", JSON.stringify(items));
    formAction(formData);
  }

  return (
    <form action={handleSubmit} className="flex min-h-full flex-col">
      <input type="hidden" name="order_id" value={workOrder.name} />
      <input type="hidden" name="expected_modified" value={workOrder.modified ?? ""} />
      <input type="hidden" name="evidence_policy_id" value={policyId} />

      <div className="flex-1">
        <FormTabs
          active={tab}
          onChange={setTab}
          tabs={[
            {
              key: "parties",
              label: "Cliente y vehículo",
              content: (
                <div className="@container">
                  <div className="grid gap-4 @3xl:grid-cols-2">
                    <OrderParties
                      customerTypes={customerTypes}
                      vehicleTypes={vehicleTypes}
                      canViewTaxId={canViewTaxId}
                      initialClient={initialClient}
                      initialVehicle={initialVehicle}
                      workOrder={workOrder}
                    />
                  </div>
                </div>
              ),
            },
            {
              key: "service",
              label: "Servicio",
              content: (
                <ServiceFields
                  branches={branches}
                  branchRequired={false}
                  serviceSegments={serviceSegments}
                  serviceTypes={serviceTypes}
                  operators={operators}
                  workOrder={workOrder}
                  showPrices={showPrices}
                />
              ),
            },
            {
              key: "items",
              label: `Trabajos (${items.length})`,
              content: (
                <ItemsEditor
                  items={items}
                  onChange={setItems}
                  showPrices={showPrices}
                  serviceSegments={serviceSegments}
                  serviceTypes={serviceTypes}
                  defaultSegment={workOrder.service_segment_id ?? ""}
                />
              ),
            },
            {
              key: "photos",
              label: "Fotos y archivos",
              content: (
                <PolicyPicker
                  hasType={!!workOrder.customer_type_id}
                  loading={!!workOrder.customer_type_id && policies === null}
                  policies={policies ?? []}
                  policyId={policyId}
                  onChoose={setPolicyId}
                  policy={policies?.find((p) => p.name === policyId)}
                  clientName={workOrder.customer_name}
                  requiresAuth={!!customerType?.requires_insurance_auth}
                  error={null}
                />
              ),
            },
          ]}
        />
      </div>

      <div className="sticky bottom-0 -mx-4 mt-4 space-y-3 border-t border-border bg-card px-4 py-3 sm:-mx-6 sm:px-6">
        {state.error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : "Guardar cambios"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
        </div>
      </div>
    </form>
  );
}
