"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { getPolicyOptionsAction, saveClientAction } from "@/app/clientes/actions";
import type { CatalogOption } from "@/lib/dashboard-metrics";
import type { WoClient } from "@/lib/clients-shared";

// Alta / edición de cliente. Sin <form> propio (se usa también dentro del form de la OT, y HTML
// no admite forms anidados): guarda con un botón que llama la Server Action.

export function ClientForm({
  initial,
  defaultName,
  defaultTaxId,
  defaultCustomerType,
  customerTypes,
  canViewTaxId,
  onSaved,
  onCancel,
}: {
  initial?: WoClient;
  defaultName?: string;
  /** Si se buscó por DNI/CUIT y no apareció, el número va al campo CUIT/DNI. */
  defaultTaxId?: string;
  /** Alta desde la OT con el tipo de cliente ya elegido (ej. Aseguradora). */
  defaultCustomerType?: string;
  customerTypes: CatalogOption[];
  canViewTaxId: boolean;
  onSaved: (client: WoClient) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [values, setValues] = useState({
    client_name: initial?.client_name ?? defaultName ?? "",
    customer_type_id: initial?.customer_type_id ?? defaultCustomerType ?? "",
    evidence_policy_id: initial?.evidence_policy_id ?? "",
    tax_id: initial?.tax_id ?? defaultTaxId ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    address: initial?.address ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  // Convenios de fotos del tipo elegido (solo las aseguradoras tienen): se piden al cambiar el tipo.
  const [policyOptions, setPolicyOptions] = useState<{
    type: string;
    list: Array<{ key: string; label: string }>;
  } | null>(null);
  useEffect(() => {
    const type = values.customer_type_id;
    if (!type) return;
    let cancelled = false;
    getPolicyOptionsAction(type).then((res) => {
      if (!cancelled) setPolicyOptions({ type, list: res.ok ? res.data : [] });
    });
    return () => {
      cancelled = true;
    };
  }, [values.customer_type_id]);
  const policies = policyOptions?.type === values.customer_type_id ? policyOptions.list : [];
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveClientAction({
        name: initial?.name,
        ...values,
        // Si el tipo nuevo no tiene políticas, no se manda la vieja (el server la limpia).
        evidence_policy_id: policies.some((p) => p.key === values.evidence_policy_id) ? values.evidence_policy_id : "",
      });
      if (res.ok) onSaved(res.data);
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`${id}-name`}>Nombre / razón social *</Label>
          <Input id={`${id}-name`} value={values.client_name} onChange={set("client_name")} autoFocus />
          {defaultTaxId && !initial && (
            <p className="text-xs text-muted-foreground">No encontramos el DNI/CUIT {defaultTaxId}: completá los datos.</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-type`}>Tipo de cliente *</Label>
          <select id={`${id}-type`} value={values.customer_type_id} onChange={set("customer_type_id")} className={nativeSelectClassName}>
            <option value="">Seleccionar…</option>
            {customerTypes.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        {policies.length > 0 && (
          <div className="space-y-1">
            <Label htmlFor={`${id}-policy`}>Política de fotos (convenio)</Label>
            <select
              id={`${id}-policy`}
              value={values.evidence_policy_id}
              onChange={set("evidence_policy_id")}
              className={nativeSelectClassName}
            >
              <option value="">Sin definir (se elige en cada OT)</option>
              {policies.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {canViewTaxId && (
          <div className="space-y-1">
            <Label htmlFor={`${id}-tax`}>CUIT / DNI</Label>
            <Input id={`${id}-tax`} value={values.tax_id} onChange={set("tax_id")} inputMode="numeric" />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor={`${id}-phone`}>Teléfono</Label>
          <Input id={`${id}-phone`} value={values.phone} onChange={set("phone")} type="tel" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-email`}>Email</Label>
          <Input id={`${id}-email`} value={values.email} onChange={set("email")} type="email" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`${id}-address`}>Dirección</Label>
          <Textarea id={`${id}-address`} value={values.address} onChange={set("address")} rows={2} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Guardando…" : initial ? "Guardar cambios" : "Crear cliente"}
        </Button>
      </div>
    </div>
  );
}
