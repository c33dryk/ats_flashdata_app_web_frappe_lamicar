"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Autocompletar genérico (combobox ARIA): escribe → busca en el server (con debounce) → lista.
// Teclado: ↑/↓ recorren, Enter elige, Esc cierra. Opcionalmente, una última opción "+ Crear …".

export function SearchCombobox<T>({
  search,
  getKey,
  renderItem,
  onSelect,
  placeholder,
  createLabel,
  onCreate,
  minChars = 2,
  autoFocus,
  label,
}: {
  search: (q: string) => Promise<{ ok: true; data: T[] } | { ok: false; error: string }>;
  getKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  onSelect: (item: T) => void;
  placeholder?: string;
  /** Texto de la opción "crear" (recibe lo tipeado); si no se pasa, no hay opción de crear. */
  createLabel?: (q: string) => string;
  onCreate?: (q: string) => void;
  minChars?: number;
  autoFocus?: boolean;
  label: string;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const reqId = useRef(0);

  // Búsqueda con debounce; descarta respuestas viejas (el usuario siguió tipeando).
  useEffect(() => {
    const term = q.trim();
    if (term.length < minChars) return;
    const my = ++reqId.current;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await search(term);
      if (my !== reqId.current) return;
      setLoading(false);
      if (res.ok) {
        setItems(res.data);
        setError(null);
      } else setError(res.error);
      setActive(0);
    }, 250);
    return () => clearTimeout(t);
  }, [q, minChars, search]);

  const term = q.trim();
  const canCreate = !!(createLabel && onCreate && term.length >= minChars);
  const visibleItems = term.length >= minChars ? items : [];
  const total = visibleItems.length + (canCreate ? 1 : 0);

  function choose(index: number) {
    if (index < visibleItems.length) onSelect(visibleItems[index]);
    else if (canCreate) onCreate!(term);
    setOpen(false);
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        role="combobox"
        aria-label={label}
        aria-expanded={open && total > 0}
        aria-controls={`${id}-list`}
        aria-activedescendant={open && total > 0 ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        value={q}
        placeholder={placeholder}
        className="pl-8"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, Math.max(total - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            // Enter dentro del form de la OT no tiene que enviarlo.
            e.preventDefault();
            if (open && total > 0) choose(active);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {loading && (
        <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {open && term.length >= minChars && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10"
        >
          {error && <li className="px-2 py-1.5 text-destructive">{error}</li>}
          {!error && !loading && visibleItems.length === 0 && (
            <li className="px-2 py-1.5 text-muted-foreground">Sin resultados para “{term}”.</li>
          )}
          {visibleItems.map((item, i) => (
            <li
              key={getKey(item)}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
              onMouseEnter={() => setActive(i)}
              className={cn("cursor-pointer rounded-md px-2 py-1.5", i === active && "bg-muted")}
            >
              {renderItem(item)}
            </li>
          ))}
          {canCreate && (
            <li
              id={`${id}-opt-${visibleItems.length}`}
              role="option"
              aria-selected={active === visibleItems.length}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(visibleItems.length)}
              onMouseEnter={() => setActive(visibleItems.length)}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 font-medium",
                active === visibleItems.length && "bg-muted"
              )}
            >
              <Plus className="size-4" /> {createLabel!(term)}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
