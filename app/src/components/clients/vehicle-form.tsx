"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { saveVehicleAction } from "@/app/clientes/actions";
import { ClientPicker } from "./client-picker";
import type { CatalogOption } from "@/lib/dashboard-metrics";
import { normalizePlate, type WoClient, type WoVehicle } from "@/lib/clients-shared";

// Alta / edición de unidad (vehículo). Sin <form> propio, igual que ClientForm. El dueño es
// opcional y puede no ser el cliente de la OT (siniestros: la OT es de la aseguradora).

export function VehicleForm({
  initial,
  initialOwner,
  defaultPlate,
  suggestedOwner,
  vehicleTypes,
  customerTypes,
  canViewTaxId,
  onSaved,
  onCancel,
}: {
  initial?: WoVehicle;
  initialOwner?: WoClient | null;
  defaultPlate?: string;
  /** Cliente de la OT, ofrecido como dueño con un botón (no se asigna solo). */
  suggestedOwner?: WoClient | null;
  vehicleTypes: CatalogOption[];
  customerTypes: CatalogOption[];
  canViewTaxId: boolean;
  onSaved: (vehicle: WoVehicle, owner: WoClient | null) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [values, setValues] = useState({
    license_plate: initial?.license_plate ?? normalizePlate(defaultPlate ?? ""),
    vehicle_type_id: initial?.vehicle_type_id ?? "",
    brand_model: initial?.brand_model ?? "",
    year: initial?.year ?? "",
    color: initial?.color ?? "",
    vin: initial?.vin ?? "",
  });
  const [owner, setOwner] = useState<WoClient | null>(initialOwner ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [k]: k === "license_plate" ? normalizePlate(e.target.value) : e.target.value }));

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveVehicleAction({ isNew: !initial, ...values, client_id: owner?.name ?? "" });
      if (res.ok) onSaved(res.data, owner);
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-plate`}>Patente *</Label>
          <Input
            id={`${id}-plate`}
            value={values.license_plate}
            onChange={set("license_plate")}
            disabled={!!initial}
            className="font-mono uppercase"
            autoFocus={!initial}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-type`}>Categoría</Label>
          <select id={`${id}-type`} value={values.vehicle_type_id} onChange={set("vehicle_type_id")} className={nativeSelectClassName}>
            <option value="">Sin especificar</option>
            {vehicleTypes.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`${id}-model`}>Marca / modelo</Label>
          <Input id={`${id}-model`} value={values.brand_model} onChange={set("brand_model")} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-year`}>Año</Label>
          <Input
            id={`${id}-year`}
            value={values.year}
            onChange={set("year")}
            type="number"
            min={1950}
            max={new Date().getFullYear() + 1}
            step={1}
            inputMode="numeric"
            placeholder="Ej. 2019"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-color`}>Color</Label>
          <Input id={`${id}-color`} value={values.color} onChange={set("color")} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`${id}-vin`}>Nº de chasis (VIN)</Label>
          <Input id={`${id}-vin`} value={values.vin} onChange={set("vin")} className="font-mono" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <span className="text-sm font-medium">Dueño (opcional)</span>
          <ClientPicker
            value={owner}
            onChange={setOwner}
            customerTypes={customerTypes}
            canViewTaxId={canViewTaxId}
            allowCreate={false}
            label="Dueño de la unidad"
          />
          {!owner && suggestedOwner && (
            <button
              type="button"
              onClick={() => setOwner(suggestedOwner)}
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Usar el cliente de la OT ({suggestedOwner.client_name})
            </button>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Guardando…" : initial ? "Guardar cambios" : "Crear unidad"}
        </Button>
      </div>
    </div>
  );
}
