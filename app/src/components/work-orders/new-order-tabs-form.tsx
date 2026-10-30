"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createWorkOrderAction,
  getEvidencePoliciesAction,
  getLastPolicyForClientAction,
  type CreateWorkOrderState,
} from "@/app/work-orders/actions";
import { getClientAction } from "@/app/clientes/actions";
import { ClientPicker } from "@/components/clients/client-picker";
import { VehiclePicker } from "@/components/clients/vehicle-picker";
import { FormTabs, type FormTab } from "@/components/work-orders/form-tabs";
import { ItemsEditor } from "@/components/work-orders/items-editor";
import { PolicyPicker } from "@/components/work-orders/policy-picker";
import { ServiceFields } from "@/components/work-orders/service-fields";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WoClient, WoVehicle } from "@/lib/clients-shared";
import type {
  WoBranch,
  WoCustomerType,
  WoEvidencePolicy,
  WoOperator,
  WoServiceSegment,
  WoServiceType,
  WoVehicleType,
  WorkOrderItem,
} from "@/lib/frappe/work-orders";

// Alta de OT en el panel lateral. El tipo de cliente va primero y "despliega" el resto: hasta
// elegirlo solo se ve esa pregunta; después aparecen las pestañas que corresponden a ese tipo
// (Cliente → Vehículo → Servicio → Presupuesto, + Fotos y archivos si el tipo tiene políticas, ej.
// aseguradoras: siniestro obligatorio y convenio de fotos, que queda guardado en la OT).
// Presupuesto: ítems del catálogo segmento → tipo de trabajo (precio de lista, editable); el tipo
// de trabajo elegido en Servicio entra solo como primera fila.
// Validación en el cliente (salta a la pestaña que falta) + la misma en createWorkOrderAction.
// Versión nueva de NewWorkOrderForm (queda en el repo hasta validar esta).

type Required = "client" | "vehicle" | "photos";

const initialState: CreateWorkOrderState = { error: null };

