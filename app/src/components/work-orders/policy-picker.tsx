"use client";

import { Camera, FileCheck2, Loader2, ShieldCheck } from "lucide-react";
import { STAGES } from "@/lib/evidence";
import { cn } from "@/lib/utils";
import type { WoEvidencePolicy } from "@/lib/frappe/work-orders";

// Pestaña "Fotos y archivos" del alta y de la edición de OT: elegir la política (convenio) de la
// aseguradora y ver qué pide en cada etapa (antes / durante / después / entrega). Las fotos se
// cargan después, desde el panel de la OT.

export function PolicyPicker({
  hasType,
  loading,
  policies,
  policyId,
  onChoose,
  policy,
  suggestedFrom,
  clientName,
  requiresAuth,
  error,
}: {
  hasType: boolean;
  loading: boolean;
  policies: WoEvidencePolicy[];
  policyId: string;
  onChoose: (name: string) => void;
  policy?: WoEvidencePolicy;
  /** De dónde salió la política elegida: la ficha del cliente o su última OT. */
  suggestedFrom?: "client" | "lastOrder";
  clientName?: string;
  requiresAuth: boolean;
  error: React.ReactNode;
}) {
  if (!hasType) {
    return <p className="text-sm text-muted-foreground">Elegí primero el tipo de cliente (pestaña Cliente).</p>;
  }
  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Buscando la política de fotos…
      </p>
    );
  }
  if (policies.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
        Este tipo de cliente no pide fotos ni archivos específicos. Igual se pueden cargar archivos
        desde el panel de la orden (Fotos y archivos → Otros).
      </p>
    );
  }

  const requirements = policy?.requirements ?? [];
  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Política de la aseguradora *</legend>
        <div role="radiogroup" aria-label="Política de fotos y archivos" className="grid gap-2 sm:grid-cols-2">
          {policies.map((p) => {
            const selected = p.name === policyId;
            return (
              <button
                key={p.name}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChoose(p.name)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  selected ? "border-foreground ring-1 ring-foreground" : "border-border hover:bg-muted"
                )}
              >
                <span className="block font-medium">{p.policy_name || p.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {p.requirements?.length ?? 0} requisitos
                </span>
              </button>
            );
          })}
        </div>
        {suggestedFrom === "client" ? (
          <p className="text-xs text-muted-foreground">
            Es el convenio cargado en la ficha de {clientName ?? "la aseguradora"} (Clientes).
          </p>
        ) : suggestedFrom === "lastOrder" ? (
          <p className="text-xs text-muted-foreground">
            Sugerida: es la que se usó en la última orden de {clientName ?? "este cliente"}. Para dejarla
            fija, cargala en la ficha del cliente.
          </p>
        ) : (
          policies.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Elegí el convenio de {clientName ?? "la aseguradora"}. Para que se elija solo, cargalo en la
              ficha del cliente (Clientes).
            </p>
          )
        )}
      </fieldset>

      {policy && (
        <div className="space-y-4 rounded-lg border border-border p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <FileCheck2 className="size-4" /> Lo que pide {policy.policy_name || "la aseguradora"}
          </p>
          {requirements.length === 0 && (
            <p className="text-sm text-muted-foreground">Esta política no tiene requisitos cargados.</p>
          )}
          {STAGES.map((stage) => {
            const reqs = requirements.filter((r) => r.stage === stage.key);
            if (!reqs.length) return null;
            return (
              <section key={stage.key} className="space-y-1.5">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{stage.label}</h3>
                <ul className="space-y-1">
                  {reqs.map((r) => (
                    <li key={r.code} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <Camera className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{r.label}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        mín. {r.min_photos ?? 1}
                        {r.allow_exception ? " · admite excepción" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {requiresAuth && (
            <p className="flex items-center gap-2 text-sm">
              <ShieldCheck className="size-3.5 shrink-0 text-muted-foreground" /> Autorización de la aseguradora
            </p>
          )}
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            Las fotos se cargan desde el panel de la orden (pestaña Fotos y archivos), separadas por
            etapa con este checklist.
          </p>
        </div>
      )}
      {error}
    </div>
  );
}
