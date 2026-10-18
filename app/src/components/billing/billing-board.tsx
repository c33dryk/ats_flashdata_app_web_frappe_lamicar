"use client";

import { useMemo, useState } from "react";
import { Download, FileText, PenLine, Receipt, Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { nativeSelectClassName } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WorkOrderPanel } from "@/components/operations/work-order-panel";
import { useOrderPanel } from "@/components/operations/use-order-panel";
import { StatusBadge } from "@/components/work-orders/status-badge";
import { labelOf, type DashboardCatalogs } from "@/lib/dashboard-metrics";
import { fileHref } from "@/lib/evidence";
import { fmtMoney } from "@/lib/format";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/auth-shared";
import { COMMAND_ROLES, type BillingWorkOrder } from "@/lib/frappe/work-orders";

// Pantalla de Facturación: lo entregado pendiente de facturar y lo ya facturado. Indicadores que
// filtran, selección múltiple para bajar expedientes ZIP (/api/expedientes) y el mismo panel
// lateral de OT que Operaciones (ahí está la acción "Facturar" con el PDF).

type FilterKey = "" | "por-facturar" | "mes" | "facturadas" | "sin-pdf";

const MAX_ZIP = 50;

const FILTERS: Record<Exclude<FilterKey, "">, (w: BillingWorkOrder, month: string) => boolean> = {
  "por-facturar": (w) => w.status === "Entregada",
  mes: (w, month) => w.status === "Facturada" && (w.invoice_date ?? "").startsWith(month),
  facturadas: (w) => w.status === "Facturada",
  "sin-pdf": (w) => w.status === "Facturada" && !w.invoice_file_url,
};

const amountOf = (w: BillingWorkOrder) =>
  w.status === "Facturada" ? w.invoice_amount || w.total_net || 0 : w.total_net || 0;

function fmtDate(value?: string) {
  if (!value) return "—";
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("es-AR");
}