export function NewOrderTabsForm({
  customerTypes,
  vehicleTypes,
  serviceSegments,
  serviceTypes,
  operators,
  branches = [],
  canViewTaxId = false,
  canManageBranches = false,
  showPrices = true,
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
  canViewTaxId?: boolean;
  /** Admin: si no hay sucursales, muestra el link para cargarlas. */
  canManageBranches?: boolean;
  /** Roles que ven importes: precios en el presupuesto y en el catálogo. */
  showPrices?: boolean;
  onCreated: (name: string) => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(createWorkOrderAction, initialState);
  const [tab, setTab] = useState<string>("client");
  const [attempted, setAttempted] = useState(false);

  const [typeId, setTypeId] = useState("");
  const [client, setClient] = useState<WoClient | null>(null);
  const [vehicle, setVehicle] = useState<WoVehicle | null>(null);
  // Titular de la unidad elegida: en particulares se ofrece como cliente; en siniestros es el
  // asegurado (el cliente de la OT es la aseguradora), así que solo se muestra.
  const [vehicleOwner, setVehicleOwner] = useState<WoClient | null>(null);
  const [siniestro, setSiniestro] = useState("");
  const [segment, setSegment] = useState("");
  const [items, setItems] = useState<WorkOrderItem[]>([]);
  // La primera fila salió del tipo de trabajo de Servicio (si se cambia el tipo, se reemplaza;
  // si se tocó el presupuesto a mano, ya no).
  const [autoItem, setAutoItem] = useState(false);
  // Políticas traídas por tipo de cliente, y la elegida para cada tipo (así cambiar de tipo no
  // arrastra una política de otro).
  const [fetched, setFetched] = useState<{ type: string; list: WoEvidencePolicy[] } | null>(null);
  const [chosenPolicy, setChosenPolicy] = useState<{ type: string; id: string } | null>(null);
  // Política sugerida por el cliente: la de su ficha o, si no tiene, la de su última OT.
  const [suggestedPolicy, setSuggestedPolicy] = useState<{
    client: string;
    id: string;
    source: "client" | "lastOrder";
  } | null>(null);

  // Avisar una sola vez por cada OT creada (state cambia de identidad en cada submit).
  useEffect(() => {
    if (state.createdName) onCreated(state.createdName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const customerTypeOptions = useMemo(
    () => customerTypes.map((c) => ({ key: c.name, label: c.customer_type_name })),
    [customerTypes]
  );
  const vehicleTypeOptions = useMemo(
    () => vehicleTypes.map((v) => ({ key: v.name, label: v.vehicle_type_name })),
    [vehicleTypes]
  );

  // El tipo efectivo es el del cliente elegido (manda el maestro) o el que se eligió al empezar.
  const effectiveType = client?.customer_type_id || typeId;
  const type = customerTypes.find((t) => t.name === effectiveType);
  const claimRequired = !!type?.requires_claim_number;

  // Políticas de fotos del tipo elegido (con sus requisitos). Si hay una sola, queda elegida.
  useEffect(() => {
    if (!effectiveType) return;
    let cancelled = false;
    getEvidencePoliciesAction(effectiveType).then((res) => {
      if (!cancelled) setFetched({ type: effectiveType, list: res.ok ? res.data : [] });
    });
    return () => {
      cancelled = true;
    };
  }, [effectiveType]);
  const policiesLoading = !!effectiveType && fetched?.type !== effectiveType;
  const policies = effectiveType && fetched?.type === effectiveType ? fetched.list : [];
  const suggestedId =
    suggestedPolicy && suggestedPolicy.client === client?.name && policies.some((p) => p.name === suggestedPolicy.id)
      ? suggestedPolicy.id
      : "";
  const policyId =
    chosenPolicy?.type === effectiveType
      ? chosenPolicy.id
      : suggestedId || (policies.length === 1 ? policies[0].name : "");
  const setPolicyId = (id: string) => setChosenPolicy({ type: effectiveType, id });
  const isInsurer = policies.length > 0 || !!type?.requires_insurance_auth || claimRequired;

  function chooseType(next: string) {
    setTypeId(next);
    setTab("client");
    if (client && client.customer_type_id !== next) setClient(null);
  }

  function resetType() {
    setTypeId("");
    setClient(null);
    setChosenPolicy(null);
    setSiniestro("");
  }

  function chooseClient(c: WoClient | null) {
    setClient(c);
    setChosenPolicy(null);
    if (c?.customer_type_id) setTypeId(c.customer_type_id);
    // La política de la ficha del cliente manda; si no tiene, se sugiere la de su última OT.
    if (c?.evidence_policy_id) {
      setSuggestedPolicy({ client: c.name, id: c.evidence_policy_id, source: "client" });
    } else if (c) {
      getLastPolicyForClientAction(c.name).then((id) => {
        if (id) setSuggestedPolicy({ client: c.name, id, source: "lastOrder" });
      });
    }
  }

  async function chooseVehicle(v: WoVehicle | null) {
    setVehicle(v);
    setVehicleOwner(null);
    if (v?.client_id) {
      const res = await getClientAction(v.client_id);
      if (res.ok) setVehicleOwner(res.data);
    }
  }

  function chooseService(svc: WoServiceType | undefined) {
    if (!svc) return;
    const row: WorkOrderItem = {
      description: svc.service_name,
      quantity: 1,
      unit_price_net: svc.suggested_price ?? 0,
      service_type_id: svc.name,
    };
    if (items.length === 0 || (autoItem && items.length === 1)) {
      setItems([row]);
      setAutoItem(true);
    }
  }

  const errors: Record<Required, string | null> = {
    client: !client
      ? `Elegí o creá ${isInsurer ? "la aseguradora" : "el cliente"}.`
      : claimRequired && !siniestro.trim()
        ? "Cargá el Nº de siniestro."
        : null,
    vehicle: !vehicle ? "Elegí o creá la unidad (patente)." : null,
    photos: policiesLoading
      ? "Esperá a que carguen las políticas de fotos."
      : policies.length > 0 && !policyId
        ? "Elegí la política de fotos y archivos."
        : null,
  };
  const missing = (Object.keys(errors) as Required[]).filter((k) => errors[k]);
  const tabStatus = (key: Required) => (errors[key] ? (attempted ? "error" : undefined) : "done");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    setAttempted(true);
    if (!effectiveType || missing.length) {
      e.preventDefault();
      if (missing.length) setTab(missing[0]);
    }
  }

  const fieldError = (key: Required) =>
    attempted && errors[key] ? <p className="text-sm text-destructive">{errors[key]}</p> : null;

  const policy = policies.find((p) => p.name === policyId);
  const ownerIsClient = !!vehicleOwner && vehicleOwner.name === client?.name;
  const total = items.reduce((acc, it) => acc + (it.quantity || 0) * (it.unit_price_net || 0), 0);

  const tabs: FormTab[] = [
    {
      key: "client",
      label: isInsurer ? "Aseguradora" : "Cliente",
      status: tabStatus("client"),
      content: (
        <div className="space-y-5">
          <div className="space-y-2">
            <span className="text-sm font-medium">{isInsurer ? "Aseguradora *" : "Cliente *"}</span>
            <ClientPicker
              key={effectiveType}
              value={client}
              onChange={chooseClient}
              customerTypes={customerTypeOptions}
              canViewTaxId={canViewTaxId}
              customerType={effectiveType || undefined}
              label={isInsurer ? "Aseguradora" : "Cliente"}
            />
          </div>

          {(claimRequired || isInsurer) && (
            <div className="space-y-1">
              <Label htmlFor="siniestro">Nº de siniestro{claimRequired ? " *" : ""}</Label>
              <Input
                id="siniestro"
                name="siniestro"
                value={siniestro}
                onChange={(e) => setSiniestro(e.target.value)}
                aria-invalid={attempted && claimRequired && !siniestro.trim()}
              />
            </div>
          )}

          {type?.requires_insurance_auth ? (
            <p className="flex items-start gap-2 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-500/10 dark:text-sky-200">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              Requiere autorización de la aseguradora: cuando llegue, se adjunta en la OT (Fotos y
              archivos → Otros).
            </p>
          ) : null}

          {fieldError("client")}
        </div>
      ),
    },
    {
      key: "vehicle",
      label: "Vehículo",
      status: tabStatus("vehicle"),
      content: (
        <div className="space-y-5">
          <div className="space-y-2">
            <span className="text-sm font-medium">Unidad *</span>
            <VehiclePicker
              value={vehicle}
              onChange={chooseVehicle}
              vehicleTypes={vehicleTypeOptions}
              customerTypes={customerTypeOptions}
              canViewTaxId={canViewTaxId}
              suggestedOwner={isInsurer ? null : client}
            />
            {vehicleOwner && !ownerIsClient && (
              <p className="text-xs text-muted-foreground">
                {isInsurer ? "Asegurado / titular" : "Titular"}: {vehicleOwner.client_name}
                {!client && !isInsurer && (
                  <>
                    {" · "}
                    <button
                      type="button"
                      onClick={() => chooseClient(vehicleOwner)}
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      Usarlo como cliente de la orden
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="vehicle_mileage">Kilometraje al ingreso</Label>
            <Input
              id="vehicle_mileage"
              name="vehicle_mileage"
              type="number"
              min={0}
              max={2000000}
              step={1}
              inputMode="numeric"
              placeholder="Ej. 14500"
            />
          </div>
          {fieldError("vehicle")}
        </div>
      ),
    },
    {
      key: "service",
      label: "Servicio",
      content: (
        <ServiceFields
          branches={branches}
          branchRequired
          canManageBranches={canManageBranches}
          serviceSegments={serviceSegments}
          serviceTypes={serviceTypes}
          operators={operators}
          showPrices={showPrices}
          onSegmentChange={setSegment}
          onServiceChange={chooseService}
        />
      ),
    },
    {
      key: "budget",
      label: items.length ? `Presupuesto (${items.length})` : "Presupuesto",
      content: (
        <ItemsEditor
          items={items}
          onChange={(next) => {
            setItems(next);
            setAutoItem(false);
          }}
          showPrices={showPrices}
          serviceSegments={serviceSegments}
          serviceTypes={serviceTypes}
          defaultSegment={segment}
        />
      ),
    },
  ];
  if (policiesLoading || policies.length > 0) {
    tabs.push({
      key: "photos",
      label: "Fotos y archivos",
      status: tabStatus("photos"),
      content: (
        <PolicyPicker
          hasType
          loading={policiesLoading}
          policies={policies}
          policyId={policyId}
          onChoose={setPolicyId}
          policy={policy}
          suggestedFrom={suggestedId && policyId === suggestedId ? suggestedPolicy!.source : undefined}
          clientName={client?.client_name}
          requiresAuth={!!type?.requires_insurance_auth}
          error={fieldError("photos")}
        />
      ),
    });
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex min-h-full flex-col">
      <input type="hidden" name="client_id" value={client?.name ?? ""} />
      <input type="hidden" name="vehicle_id" value={vehicle?.name ?? ""} />
      <input type="hidden" name="evidence_policy_id" value={policyId} />
      <input type="hidden" name="items_json" value={JSON.stringify(items)} />

      <div className="flex-1">
        {!effectiveType ? (
          <TypeChooser customerTypes={customerTypes} onChoose={chooseType} />
        ) : (
          <>
            <div className="-mx-4 flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2.5 sm:-mx-6 sm:px-6">
              <p className="flex min-w-0 items-center gap-2 text-sm">
                {isInsurer ? (
                  <ShieldCheck className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <UserRound className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="text-muted-foreground">Tipo:</span>
                <span className="truncate font-medium">{type?.customer_type_name ?? effectiveType}</span>
              </p>
              <button
                type="button"
                onClick={resetType}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <ArrowLeftRight className="size-3.5" /> Cambiar
              </button>
            </div>
            <FormTabs active={tab} onChange={setTab} tabs={tabs} />
          </>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-4 space-y-3 border-t border-border bg-card px-4 py-3 sm:-mx-6 sm:px-6">
        {state.error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}
        {effectiveType && missing.length > 0 && (
          <p className={cn("text-xs", attempted ? "text-destructive" : "text-muted-foreground")}>
            Falta: {missing.map((k) => errors[k]!.replace(/\.$/, "").toLowerCase()).join(" · ")}
          </p>
        )}
        <div className="flex items-center gap-2">
          {effectiveType && (
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? "Creando..." : "Crear orden"}
            </Button>
          )}
          {effectiveType && showPrices && items.length > 0 && (
            <span className="text-sm text-muted-foreground">
              Total <span className="font-semibold text-foreground tabular-nums">{fmtMoney(total)}</span>
            </span>
          )}
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending} className="ml-auto">
            Cancelar
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Primer paso del alta: el tipo de cliente define qué pide el resto del formulario. */
function TypeChooser({
  customerTypes,
  onChoose,
}: {
  customerTypes: WoCustomerType[];
  onChoose: (type: string) => void;
}) {
  return (
    <div className="space-y-4 py-6">
      <div>
        <h2 className="text-base font-semibold">¿Para quién es la orden?</h2>
        <p className="text-sm text-muted-foreground">
          El tipo de cliente define qué datos, fotos y archivos se piden.
        </p>
      </div>
      <div role="radiogroup" aria-label="Tipo de cliente" className="grid gap-2 sm:grid-cols-2">
        {customerTypes.map((t) => {
          const insurer = !!(t.requires_claim_number || t.requires_insurance_auth);
          const hints = [
            t.requires_claim_number && "Pide Nº de siniestro",
            t.requires_insurance_auth && "Fotos y autorización según convenio",
          ].filter(Boolean);
          const Icon = insurer ? ShieldCheck : UserRound;
          return (
            <button
              key={t.name}
              type="button"
              role="radio"
              aria-checked={false}
              onClick={() => onChoose(t.name)}
              className="flex items-start gap-3 rounded-xl border border-border p-4 text-left transition-colors outline-none hover:border-foreground/40 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block font-medium">{t.customer_type_name}</span>
                {hints.length > 0 && <span className="block text-xs text-muted-foreground">{hints.join(" · ")}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
