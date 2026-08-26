"use client";

import { useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

// Envuelve una tabla ya armada (server-rendered, pasada como children) y le agrega un buscador
// client-side. No puede recibir una función `render` por columna desde un Server Component (los
// props Server → Client no pueden ser funciones) — en cambio, cada <TableRow> de la tabla trae
// un atributo `data-search="texto plano en minúscula"` puesto por quien arma la tabla, y acá
// simplemente togglea `display:none` sobre los <tr> que no matchean. Sin duplicar el estado de
// las filas del lado del cliente.
export function SearchableTable({
  placeholder = "Buscar...",
  children,
}: {
  placeholder?: string;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");

  function handleChange(value: string) {
    setQuery(value);
    const q = value.trim().toLowerCase();
    const rows = containerRef.current?.querySelectorAll<HTMLTableRowElement>("tr[data-search]");
    rows?.forEach((row) => {
      const matches = !q || (row.dataset.search ?? "").includes(q);
      row.style.display = matches ? "" : "none";
    });
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="pl-8"
        />
      </div>
      <div ref={containerRef}>{children}</div>
    </div>
  );
}
