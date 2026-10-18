import Link from "next/link";
import { Topbar } from "@/components/shell/topbar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { Badge } from "@/components/ui/badge";
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
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getWorkOrders } from "@/lib/frappe/work-orders";
import { FrappeApiError } from "@/lib/frappe/client";

const moneyFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function fmtDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("es-AR");
}

export default async function WorkOrdersPage() {
  const session = await getSession();
  const canCreate = can(session?.role, "createOrder");

  let workOrders: Awaited<ReturnType<typeof getWorkOrders>> = [];
  let errorMessage: string | null = null;

  try {
    workOrders = await getWorkOrders({ limit: 200 });
  } catch (err) {
    errorMessage =
      err instanceof FrappeApiError
        ? `No se pudo conectar con Frappe (${err.status}). Revisá FRAPPE_URL / FRAPPE_API_KEY / FRAPPE_API_SECRET en .env.`
        : "No se pudo conectar con Frappe. Revisá la configuración en .env.";
  }

  return (
    <div className="flex flex-1 flex-col">
      <Topbar>
        <Breadcrumbs items={[{ label: "Órdenes de Trabajo" }]} />
      </Topbar>

      <div className="flex-1 space-y-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Órdenes de Trabajo</h1>
            <p className="text-sm text-muted-foreground">
              Listado de órdenes de trabajo (doctype &quot;Work Order&quot;).
            </p>
          </div>
          {canCreate && (
            <Link href="/work-orders/new" className={buttonVariants({})}>
              Nueva Orden
            </Link>
          )}
        </div>

        {errorMessage ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : workOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay órdenes de trabajo.</p>
        ) : (
          <SearchableTable placeholder="Buscar por Nº, cliente o patente...">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº OT</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Patente</TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Total Neto</TableHead>
                  <TableHead>Última actualización</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workOrders.map((wo) => (
                  <TableRow
                    key={wo.name}
                    data-search={`${wo.name} ${wo.customer_name} ${wo.license_plate} ${wo.vehicle_brand_model ?? ""}`.toLowerCase()}
                  >
                    <TableCell className="font-medium">
                      <Link href={`/work-orders/${wo.name}`} className="hover:underline">
                        {wo.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{wo.status}</Badge>
                    </TableCell>
                    <TableCell>{wo.customer_name}</TableCell>
                    <TableCell>{wo.license_plate}</TableCell>
                    <TableCell>{wo.vehicle_brand_model || "—"}</TableCell>
                    <TableCell>{moneyFmt.format(wo.total_net || 0)}</TableCell>
                    <TableCell>{fmtDate(wo.modified)}</TableCell>
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
