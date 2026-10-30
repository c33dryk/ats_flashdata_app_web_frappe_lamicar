"use client";

import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { Check } from "lucide-react";
import { segmentedGroupClass, segmentedItemClass } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

// Pestañas de los forms de OT (alta y edición en el panel lateral). Todas las pestañas quedan
// montadas (las ocultas con `hidden`) para que sus campos viajen igual en el submit. Si la
// validación nativa del navegador frena el envío por un campo de otra pestaña (ej. sucursal
// obligatoria), salta a esa pestaña antes de que el navegador muestre el aviso sobre el campo.
//
// Migración a Frappe: equivale a los Tab Break del DocType (el Desk ya los muestra así).

export interface FormTab {
  key: string;
  label: string;
  content: React.ReactNode;
  /** "done" = obligatorios completos (tilde); "error" = falta algo y ya se intentó guardar. */
  status?: "done" | "error";
}

export function FormTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: FormTab[];
  active: string;
  /** Pasar el setState directo (se usa dentro de un listener nativo). */
  onChange: (key: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // "invalid" no burbujea: se escucha en captura. Solo el primer campo inválido de cada envío
    // decide la pestaña (el navegador marca ese).
    let handled = false;
    const onInvalid = (e: Event) => {
      if (handled) return;
      handled = true;
      setTimeout(() => (handled = false), 0);
      const key = (e.target as HTMLElement).closest<HTMLElement>("[data-form-tab]")?.dataset.formTab;
      if (key) flushSync(() => onChange(key));
    };
    root.addEventListener("invalid", onInvalid, true);
    return () => root.removeEventListener("invalid", onInvalid, true);
  }, [onChange]);

  return (
    <div ref={rootRef}>
      <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-card px-4 py-3 sm:-mx-6 sm:px-6">
        <div className={cn(segmentedGroupClass, "w-full max-w-full overflow-x-auto sm:w-auto")} role="tablist" aria-label="Secciones del formulario">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`form-tab-${t.key}`}
              aria-selected={active === t.key}
              aria-controls={`form-pane-${t.key}`}
              onClick={() => onChange(t.key)}
              className={cn(segmentedItemClass(active === t.key), "flex-1 sm:flex-none")}
            >
              {t.status === "done" && <Check className="mr-1 size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />}
              {t.status === "error" && <span className="mr-1.5 size-1.5 rounded-full bg-destructive" aria-hidden="true" />}
              {t.label}
              {t.status && <span className="sr-only">{t.status === "done" ? " (completo)" : " (falta completar)"}</span>}
            </button>
          ))}
        </div>
      </div>
      {tabs.map((t) => (
        <div
          key={t.key}
          id={`form-pane-${t.key}`}
          role="tabpanel"
          aria-labelledby={`form-tab-${t.key}`}
          data-form-tab={t.key}
          hidden={active !== t.key}
          className="pt-4"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
