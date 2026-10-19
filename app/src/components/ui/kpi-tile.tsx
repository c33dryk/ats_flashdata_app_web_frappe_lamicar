import Link from "next/link";
import { cn } from "@/lib/utils";

// Indicador (KPI) de las pantallas Operaciones, Dashboard y Facturación. En el celular van los 4
// en una sola línea (cuadritos compactos: etiqueta corta, valor abreviado, sin subtítulo); desde
// tablet se ven completos. Puede ser botón (filtra), link (lleva a otra pantalla) o solo lectura.

export function KpiGrid({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-4" role="group" aria-label={label}>
      {children}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  compactValue,
  sub,
  hero,
  selected,
  href,
  onClick,
}: {
  label: string;
  value: string;
  /** Valor abreviado para el celular (ej. "$ 448k"); si no se pasa, se usa `value`. */
  compactValue?: string;
  sub?: string;
  /** Número principal de la pantalla: más grande desde tablet. */
  hero?: boolean;
  /** Filtro activo (solo con onClick). */
  selected?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const interactive = !!(href || onClick);
  const className = cn(
    "flex min-w-0 flex-col gap-0.5 rounded-xl bg-card p-2.5 text-left text-card-foreground ring-1 ring-foreground/10 sm:gap-1 sm:p-4",
    interactive && "transition-all outline-none hover:ring-foreground/30 focus-visible:ring-2 focus-visible:ring-ring/50",
    selected && "bg-foreground text-background ring-2 ring-foreground hover:ring-foreground"
  );
  const muted = selected ? "text-background/70" : "text-muted-foreground";
  const content = (
    <>
      <span className={cn("line-clamp-2 text-[11px] leading-tight font-medium sm:text-xs", muted)}>{label}</span>
      <span
        className={cn(
          "truncate text-lg leading-tight font-semibold tracking-tight",
          hero ? "sm:text-4xl sm:leading-none" : "sm:text-2xl"
        )}
      >
        <span className="sm:hidden">{compactValue ?? value}</span>
        <span className="hidden sm:inline">{value}</span>
      </span>
      {(sub || selected) && (
        <span className={cn("hidden text-xs sm:block", muted)}>{selected ? "Filtrando · clic para quitar" : sub}</span>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" aria-pressed={!!selected} onClick={onClick} className={className}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}
