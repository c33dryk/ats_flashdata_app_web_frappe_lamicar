"use client";

import { useMemo, useState } from "react";
import { LayoutList, Plus, Search, SquareKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { NewWorkOrderForm } from "@/components/work-orders/new-work-order-form";
import { KanbanBoard } from "./kanban-board";
import { WorkOrderPanel } from "./work-order-panel";
import { useOrderPanel } from "./use-order-panel";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { labelOf, orderValue, type DashboardCatalogs } from "@/lib/dashboard-metrics";
import { fmtMoney } from "@/lib/format";
import { isInGroup, resolveOperationsFilter } from "@/lib/work-order-status";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/auth-shared";
import {
  WORK_ORDER_STATUSES,
  type DashboardWorkOrder,
  type RawCatalogs,
  type WorkOrderStatus,
} from "@/lib/frappe/work-orders";

export type OperationsView = "list" | "kanban";

// Columnas del kanban: el flujo de taller hasta la entrega. Facturada y Anulada son estados
// cerrados (igual que en el MVP, `showInKanban: false`) — se ven en la lista.
const KANBAN_COLUMNS: WorkOrderStatus[] = ["Nueva", "En Curso", "Pendiente", "Terminada", "Entregada"];

function fmtDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("es-AR");
}

function Plate({ value }: { value: string }) {
  return (
    <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
      {value}
    </span>
  );
}

