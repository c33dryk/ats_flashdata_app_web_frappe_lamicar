"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { saveClientAction } from "@/app/clientes/actions";
import type { CatalogOption } from "@/lib/dashboard-metrics";
import type { WoClient } from "@/lib/clients-shared";

// Alta / edición de cliente. Sin <form> propio (se usa también dentro del form de la OT, y HTML
// no admite forms anidados): guarda con un botón que llama la Server Action.

export function ClientForm({
  initial,
  defaultName,
  defaultTaxId,
  customerTypes,
  canViewTaxId,
  onSaved,
  onCancel,
}: {
  initial?: WoClient;
  defaultName?: string;
  /** Si se buscó por DNI/CUIT y no apareció, el número va al campo CUIT/DNI. */
  defaultTaxId?: string;
  customerTypes: CatalogOption[];
  canViewTaxId: boolean;
  onSaved: (client: WoClient) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [values, setValues] = useState({
    client_name: initial?.client_name ?? defaultName ?? "",
    customer_type_id: initial?.customer_type_id ?? "",
    tax_id: initial?.tax_id ?? defaultTaxId ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    address: initial?.address ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveClientAction({ name: initial?.name, ...values });
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
