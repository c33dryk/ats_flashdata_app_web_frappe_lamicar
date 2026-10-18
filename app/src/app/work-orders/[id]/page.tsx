import Link from "next/link";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WorkOrderActions } from "@/components/work-orders/work-order-actions";
import { EvidenceCard } from "@/components/work-orders/evidence-card";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getEvidencePoliciesForCustomerType, getWorkOrder, type WoEvidencePolicy } from "@/lib/frappe/work-orders";
import { EVIDENCE_LOCKED_STATUSES } from "@/lib/evidence";
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

function fmtDateTime(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("es-AR");
}

const LOCKED_STATUSES = ["Facturada", "Anulada"] as const;

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}

export default async function WorkOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ accion?: string }>;
}) {
  const { id } = await params;
  const { accion } = await searchParams;
  const session = await getSession();

  let wo: Awaited<ReturnType<typeof getWorkOrder>> | null = null;
  let evidencePolicies: WoEvidencePolicy[] = [];
  let errorMessage: string | null = null;

  try {
    wo = await getWorkOrder(id);
    evidencePolicies = await getEvidencePoliciesForCustomerType(wo.customer_type_id);
  } catch (err) {
    if (err instanceof FrappeApiError && err.status === 404) {
      notFound();
    }
    errorMessage =
      err instanceof FrappeApiError
        ? `No se pudo conectar con Frappe (${err.status}). Revisá FRAPPE_URL / FRAPPE_API_KEY / FRAPPE_API_SECRET en .env.`
        : "No se pudo conectar con Frappe. Revisá la configuración en .env.";
  }

  return (
    <div className="flex flex-1 flex-col">
      <Topbar>
        <Breadcrumbs
          items={[
            { label: "Órdenes de Trabajo", href: "/work-orders" },
            { label: id },
          ]}
        />
      </Topbar>

      <div className="flex-1 space-y-4 p-6">
        {errorMessage ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : wo ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold tracking-tight">{wo.name}</h1>
                <Badge variant="secondary">{wo.status}</Badge>
              </div>
              {session &&
                can(session.role, "editOrder") &&
                !LOCKED_STATUSES.includes(wo.status as (typeof LOCKED_STATUSES)[number]) && (
                  <Link
                    href={`/work-orders/${wo.name}/edit`}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Editar
                  </Link>
                )}
            </div>

            {session && (
              <WorkOrderActions workOrder={wo} role={session.role} initialPanel={accion} />
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Cliente</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <Field label="Nombre" value={wo.customer_name} />
                  <Field label="Tipo de cliente" value={wo.customer_type_id} />
                  <Field label="Teléfono" value={wo.customer_phone} />
                  <Field label="Email" value={wo.customer_email} />
                  <Field label="Nº Siniestro" value={wo.siniestro} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Vehículo</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <Field label="Patente" value={wo.license_plate} />
                  <Field label="Categoría" value={wo.vehicle_type_id} />
                  <Field label="Marca / Modelo" value={wo.vehicle_brand_model} />
                  <Field label="Año" value={wo.vehicle_year} />
                  <Field label="Color" value={wo.vehicle_color} />
                  <Field label="Kilometraje" value={wo.vehicle_mileage} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Servicio</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <Field label="Segmento" value={wo.service_segment_id} />
                  <Field label="Tipo de servicio" value={wo.service_type_id} />
                  <Field label="Operario asignado" value={wo.assigned_operator_id} />
                  <Field label="Motivo de espera" value={wo.pending_reason} />
                  <div className="col-span-2 space-y-0.5">
                    <p className="text-xs text-muted-foreground">Descripción del trabajo</p>
                    <p className="text-sm whitespace-pre-wrap">{wo.description || "—"}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Entrega y Facturación</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <Field label="Fecha de entrega" value={fmtDate(wo.delivery_date)} />
                  <Field label="Firmado por" value={wo.delivery_signed_by} />
                  <Field label="Firma registrada" value={fmtDateTime(wo.delivery_signed_at)} />
                  <Field label="Nº comprobante" value={wo.invoice_number} />
                  <Field label="Fecha factura" value={fmtDate(wo.invoice_date)} />
                  <Field
                    label="Monto facturado"
                    value={wo.invoice_amount ? moneyFmt.format(wo.invoice_amount) : undefined}
                  />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Ítems ({wo.items?.length ?? 0})</CardTitle>
              </CardHeader>
              <CardContent>
                {wo.items && wo.items.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Precio unitario</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wo.items.map((item, i) => (
                        <TableRow key={item.name ?? i}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{moneyFmt.format(item.unit_price_net)}</TableCell>
                          <TableCell>{moneyFmt.format(item.amount_net ?? 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin ítems cargados.</p>
                )}
                <p className="mt-3 text-right text-sm font-medium">
                  Total neto: {moneyFmt.format(wo.total_net || 0)}
                </p>
              </CardContent>
            </Card>

            {session && (
              <EvidenceCard
                workOrder={wo}
                policies={evidencePolicies}
                canEdit={can(session.role, "uploadEvidence") && !EVIDENCE_LOCKED_STATUSES.includes(wo.status)}
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle>Historial de eventos ({wo.events?.length ?? 0})</CardTitle>
              </CardHeader>
              <CardContent>
                {wo.events && wo.events.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>De</TableHead>
                        <TableHead>A</TableHead>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wo.events.map((ev, i) => (
                        <TableRow key={ev.name ?? i}>
                          <TableCell>{fmtDateTime(ev.event_datetime)}</TableCell>
                          <TableCell>{ev.from_status || "—"}</TableCell>
                          <TableCell>{ev.to_status}</TableCell>
                          <TableCell>{ev.user_name || ev.user_id || "—"}</TableCell>
                          <TableCell>{ev.reason || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin eventos registrados.</p>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
