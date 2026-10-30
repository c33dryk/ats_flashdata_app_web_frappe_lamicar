"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import type { CatalogOption } from "@/lib/dashboard-metrics";

// Selector de técnico del tablero "Taller" (solo admin: el técnico ve siempre lo suyo). El
// técnico elegido va en la URL (?tecnico=) para que el tablero se siga armando en el server.

export function OperatorPicker({ operators, value }: { operators: CatalogOption[]; value: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function change(next: string) {
    const url = new URLSearchParams(params.toString());
    if (next) url.set("tecnico", next);
    else url.delete("tecnico");
    router.push(`/dashboard?${url.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">Técnico</span>
      <select
        value={value}
        onChange={(e) => change(e.target.value)}
        className={cn(nativeSelectClassName, "w-auto min-w-48")}
      >
        <option value="">Todo el taller</option>
        {operators.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
