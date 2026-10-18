import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/work-orders/status-badge";
import { computeOperationalStats, labelOf, type DashboardCatalogs } from "@/lib/dashboard-metrics";
import { fmtMoney } from "@/lib/format";
import { isInGroup } from "@/lib/work-order-status";
import { cn } from "@/lib/utils";
import type { DashboardWorkOrder } from "@/lib/frappe/work-orders";

const ACTIVE_TABLE_LIMIT = 8;

// Cada indicador linkea a /operaciones ya filtrado (claves de OPERATIONS_FILTERS).
function StatTile({
  label,
  value,
  sub,
  hero,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  hero?: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col gap-1 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10 transition-all outline-none hover:ring-foreground/30 focus-visible:ring-2 focus-visible:ring-ring/50",
        hero && "ring-2 ring-brand hover:ring-brand"
      )}
    >
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tracking-tight", hero ? "text-5xl leading-none" : "text-2xl")}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </Link>
  );
}

export function OperationalDashboard({
  rows,
  catalogs,
}: {
  rows: DashboardWorkOrder[];
  catalogs: DashboardCatalogs;
}) {
  const stats = computeOperationalStats(rows);
  const flowTotal = stats.byStatus.reduce((acc, s) => acc + s.count, 0);
  const notCancelled = rows.filter((w) => w.status !== "Anulada");
  const segmentCounts = catalogs.segments.map((seg) => ({
    ...seg,
    count: notCancelled.filter((w) => w.service_segment_id === seg.key).length,
  }));
  const activeOrders = rows.filter((w) => isInGroup(w.status, "ACTIVE")).slice(0, ACTIVE_TABLE_LIMIT);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          hero
          href="/operaciones?filtro=activas"
          label="Órdenes activas en taller"
          value={String(stats.active)}
          sub={`${stats.inProgress} en curso · ${stats.pending} en espera`}
        />
        <StatTile
          href="/operaciones?filtro=facturadas"
          label="Facturación confirmada"
          value={fmtMoney(stats.invoicedAmount)}
          sub={`${stats.invoicedCount} órdenes facturadas`}
        />
        <StatTile
          href="/operaciones?filtro=no-facturadas"
          label="Pipeline valorizado"
          value={fmtMoney(stats.pipelineValue)}
          sub="Valor aún no facturado (nuevas a entregadas)"
        />
        <StatTile
          href="/operaciones?filtro=entregadas"
          label="Entregas con remito"
          value={String(stats.deliveredCount)}
          sub="Entregadas con firma digital"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Flujo en taller por estado</CardTitle>
            <p className="text-xs text-muted-foreground">
              {flowTotal} órdenes (sin anuladas)
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {stats.byStatus.map((s) => {
              const pct = flowTotal > 0 ? (s.count / flowTotal) * 100 : 0;
              return (
                <div key={s.status} className="flex items-center gap-3">
                  <span className="w-24 shrink-0">
                    <StatusBadge status={s.status} />
                  </span>
                  <div
                    className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`${s.status}: ${s.count} órdenes (${pct.toFixed(0)}%)`}
                  >
                    <div className="h-full rounded-full bg-foreground/70" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">
                    {s.count}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Segmentos de trabajo</CardTitle>
            <p className="text-xs text-muted-foreground">Órdenes por segmento (sin anuladas)</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {segmentCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay segmentos activos.</p>
            ) : (
              segmentCounts.map((seg) => (
                <div
                  key={seg.key}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{seg.label}</span>
                  <span className="font-semibold tabular-nums">{seg.count} OTs</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Órdenes activas</h2>
            <p className="text-xs text-muted-foreground">
              Nuevas, en curso y en espera — las unidades que hoy están en el taller
            </p>
          </div>
          <Link
            href="/work-orders"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Ver todas <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {activeOrders.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No hay órdenes activas.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº OT</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Patente / Vehículo</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Técnico</TableHead>
                <TableHead className="text-right">Total neto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeOrders.map((wo) => (
                <TableRow key={wo.name}>
                  <TableCell className="font-medium">
                    <Link href={`/operaciones?ot=${encodeURIComponent(wo.name)}`} className="hover:underline">
                      {wo.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={wo.status} />
                  </TableCell>
                  <TableCell>{wo.customer_name}</TableCell>
                  <TableCell>
                    <span className="mr-2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {wo.license_plate}
                    </span>
                    {wo.vehicle_brand_model}
                  </TableCell>
                  <TableCell>
                    {labelOf(catalogs.services, wo.service_type_id) ?? wo.description ?? "—"}
                  </TableCell>
                  <TableCell>{labelOf(catalogs.operators, wo.assigned_operator_id) ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoney(wo.total_net || 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
