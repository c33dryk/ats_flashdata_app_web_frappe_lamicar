import Link from "next/link";
import { Printer } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchableTable } from "@/components/searchable-table";
import { StatusBadge } from "@/components/work-orders/status-badge";
import { FrappeApiError } from "@/lib/frappe/client";
import { getBillingWorkOrders, type BillingWorkOrder } from "@/lib/frappe/work-orders";

// Remitos: una fila por entrega firmada (OT Entregada o Facturada con firma). El remito en sí es
// la página imprimible /remitos/[id] — reemplaza al "PDF" del MVP, que era un archivo de texto.

function fmtDateTime(value?: string) {
  if (!value) return "—";
  const d = new Date(value.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

export default async function RemitosPage() {
  let rows: BillingWorkOrder[] = [];
  let errorMessage: string | null = null;

  try {
    rows = (await getBillingWorkOrders())
      .filter((w) => w.delivery_signed_at)
      .sort((a, b) => (b.delivery_signed_at ?? "").localeCompare(a.delivery_signed_at ?? ""));
  } catch (err) {
    errorMessage =
      err instanceof FrappeApiError
        ? `No se pudo conectar con Frappe (${err.status}). Revisá FRAPPE_URL / FRAPPE_API_KEY / FRAPPE_API_SECRET en .env.`
        : "No se pudo conectar con Frappe. Revisá la configuración en .env.";
  }

  return (
    <div className="flex flex-1 flex-col">
      <Topbar>
        <Breadcrumbs items={[{ label: "Remitos" }]} />
      </Topbar>

      <div className="flex-1 space-y-4 p-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Remitos</h1>
          <p className="text-sm text-muted-foreground">Entregas firmadas por el cliente</p>
        </div>

        {errorMessage ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay entregas firmadas.</p>
        ) : (
          <SearchableTable placeholder="Buscar por OT, cliente, patente o quién firmó...">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Remito / OT</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Patente / Vehículo</TableHead>
                  <TableHead>Firmó</TableHead>
                  <TableHead>Fecha de firma</TableHead>
                  <TableHead className="text-right">Remito</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((w) => (
                  <TableRow
                    key={w.name}
                    data-search={`${w.name} ${w.customer_name} ${w.license_plate} ${w.vehicle_brand_model ?? ""} ${w.delivery_signed_by ?? ""} ${w.siniestro ?? ""}`.toLowerCase()}
                  >
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={w.status} />
                    </TableCell>
                    <TableCell>{w.customer_name}</TableCell>
                    <TableCell>
                      <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {w.license_plate}
                      </span>{" "}
                      <span className="text-muted-foreground">{w.vehicle_brand_model}</span>
                    </TableCell>
                    <TableCell>{w.delivery_signed_by ?? "—"}</TableCell>
                    <TableCell>{fmtDateTime(w.delivery_signed_at)}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/remitos/${encodeURIComponent(w.name)}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <Printer className="size-4" /> Ver remito
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SearchableTable>
        )}
      </div>
    </div>
  );
}
