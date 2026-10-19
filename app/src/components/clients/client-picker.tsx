"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { searchClientsAction } from "@/app/clientes/actions";
import { labelOf, type CatalogOption } from "@/lib/dashboard-metrics";
import { digitsOnly, type WoClient } from "@/lib/clients-shared";
import { ClientForm } from "./client-form";
import { SearchCombobox } from "./search-combobox";

// Selector de cliente con autocompletar (nombre, CUIT, teléfono) y alta rápida inline.

/** Lo buscado parece un DNI/CUIT (7 a 11 dígitos, con o sin guiones/puntos). */
const looksLikeTaxId = (q: string) => /^[\d.\- ]+$/.test(q.trim()) && digitsOnly(q).length >= 7 && digitsOnly(q).length <= 11;

export function ClientPicker({
  value,
  onChange,
  customerTypes,
  canViewTaxId,
  allowCreate = true,
  label = "Cliente",
}: {
  value: WoClient | null;
  onChange: (client: WoClient | null) => void;
  customerTypes: CatalogOption[];
  canViewTaxId: boolean;
  allowCreate?: boolean;
  label?: string;
}) {
  const [creating, setCreating] = useState<string | null>(null);

  if (value) {
    return (
      <div className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
        <div className="min-w-0">
          <p className="truncate font-medium">{value.client_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[labelOf(customerTypes, value.customer_type_id), value.tax_id, value.phone, value.email]
              .filter(Boolean)
              .join(" · ") || value.name}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Quitar ${label.toLowerCase()}`}
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
        <p className="mb-2 text-sm font-medium">Nuevo cliente</p>
        <ClientForm
          {...(looksLikeTaxId(creating) && canViewTaxId
            ? { defaultTaxId: creating.trim() }
            : { defaultName: creating })}
          customerTypes={customerTypes}
          canViewTaxId={canViewTaxId}
          onSaved={(c) => {
            setCreating(null);
            onChange(c);
          }}
          onCancel={() => setCreating(null)}
        />
      </div>
    );
  }

  return (
    <SearchCombobox<WoClient>
      label={label}
      search={searchClientsAction}
      getKey={(c) => c.name}
      placeholder={canViewTaxId ? "Buscar por nombre, CUIT o teléfono…" : "Buscar por nombre o teléfono…"}
      onSelect={onChange}
      createLabel={allowCreate ? (q) => `Crear cliente “${q}”` : undefined}
      onCreate={allowCreate ? (q) => setCreating(q) : undefined}
      renderItem={(c) => (
        <span className="block">
          <span className="font-medium">{c.client_name}</span>
          <span className="block text-xs text-muted-foreground">
            {[labelOf(customerTypes, c.customer_type_id), c.tax_id, c.phone].filter(Boolean).join(" · ")}
          </span>
        </span>
      )}
    />
  );
}
