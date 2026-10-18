"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { segmentedGroupClass, segmentedItemClass } from "@/components/ui/segmented";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/work-orders/status-badge";
import {
  EMPTY_FILTERS,
  applyFilters,
  buildBreakdown,
  buildTimeBuckets,
  type CatalogOption,
  type DashboardCatalogs,
  type DashboardFilters,
  type Granularity,
  type Metric,
  type TimeBucket,
} from "@/lib/dashboard-metrics";
import { fmtMoney, fmtMoneyCompact, fmtNumberCompact } from "@/lib/format";
import { STATUS_GROUPS } from "@/lib/work-order-status";
import { cn } from "@/lib/utils";
import type { DashboardWorkOrder, WorkOrderStatus } from "@/lib/frappe/work-orders";

type BreakdownTab = "branch" | "operator" | "segment" | "customerType" | "status";

const GRANULARITY_LABEL: Record<Granularity, string> = { day: "Día", month: "Mes", year: "Año" };
const PERIOD_LABEL: Record<Granularity, string> = {
  day: "últimos 14 días",
  month: "últimos 12 meses",
  year: "últimos 5 años",
};

export function ManagementDashboard({
  rows,
  catalogs,
  todayISO,
}: {
  rows: DashboardWorkOrder[];
  catalogs: DashboardCatalogs;
  todayISO: string;
}) {
  const [metric, setMetric] = useState<Metric>("revenue");
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS);
  const [tab, setTab] = useState<BreakdownTab>("operator");

  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const buckets = useMemo(
    () => buildTimeBuckets(filtered, granularity, todayISO),
    [filtered, granularity, todayISO]
  );
  // Todo lo de abajo (resumen + desglose) mira el mismo rango que el gráfico.
  const inRange = useMemo(
    () => filtered.filter((w) => (w.creation ?? "") >= buckets[0].key),
    [filtered, buckets]
  );

  const valueOf = (b: TimeBucket) => (metric === "revenue" ? b.revenue : b.count);
  const fmtValue = (v: number) => (metric === "revenue" ? fmtMoney(v) : `${v} OTs`);
  const total = buckets.reduce((acc, b) => acc + valueOf(b), 0);
  const peak = buckets.reduce<TimeBucket | null>(
    (best, b) => (valueOf(b) > (best ? valueOf(best) : 0) ? b : best),
    null
  );

  const breakdown = useMemo(() => {
    switch (tab) {
      case "branch":
        return buildBreakdown(inRange, (w) => w.branch_id, catalogs.branches);
      case "operator":
        return buildBreakdown(inRange, (w) => w.assigned_operator_id, catalogs.operators);
      case "segment":
        return buildBreakdown(inRange, (w) => w.service_segment_id, catalogs.segments);
      case "customerType":
        return buildBreakdown(inRange, (w) => w.customer_type_id, catalogs.customerTypes);
      case "status":
        return buildBreakdown(
          inRange,
          (w) => w.status,
          STATUS_GROUPS.FLOW.map((s) => ({ key: s, label: s }))
        );
    }
  }, [tab, inRange, catalogs]);

  const setFilter = (key: keyof DashboardFilters, value: string) =>
    setFilters((f) => {
      const next = { ...f, [key]: value };
      // Si cambia el segmento, el servicio elegido puede dejar de pertenecerle.
      if (key === "segment" && f.service) {
        const svc = catalogs.services.find((s) => s.key === f.service);
        if (value && svc?.parent !== value) next.service = "";
      }
      return next;
    });
  const hasFilters = Object.values(filters).some(Boolean);

  const filterDefs: Array<{ key: keyof DashboardFilters; label: string; all: string; options: CatalogOption[] }> = [
    ...(catalogs.branches.length
      ? [{ key: "branch" as const, label: "Sucursal", all: "Todas las sucursales", options: catalogs.branches }]
      : []),
    { key: "operator", label: "Técnico", all: "Todos los técnicos", options: catalogs.operators },
    { key: "segment", label: "Segmento", all: "Todos los segmentos", options: catalogs.segments },
    {
      key: "service",
      label: "Tipo de servicio",
      all: "Todos los servicios",
      options: catalogs.services.filter((s) => !filters.segment || s.parent === filters.segment),
    },
    { key: "customerType", label: "Tipo de cliente", all: "Todos los clientes", options: catalogs.customerTypes },
    { key: "vehicleType", label: "Categoría vehículo", all: "Todos los vehículos", options: catalogs.vehicleTypes },
    {
      key: "status",
      label: "Estado",
      all: "Todos los estados",
      options: STATUS_GROUPS.FLOW.map((s) => ({ key: s, label: s })),
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Evolución del taller</h2>
              <p className="text-xs text-muted-foreground">
                {metric === "revenue" ? "Valor neto" : "Cantidad"} de órdenes por fecha de alta,{" "}
                {PERIOD_LABEL[granularity]} (sin anuladas)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className={segmentedGroupClass} role="group" aria-label="Métrica">
                {(["revenue", "count"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={metric === m}
                    onClick={() => setMetric(m)}
                    className={segmentedItemClass(metric === m)}
                  >
                    {m === "revenue" ? "Facturación ($)" : "Cantidad OTs"}
                  </button>
                ))}
              </div>
              <div className={segmentedGroupClass} role="group" aria-label="Agrupar por">
                {(["day", "month", "year"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={granularity === g}
                    onClick={() => setGranularity(g)}
                    className={segmentedItemClass(granularity === g)}
                  >
                    {GRANULARITY_LABEL[g]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
            {filterDefs.map((fd) => (
              <div key={fd.key} className="space-y-1">
                <Label htmlFor={`dash-${fd.key}`} className="text-xs text-muted-foreground">
                  {fd.label}
                </Label>
                <select
                  id={`dash-${fd.key}`}
                  className={nativeSelectClassName}
                  value={filters[fd.key]}
                  onChange={(e) => setFilter(fd.key, e.target.value)}
                >
                  <option value="">{fd.all}</option>
                  {fd.options.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="text-xs font-medium text-destructive hover:underline"
            >
              Restablecer filtros
            </button>
          )}

          <dl className="grid gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Total del período</dt>
              <dd className="text-lg font-semibold">{fmtValue(total)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Promedio por {GRANULARITY_LABEL[granularity].toLowerCase()}
              </dt>
              <dd className="text-lg font-semibold">
                {metric === "revenue"
                  ? fmtMoney(total / buckets.length)
                  : `${(total / buckets.length).toFixed(1)} OTs`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Período pico</dt>
              <dd className="text-lg font-semibold">
                {peak ? `${peak.label} · ${fmtValue(valueOf(peak))}` : "—"}
              </dd>
            </div>
          </dl>

          <ColumnChart buckets={buckets} metric={metric} peakKey={peak?.key} />
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Desglose del período</h2>
            <p className="text-xs text-muted-foreground">
              {inRange.length} órdenes · participación sobre el valor neto
            </p>
          </div>
          <div className={segmentedGroupClass} role="group" aria-label="Desglosar por">
            {(
              [
                ...(catalogs.branches.length ? [["branch", "Sucursal"] as const] : []),
                ["operator", "Técnico"],
                ["segment", "Segmento"],
                ["customerType", "Tipo de cliente"],
                ["status", "Estado"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
                className={segmentedItemClass(tab === key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Corte</TableHead>
              <TableHead className="text-right">OTs</TableHead>
              <TableHead className="text-right">Valor neto</TableHead>
              <TableHead className="text-right">Ticket promedio</TableHead>
              <TableHead className="w-48">Participación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {breakdown.map((r) => (
              <TableRow key={r.key}>
                <TableCell>
                  {tab === "status" && r.key !== "__none__" ? (
                    <StatusBadge status={r.key as WorkOrderStatus} />
                  ) : (
                    <>
                      <span className="font-medium">{r.label}</span>
                      {r.sublabel && (
                        <span className="block text-xs text-muted-foreground">{r.sublabel}</span>
                      )}
                    </>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtMoney(r.revenue)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {r.count ? fmtMoney(r.avgTicket) : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground/70"
                        style={{ width: `${r.share}%` }}
                      />
                    </div>
                    <span className="w-9 text-right text-xs font-medium tabular-nums">
                      {r.share.toFixed(0)}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ── Gráfico de columnas (una sola serie) ─────────────────────────────────────────
// HTML/CSS en vez de una librería de charts: una serie, pocas columnas, y así no sumamos una
// dependencia. Columnas ≤24px con punta redondeada, grilla hairline, etiqueta directa solo en el
// pico, tooltip por columna (hover y foco de teclado) y tabla equivalente para lectores de
// pantalla.

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

function ColumnChart({
  buckets,
  metric,
  peakKey,
}: {
  buckets: TimeBucket[];
  metric: Metric;
  peakKey?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const valueOf = (b: TimeBucket) => (metric === "revenue" ? b.revenue : b.count);
  const max = niceMax(Math.max(...buckets.map(valueOf)));
  const ticks = [max, max / 2, 0];
  const fmtTick = (v: number) => (metric === "revenue" ? fmtMoneyCompact(v) : fmtNumberCompact(v));
  const sampleTotal = buckets.reduce((acc, b) => acc + b.revenue, 0);

  return (
    <div>
      <div className="flex gap-2">
        {/* Eje Y */}
        <div className="relative h-56 w-16 shrink-0" aria-hidden="true">
          {ticks.map((t, i) => (
            <span
              key={i}
              className="absolute right-0 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums"
              style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
            >
              {fmtTick(t)}
            </span>
          ))}
        </div>

        {/* Área de trazado */}
        <div className="relative h-56 flex-1">
          {ticks.map((_, i) => (
            <div
              key={i}
              className="absolute inset-x-0 border-t border-border"
              style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
              aria-hidden="true"
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-0.5">
            {buckets.map((b) => {
              const v = valueOf(b);
              const pct = (v / max) * 100;
              const isActive = active === b.key;
              const isPeak = b.key === peakKey;
              return (
                <button
                  key={b.key}
                  type="button"
                  aria-label={`${b.label}: ${fmtMoney(b.revenue)}, ${b.count} órdenes`}
                  className="relative flex h-full flex-1 items-end justify-center rounded-sm outline-none focus-visible:bg-muted/60"
                  onPointerEnter={() => setActive(b.key)}
                  onPointerLeave={() => setActive((k) => (k === b.key ? null : k))}
                  onFocus={() => setActive(b.key)}
                  onBlur={() => setActive((k) => (k === b.key ? null : k))}
                >
                  {isPeak && v > 0 && !isActive && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 -translate-y-full pb-1 text-[11px] font-semibold whitespace-nowrap"
                      style={{ bottom: `${pct}%` }}
                    >
                      {fmtTick(v)}
                    </span>
                  )}
                  <span
                    className={cn(
                      "block w-full max-w-6 rounded-t-[4px] transition-colors",
                      isActive ? "bg-foreground" : "bg-foreground/70"
                    )}
                    style={{ height: `${pct}%` }}
                  />
                  {isActive && (
                    <span
                      className="pointer-events-none absolute left-1/2 z-10 mb-1 -translate-x-1/2 rounded-md bg-popover px-2.5 py-1.5 text-left text-xs whitespace-nowrap text-popover-foreground shadow-md ring-1 ring-foreground/10"
                      style={{ bottom: `${pct}%` }}
                    >
                      <span className="block font-semibold">
                        {metric === "revenue" ? fmtMoney(b.revenue) : `${b.count} OTs`}
                      </span>
                      <span className="block text-muted-foreground">
                        {b.label} ·{" "}
                        {metric === "revenue" ? `${b.count} OTs` : fmtMoney(b.revenue)}
                        {sampleTotal > 0 && ` · ${((b.revenue / sampleTotal) * 100).toFixed(0)}% del valor`}
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Eje X */}
      <div className="ml-18 flex gap-0.5" aria-hidden="true">
        {buckets.map((b) => (
          <span
            key={b.key}
            className={cn(
              "flex-1 truncate pt-1.5 text-center text-[11px] text-muted-foreground",
              active === b.key && "font-semibold text-foreground"
            )}
          >
            {b.label}
          </span>
        ))}
      </div>

      {/* Tabla equivalente (lectores de pantalla / sin mouse) */}
      <table className="sr-only">
        <caption>Valor neto y cantidad de órdenes por período</caption>
        <thead>
          <tr>
            <th>Período</th>
            <th>Valor neto</th>
            <th>Órdenes</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.key}>
              <td>{b.label}</td>
              <td>{fmtMoney(b.revenue)}</td>
              <td>{b.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