export function BillingBoard({
  rows,
  catalogs,
  role,
  todayISO,
}: {
  rows: BillingWorkOrder[];
  catalogs: DashboardCatalogs;
  role: AppRole;
  todayISO: string;
}) {
  const month = todayISO.slice(0, 7);
  const [filter, setFilter] = useState<FilterKey>("por-facturar");
  const [query, setQuery] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { openOt, panelAction, openOrder, closeOrder, onOrderLinkClick } = useOrderPanel();

  const canInvoice = COMMAND_ROLES.invoice.includes(role);
  const canExport = can(role, "exportDossier");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (w) =>
        (!filter || FILTERS[filter](w, month)) &&
        (!customerType || w.customer_type_id === customerType) &&
        (!q ||
          [w.name, w.customer_name, w.license_plate, w.vehicle_brand_model, w.siniestro, w.invoice_number]
            .filter(Boolean)
            .some((v) => v!.toLowerCase().includes(q)))
    );
  }, [rows, filter, month, query, customerType]);

  const sum = (list: BillingWorkOrder[]) => list.reduce((acc, w) => acc + amountOf(w), 0);
  const pending = rows.filter((w) => FILTERS["por-facturar"](w, month));
  const thisMonth = rows.filter((w) => FILTERS.mes(w, month));
  const invoiced = rows.filter((w) => FILTERS.facturadas(w, month));
  const noPdf = rows.filter((w) => FILTERS["sin-pdf"](w, month));

  const indicators: Array<{ key: Exclude<FilterKey, "">; label: string; value: string; sub: string }> = [
    { key: "por-facturar", label: "Por facturar", value: fmtMoney(sum(pending)), sub: `${pending.length} entregadas` },
    { key: "mes", label: "Facturado este mes", value: fmtMoney(sum(thisMonth)), sub: `${thisMonth.length} comprobantes` },
    { key: "facturadas", label: "Facturadas", value: String(invoiced.length), sub: fmtMoney(sum(invoiced)) },
    { key: "sin-pdf", label: "Facturadas sin PDF", value: String(noPdf.length), sub: "Falta adjuntar el comprobante" },
  ];

  const allSelected = visible.length > 0 && visible.every((w) => selected.has(w.name));
  const toggle = (name: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const zipHref = (names: string[]) => `/api/expedientes?${names.map((n) => `ot=${encodeURIComponent(n)}`).join("&")}`;
  const selectedNames = [...selected];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Indicadores">
        {indicators.map((k) => {
          const on = filter === k.key;
          return (
            <button
              key={k.key}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(on ? "" : k.key)}
              className={cn(
                "flex flex-col gap-1 rounded-xl bg-card p-4 text-left text-card-foreground ring-1 ring-foreground/10 transition-all outline-none hover:ring-foreground/30 focus-visible:ring-2 focus-visible:ring-ring/50",
                on && "bg-foreground text-background ring-2 ring-foreground hover:ring-foreground"
              )}
            >
              <span className={cn("text-xs font-medium", on ? "text-background/70" : "text-muted-foreground")}>
                {k.label}
              </span>
              <span className="text-2xl font-semibold tracking-tight">{k.value}</span>
              <span className={cn("text-xs", on ? "text-background/70" : "text-muted-foreground")}>
                {on ? "Filtrando · clic para quitar" : k.sub}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por OT, cliente, patente, siniestro o Nº de factura..."
            className="pl-8"
            aria-label="Buscar"
          />
        </div>
        <select
          value={customerType}
          onChange={(e) => setCustomerType(e.target.value)}
          className={cn(nativeSelectClassName, "w-auto min-w-44")}
          aria-label="Tipo de cliente"
        >
          <option value="">Todos los clientes</option>
          {catalogs.customerTypes.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        {canExport && selectedNames.length > 0 && (
          <a
            href={zipHref(selectedNames.slice(0, MAX_ZIP))}
            className={buttonVariants({})}
            title={selectedNames.length > MAX_ZIP ? `Se descargan las primeras ${MAX_ZIP}` : undefined}
          >
            <Download className="size-4" /> Expedientes ZIP ({Math.min(selectedNames.length, MAX_ZIP)})
          </a>
        )}
      </div>

      <Card className="gap-0 py-0">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No hay órdenes con los filtros seleccionados.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {canExport && (
                  <TableHead className="w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() =>
                        setSelected(allSelected ? new Set() : new Set(visible.map((w) => w.name)))
                      }
                      aria-label="Seleccionar todas"
                    />
                  </TableHead>
                )}
                <TableHead>Nº OT</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Patente / Vehículo</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((w) => (
                <TableRow
                  key={w.name}
                  onClick={() => openOrder(w.name)}
                  className={cn("cursor-pointer", openOt === w.name && "bg-muted")}
                >
                  {canExport && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(w.name)}
                        onChange={() => toggle(w.name)}
                        aria-label={`Seleccionar ${w.name}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">
                    <a
                      href={`/facturacion?ot=${encodeURIComponent(w.name)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOrderLinkClick(e, w.name);
                      }}
                      className="hover:underline"
                    >
                      {w.name}
                    </a>
                    {w.siniestro && (
                      <span className="block text-xs font-normal text-muted-foreground">Sin. {w.siniestro}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={w.status} />
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{w.customer_name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {labelOf(catalogs.customerTypes, w.customer_type_id) ?? ""}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {w.license_plate}
                    </span>{" "}
                    <span className="text-muted-foreground">{w.vehicle_brand_model}</span>
                  </TableCell>
                  <TableCell>
                    {fmtDate(w.delivery_signed_at ?? w.delivery_date)}
                    {w.delivery_signed_by && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <PenLine className="size-3" /> {w.delivery_signed_by}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {w.invoice_number ? (
                      <>
                        <span className="font-medium">{w.invoice_number}</span>
                        <span className="block text-xs text-muted-foreground">{fmtDate(w.invoice_date)}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoney(amountOf(w))}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {w.invoice_file_url && (
                        <a
                          href={fileHref(w.invoice_file_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                          title="Ver PDF de la factura"
                          aria-label={`Ver factura de ${w.name}`}
                        >
                          <FileText className="size-4" />
                        </a>
                      )}
                      {canExport && (
                        <a
                          href={zipHref([w.name])}
                          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                          title="Descargar expediente ZIP"
                          aria-label={`Descargar expediente de ${w.name}`}
                        >
                          <Download className="size-4" />
                        </a>
                      )}
                      {canInvoice && w.status === "Entregada" && (
                        <Button type="button" size="sm" onClick={() => openOrder(w.name, "invoice")}>
                          <Receipt className="size-4" /> Facturar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {openOt && (
        <WorkOrderPanel
          key={openOt}
          name={openOt}
          role={role}
          catalogs={catalogs}
          initialAction={panelAction}
          onClose={closeOrder}
          section="Facturación"
        />
      )}
    </div>
  );
}
