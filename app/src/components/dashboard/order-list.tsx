import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/work-orders/status-badge";
import { cn } from "@/lib/utils";
import type { DashboardWorkOrder } from "@/lib/frappe/work-orders";

// Listas de OTs de los tableros por rol. Filas en vez de tabla: se leen igual en el celular
// (patente + Nº arriba, cliente/vehículo abajo, dato clave a la derecha). Cada fila abre la OT en
// el panel lateral de la pantalla destino (?ot=).

export function OrderListCard({
  title,
  hint,
  orders,
  limit = 6,
  empty,
  moreHref,
  renderRow,
}: {
  title: string;
  hint?: string;
  orders: DashboardWorkOrder[];
  limit?: number;
  empty: string;
  /** "Ver todas" (si hay más de `limit` o para ir a la pantalla completa). */
  moreHref?: string;
  renderRow: (wo: DashboardWorkOrder) => React.ReactNode;
}) {
  const shown = orders.slice(0, limit);
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            {title}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {orders.length}
            </span>
          </h2>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {moreHref && orders.length > 0 && (
          <Link
            href={moreHref}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Ver todas <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((wo) => (
            <li key={wo.name}>{renderRow(wo)}</li>
          ))}
        </ul>
      )}
      {orders.length > limit && (
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          +{orders.length - limit} más
        </p>
      )}
    </Card>
  );
}

export function OrderRow({
  wo,
  href,
  showStatus,
  meta,
  note,
  aside,
}: {
  wo: DashboardWorkOrder;
  href: string;
  showStatus?: boolean;
  /** Línea secundaria (servicio, técnico, descripción...). */
  meta?: string;
  /** Aviso destacado (ej. motivo de espera). */
  note?: string;
  /** Columna derecha (monto, antigüedad...). */
  aside?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/60"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">
            {wo.license_plate || "s/patente"}
          </span>
          <span className="text-sm font-medium">{wo.name}</span>
          {showStatus && <StatusBadge status={wo.status} />}
        </div>
        <p className="truncate text-sm">
          {wo.customer_name}
          {wo.vehicle_brand_model && <span className="text-muted-foreground"> · {wo.vehicle_brand_model}</span>}
        </p>
        {meta && <p className="line-clamp-2 text-xs text-muted-foreground">{meta}</p>}
        {note && (
          <p className="text-xs text-amber-800 dark:text-amber-300">
            <span className="font-medium">En espera:</span> {note}
          </p>
        )}
      </div>
      {aside && <div className="shrink-0 space-y-1 text-right">{aside}</div>}
    </Link>
  );
}

/** Antigüedad en días; se pinta en ámbar desde `warn` y en rojo desde `danger`. */
export function AgeTag({
  days,
  warn = 3,
  danger = 7,
  prefix,
}: {
  days: number | null;
  warn?: number;
  danger?: number;
  prefix?: string;
}) {
  if (days === null) return null;
  const text = days === 0 ? "hoy" : days === 1 ? "1 día" : `${days} días`;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-4xl px-2 text-xs font-medium whitespace-nowrap",
        days >= danger
          ? "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300"
          : days >= warn
            ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
            : "bg-muted text-muted-foreground"
      )}
    >
      {prefix && `${prefix} `}
      {text}
    </span>
  );
}
