"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { searchVehiclesAction } from "@/app/clientes/actions";
import { labelOf, type CatalogOption } from "@/lib/dashboard-metrics";
import { normalizePlate, type WoClient, type WoVehicle } from "@/lib/clients-shared";
import { SearchCombobox } from "./search-combobox";
import { VehicleForm } from "./vehicle-form";

// Selector de unidad por patente (o marca/modelo) con alta rápida inline.

export function VehiclePicker({
  value,
  onChange,
  vehicleTypes,
  customerTypes,
  canViewTaxId,
  suggestedOwner,
  allowCreate = true,
}: {
  value: WoVehicle | null;
  onChange: (vehicle: WoVehicle | null) => void;
  vehicleTypes: CatalogOption[];
  customerTypes: CatalogOption[];
  canViewTaxId: boolean;
  /** Cliente de la OT: en el alta rápida se ofrece como dueño (no se asigna solo). */
  suggestedOwner?: WoClient | null;
  allowCreate?: boolean;
}) {
  const [creating, setCreating] = useState<string | null>(null);

  if (value) {
    return (
      <div className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <span className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs">
              {value.license_plate}
            </span>
            <span className="truncate">{value.brand_model || "Sin marca/modelo"}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[labelOf(vehicleTypes, value.vehicle_type_id), value.year, value.color].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Quitar unidad"
          title="Cambiar"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  if (creating !== null) {
    return (
      <div className="rounded-lg border border-border p-3">
        <p className="mb-2 text-sm font-medium">Nueva unidad</p>
        <VehicleForm
          defaultPlate={creating}
          suggestedOwner={suggestedOwner}
          vehicleTypes={vehicleTypes}
          customerTypes={customerTypes}
          canViewTaxId={canViewTaxId}
          onSaved={(v) => {
            setCreating(null);
            onChange(v);
          }}
          onCancel={() => setCreating(null)}
        />
      </div>
    );
  }

  return (
    <SearchCombobox<WoVehicle>
      label="Unidad"
      search={searchVehiclesAction}
      getKey={(v) => v.name}
      placeholder="Buscar por patente o modelo…"
      onSelect={onChange}
      createLabel={allowCreate ? (q) => `Crear unidad ${normalizePlate(q)}` : undefined}
      onCreate={allowCreate ? (q) => setCreating(q) : undefined}
      renderItem={(v) => (
        <span className="flex items-center gap-2">
          <span className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs">{v.license_plate}</span>
          <span className="truncate">{v.brand_model || "Sin marca/modelo"}</span>
          {v.year && <span className="text-xs text-muted-foreground">{v.year}</span>}
        </span>
      )}
    />
  );
}