export function OperationsBoard({
  rows,
  catalogs,
  initialView,
  initialFilter,
  role,
  newOrderCatalogs,
}: {
  rows: DashboardWorkOrder[];
  catalogs: DashboardCatalogs;
  initialView: OperationsView;
  initialFilter?: string;
  role: AppRole;
  /** Catálogos para el alta de OT; solo llegan si el rol puede crear órdenes. */
  newOrderCatalogs?: RawCatalogs;
}) {
  const [view, setView] = useState<OperationsView>(initialView);
  const [creating, setCreating] = useState(false);

  const { openOt, panelAction, openOrder, closeOrder, onOrderLinkClick } = useOrderPanel();
  const [query, setQuery] = useState("");
  // Filtro de estado: una clave de OPERATIONS_FILTERS (indicadores) o un estado suelto (chips).
  const [filter, setFilter] = useState(
    initialFilter && resolveOperationsFilter(initialFilter, WORK_ORDER_STATUSES) ? initialFilter : ""
  );
  const [segment, setSegment] = useState("");
  const [branch, setBranch] = useState("");
  const filterStatuses = resolveOperationsFilter(filter, WORK_ORDER_STATUSES);

  // Vista y filtro van a la URL (linkeable, sobrevive a refresh) sin volver a pedir datos al server.
  function syncUrl(key: "vista" | "filtro", value: string) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    window.history.replaceState(null, "", url);
  }
  function changeView(next: OperationsView) {
    setView(next);
    syncUrl("vista", next === "kanban" ? "kanban" : "");
  }
  /** Aplica un filtro de estado ("" = sin filtro). */
  function applyFilter(key: string) {
    setFilter(key);
    syncUrl("filtro", key);
  }
  /** Clic en un indicador/chip: aplica el filtro, o lo quita si ya estaba activo. */
  const toggleFilter = (key: string) => applyFilter(filter === key ? "" : key);

  // Búsqueda + segmento aplican a todo; el filtro de estado a la lista y a las columnas del kanban.
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (w) =>
        (!segment || w.service_segment_id === segment) &&
        (!branch || w.branch_id === branch) &&
        (!q ||
          [w.name, w.customer_name, w.license_plate, w.vehicle_brand_model, w.siniestro]
            .filter(Boolean)
            .some((v) => v!.toLowerCase().includes(q)))
    );
  }, [rows, query, segment, branch]);
  const listRows = filterStatuses ? searched.filter((w) => filterStatuses.includes(w.status)) : searched;
  const kanbanColumns = filterStatuses
    ? KANBAN_COLUMNS.filter((c) => filterStatuses.includes(c))
    : KANBAN_COLUMNS;

  const countBy = (s: WorkOrderStatus) => rows.filter((w) => w.status === s).length;
  const hasFilters = !!(query.trim() || filter || segment || branch);

  const indicators = [
    {
      filter: "activas",
      label: "Activas en taller",
      value: String(rows.filter((w) => isInGroup(w.status, "ACTIVE")).length),
      sub: `${countBy("En Curso")} en curso · ${countBy("Pendiente")} en espera`,
      hero: true,
    },
    {
      filter: "por-entregar",
      label: "Terminadas por entregar",
      value: String(countBy("Terminada")),
      sub: "Listas para retiro",
    },
    {
      filter: "por-facturar",
      label: "Entregadas por facturar",
      value: String(countBy("Entregada")),
      sub: "Con remito firmado",
    },
    {
      filter: "no-facturadas",
      label: "Valor en taller",
      value: fmtMoney(
        rows.filter((w) => isInGroup(w.status, "PIPELINE")).reduce((acc, w) => acc + orderValue(w), 0)
      ),
      sub: "Neto aún no facturado",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Indicadores: cada uno es un botón que filtra (segundo clic lo quita) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Indicadores">
        {indicators.map((k) => {
          const selected = filter === k.filter;
          return (
            <button
              key={k.filter}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleFilter(k.filter)}
              className={cn(
                "flex flex-col gap-1 rounded-xl bg-card p-4 text-left text-card-foreground ring-1 ring-foreground/10 transition-all outline-none hover:ring-foreground/30 focus-visible:ring-2 focus-visible:ring-ring/50",
                k.hero && "ring-2 ring-brand hover:ring-brand",
                selected && "bg-foreground text-background ring-2 ring-foreground hover:ring-foreground"
              )}
            >
              <span className={cn("text-xs font-medium", selected ? "text-background/70" : "text-muted-foreground")}>
                {k.label}
              </span>
              <span className={cn("font-semibold tracking-tight", k.hero ? "text-4xl leading-none" : "text-2xl")}>
                {k.value}
              </span>
              <span className={cn("text-xs", selected ? "text-background/70" : "text-muted-foreground")}>
                {selected ? "Filtrando · clic para quitar" : k.sub}
              </span>
            </button>
          );
        })}
      </div>

      {/* Barra de controles */}
      <div className="flex flex-wrap items-center gap-2">
        <div className={segmentedGroupClass} role="group" aria-label="Vista">
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => changeView("list")}
            className={cn(segmentedItemClass(view === "list"), "gap-1.5")}
          >
            <LayoutList className="size-4" /> Lista
          </button>
          <button
            type="button"
            aria-pressed={view === "kanban"}
            onClick={() => changeView("kanban")}
            className={cn(segmentedItemClass(view === "kanban"), "gap-1.5")}
          >
            <SquareKanban className="size-4" /> Kanban
          </button>
        </div>
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por OT, cliente, patente, siniestro..."
            className="pl-8"
            aria-label="Buscar órdenes"
          />
        </div>
        <select
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
          className={cn(nativeSelectClassName, "w-auto min-w-44")}
          aria-label="Segmento"
        >
          <option value="">Todos los segmentos</option>
          {catalogs.segments.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        {catalogs.branches.length > 0 && (
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className={cn(nativeSelectClassName, "w-auto min-w-40")}
            aria-label="Sucursal"
          >
            <option value="">Todas las sucursales</option>
            {catalogs.branches.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
        )}
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSegment("");
              setBranch("");
              applyFilter("");
            }}
            className="text-xs font-medium text-destructive hover:underline"
          >
            Restablecer
          </button>
        )}
        {newOrderCatalogs && (
          <Button type="button" className="ml-auto" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Nueva Orden
          </Button>
        )}
      </div>

      {view === "list" ? (
        <>
          {/* Filtro por estado con conteos (indicadores clickeables) */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por estado">
            {([["", "Todas", rows.length]] as Array<[WorkOrderStatus | "", string, number]>)
              .concat(WORK_ORDER_STATUSES.map((s) => [s, s, countBy(s)]))
              .map(([key, label, count]) => (
                <button
                  key={key || "all"}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => (key ? toggleFilter(key) : applyFilter(""))}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
                    filter === key
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                  <span className="tabular-nums opacity-70">{count}</span>
                </button>
              ))}
          </div>

          <Card className="gap-0 py-0">
            {listRows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No hay órdenes con los filtros seleccionados.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº OT</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Patente / Vehículo</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead className="text-right">Total neto</TableHead>
                    <TableHead>Técnico</TableHead>
                    <TableHead>Alta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listRows.map((wo) => (
                    <TableRow
                      key={wo.name}
                      onClick={() => openOrder(wo.name)}
                      aria-selected={openOt === wo.name}
                      className={cn("cursor-pointer", openOt === wo.name && "bg-muted")}
                    >
                      <TableCell className="font-medium">
                        <a
                          href={`/operaciones?ot=${encodeURIComponent(wo.name)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOrderLinkClick(e, wo.name);
                          }}
                          className="hover:underline"
                        >
                          {wo.name}
                        </a>
                        {wo.siniestro && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            Sin. {wo.siniestro}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={wo.status} />
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{wo.customer_name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {labelOf(catalogs.customerTypes, wo.customer_type_id) ?? ""}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Plate value={wo.license_plate} />{" "}
                        <span className="text-muted-foreground">{wo.vehicle_brand_model}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {labelOf(catalogs.segments, wo.service_segment_id) ?? "—"}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {labelOf(catalogs.services, wo.service_type_id) ?? wo.description ?? ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(wo.total_net || 0)}</TableCell>
                      <TableCell>{labelOf(catalogs.operators, wo.assigned_operator_id) ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(wo.creation)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      ) : (
        <KanbanBoard
          rows={searched}
          columns={kanbanColumns}
          catalogs={catalogs}
          role={role}
          selected={openOt}
          onOpen={openOrder}
          onLinkClick={onOrderLinkClick}
        />
      )}

      {openOt && (
        <WorkOrderPanel
          key={openOt}
          name={openOt}
          role={role}
          catalogs={catalogs}
          initialAction={panelAction}
          onClose={closeOrder}
        />
      )}

      {newOrderCatalogs && (
        <Modal
          open={creating}
          onClose={() => setCreating(false)}
          title="Nueva orden de trabajo"
          className="max-w-5xl"
        >
          <NewWorkOrderForm
            {...newOrderCatalogs}
            onCancel={() => setCreating(false)}
            onCreated={(name) => {
              setCreating(false);
              toast.add({
                title: `${name} creada`,
                description: "Ya aparece en la lista y en la columna Nueva.",
                type: "success",
                actionProps: {
                  children: "Abrir",
                  onClick: () => openOrder(name),
                },
              });
            }}
          />
        </Modal>
      )}
    </div>
  );
}
