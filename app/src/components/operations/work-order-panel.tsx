"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Car,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  ExternalLink,
  FileWarning,
  Hash,
  Link2,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Receipt,
  User,
  Wrench,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { segmentedGroupClass, segmentedItemClass } from "@/components/ui/segmented";
import { toast } from "@/components/ui/toast";
import { EvidenceChecklist } from "@/components/work-orders/evidence-checklist";
import { StatusBadge } from "@/components/work-orders/status-badge";
import { WorkOrderActions } from "@/components/work-orders/work-order-actions";
import { labelOf, type DashboardCatalogs } from "@/lib/dashboard-metrics";
import { EVIDENCE_LOCKED_STATUSES, requirementCount } from "@/lib/evidence";
import { fmtMoney } from "@/lib/format";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/auth-shared";
import type { WoEvidencePolicy, WorkOrder, WorkOrderStatus } from "@/lib/frappe/work-orders";

// Panel lateral de una OT (estilo "task panel" de ClickUp): barra superior con ruta y accesos,
// estado + avance del flujo, propiedades en filas con ícono, pestañas (Fotos y archivos /
// Trabajos / Actividad) y las acciones de estado fijas abajo. En el celular ocupa la pantalla.
//
// Los datos se piden a GET /api/work-orders/:id al abrir (no viajan con la lista). El padre lo
// monta con key={nombre de OT}, así cada OT arranca con estado limpio.

type Tab = "files" | "items" | "activity";

const FLOW: WorkOrderStatus[] = ["Nueva", "En Curso", "Terminada", "Entregada", "Facturada"];

interface PanelData {
  workOrder: WorkOrder;
  policies: WoEvidencePolicy[];
}

async function fetchPanel(name: string): Promise<{ data?: PanelData; error?: string }> {
  try {
    const res = await fetch(`/api/work-orders/${encodeURIComponent(name)}`, { cache: "no-store" });
    const json = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
    if (!res.ok || !json?.workOrder) return { error: json?.error ?? "Tu sesión expiró. Volvé a entrar." };
    return { data: json };
  } catch {
    return { error: "No se pudo conectar. Revisá la conexión." };
  }
}

function fmtDateTime(value?: string) {
  if (!value) return "—";
  const d = new Date(value.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function fmtDate(value?: string) {
  if (!value) return "—";
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("es-AR");
}

export function WorkOrderPanel({
  name,
  role,
  catalogs,
  initialAction,
  onClose,
}: {
  name: string;
  role: AppRole;
  catalogs: DashboardCatalogs;
  /** Panel de acción a abrir de entrada (ej. "deliver" al soltar en Entregada en el kanban). */
  initialAction?: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<PanelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("files");
  const panelRef = useRef<HTMLElement>(null);

  // Cada incremento vuelve a pedir la OT (tras una transición, un borrado o un conflicto).
  const [reloadTick, setReloadTick] = useState(0);
  const load = () => setReloadTick((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    fetchPanel(name).then((r) => {
      if (cancelled) return;
      setError(r.error ?? null);
      if (r.data) setData(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [name, reloadTick]);

  // Foco al panel al abrir; Esc cierra (salvo que haya un modal abierto encima).
  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const wo = data?.workOrder;

  async function copyLink() {
    const url = new URL(window.location.href);
    url.searchParams.set("ot", name);
    try {
      await navigator.clipboard.writeText(url.toString());
      toast.add({ title: "Link copiado", type: "success" });
    } catch {
      toast.add({ title: "No se pudo copiar el link", type: "error" });
    }
  }

  return (
    <>
      {/* Fondo atenuado (escritorio): marca que se está trabajando en el panel; clic afuera cierra. */}
      <div className="fixed inset-0 z-40 hidden bg-black/25 sm:block dark:bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label={`Orden ${name}`}
        className="fixed inset-0 z-50 flex flex-col bg-card shadow-2xl outline-none sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[min(720px,100vw)] sm:border-l sm:border-border"
      >
        {/* Barra superior: misma altura que el Topbar de la app (h-14) para que las líneas coincidan */}
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
          <nav className="flex min-w-0 flex-1 items-center gap-1 text-sm text-muted-foreground" aria-label="Ruta">
            <span className="hidden sm:inline">Operaciones</span>
            <ChevronRight className="hidden size-3.5 sm:inline" />
            <span className="truncate font-medium text-foreground">{name}</span>
          </nav>
          <Button type="button" variant="ghost" size="icon-sm" onClick={copyLink} title="Copiar link" aria-label="Copiar link">
            <Link2 className="size-4" />
          </Button>
          <Link
            href={`/work-orders/${name}`}
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            title="Abrir en página completa"
            aria-label="Abrir en página completa"
          >
            <ExternalLink className="size-4" />
          </Link>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} title="Cerrar (Esc)" aria-label="Cerrar">
            <X className="size-4" />
          </Button>
        </div>

        {!wo ? (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
            {error ? (
              <div className="space-y-3 text-center">
                <p className="text-destructive">{error}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => load()}>
                  Reintentar
                </Button>
              </div>
            ) : (
              <Loader2 className="size-6 animate-spin" aria-label="Cargando" />
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-5 px-4 py-4 sm:px-6">
                {/* Encabezado */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold tracking-tight">{wo.name}</h2>
                    <StatusBadge status={wo.status} />
                    {wo.siniestro && (
                      <span className="text-xs text-muted-foreground">Siniestro {wo.siniestro}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {wo.customer_name} · <span className="font-mono">{wo.license_plate}</span>
                    {wo.vehicle_brand_model && ` · ${wo.vehicle_brand_model}`}
                  </p>
                  <FlowStepper status={wo.status} />
                </div>

                {wo.status === "Pendiente" && wo.pending_reason && (
                  <p className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
                    <strong>En espera:</strong> {wo.pending_reason}
                  </p>
                )}

                {/* Propiedades (filas con ícono, estilo ClickUp) */}
                <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  <Prop icon={Wrench} label="Técnico" value={labelOf(catalogs.operators, wo.assigned_operator_id) ?? "Sin asignar"} />
                  <Prop
                    icon={ClipboardList}
                    label="Servicio"
                    value={[labelOf(catalogs.segments, wo.service_segment_id), labelOf(catalogs.services, wo.service_type_id)]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  />
                  <Prop
                    icon={User}
                    label="Cliente"
                    value={`${wo.customer_name}${labelOf(catalogs.customerTypes, wo.customer_type_id) ? ` (${labelOf(catalogs.customerTypes, wo.customer_type_id)})` : ""}`}
                  />
                  <Prop
                    icon={Phone}
                    label="Teléfono"
                    value={wo.customer_phone ? <a href={`tel:${wo.customer_phone}`} className="hover:underline">{wo.customer_phone}</a> : "—"}
                  />
                  <Prop
                    icon={Mail}
                    label="Email"
                    value={wo.customer_email ? <a href={`mailto:${wo.customer_email}`} className="hover:underline">{wo.customer_email}</a> : "—"}
                  />
                  <Prop
                    icon={Car}
                    label="Vehículo"
                    value={[
                      labelOf(catalogs.vehicleTypes, wo.vehicle_type_id),
                      wo.vehicle_year,
                      wo.vehicle_color,
                      wo.vehicle_mileage && `${wo.vehicle_mileage} km`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  />
                  <Prop icon={CircleDollarSign} label="Total neto" value={fmtMoney(wo.total_net || 0)} />
                  <Prop icon={Calendar} label="Alta" value={fmtDateTime(wo.creation)} />
                  {(wo.delivery_signed_at || wo.delivery_date) && (
                    <Prop
                      icon={Hash}
                      label="Entrega"
                      value={`${fmtDate(wo.delivery_date)}${wo.delivery_signed_by ? ` · firmó ${wo.delivery_signed_by}` : ""}`}
                    />
                  )}
                  {wo.invoice_number && (
                    <Prop
                      icon={Receipt}
                      label="Factura"
                      value={`${wo.invoice_number} · ${fmtDate(wo.invoice_date)} · ${fmtMoney(wo.invoice_amount || 0)}`}
                    />
                  )}
                </dl>

                {wo.description && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Descripción</p>
                    <p className="text-sm whitespace-pre-line">{wo.description}</p>
                  </div>
                )}

                {/* Pestañas */}
                <div className="space-y-4">
                  <div className={cn(segmentedGroupClass, "w-full sm:w-auto")} role="tablist" aria-label="Secciones">
                    {(
                      [
                        ["files", `Fotos y archivos ${filesBadge(wo, data!.policies)}`],
                        ["items", `Trabajos (${wo.items?.length ?? 0})`],
                        ["activity", `Actividad (${wo.events?.length ?? 0})`],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={tab === key}
                        onClick={() => setTab(key)}
                        className={cn(segmentedItemClass(tab === key), "flex-1 sm:flex-none")}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {tab === "files" && (
                    <EvidenceChecklist
                      workOrder={wo}
                      policies={data!.policies}
                      canEdit={can(role, "uploadEvidence") && !EVIDENCE_LOCKED_STATUSES.includes(wo.status)}
                      onChange={(updated) => setData((d) => (d ? { ...d, workOrder: updated } : d))}
                      onReload={() => load()}
                    />
                  )}
                  {tab === "items" && <ItemsTab wo={wo} />}
                  {tab === "activity" && <ActivityTab wo={wo} />}
                </div>
              </div>
            </div>

            {/* Acciones fijas abajo (al alcance del pulgar en el celular) */}
            <div className="max-h-[60dvh] shrink-0 overflow-y-auto border-t border-border bg-card px-4 py-3 sm:px-6">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <WorkOrderActions
                    key={wo.modified}
                    workOrder={wo}
                    role={role}
                    initialPanel={initialAction}
                    onSuccess={() => load()}
                  />
                </div>
                {can(role, "editOrder") && !EVIDENCE_LOCKED_STATUSES.includes(wo.status) && (
                  <Link href={`/work-orders/${wo.name}/edit`} className={buttonVariants({ variant: "outline" })}>
                    <Pencil className="size-4" /> Editar
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function filesBadge(wo: WorkOrder, policies: WoEvidencePolicy[]) {
  const reqs = policies[0]?.requirements ?? [];
  if (!reqs.length) return `(${wo.evidence?.length ?? 0})`;
  const met = reqs.filter((r) => requirementCount(wo, r) >= (r.min_photos ?? 1)).length;
  return `${met}/${reqs.length}`;
}

function Prop({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex min-h-9 items-center gap-3 rounded-md px-1 text-sm">
      <dt className="flex w-28 shrink-0 items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        {label}
      </dt>
      <dd className="min-w-0 truncate font-medium">{value}</dd>
    </div>
  );
}

function FlowStepper({ status }: { status: WorkOrderStatus }) {
  if (status === "Anulada") {
    return (
      <p className="flex items-center gap-2 text-sm text-destructive">
        <FileWarning className="size-4" /> Orden anulada
      </p>
    );
  }
  // Pendiente es un desvío de "En Curso": se muestra sobre ese paso.
  const current = FLOW.indexOf(status === "Pendiente" ? "En Curso" : status);
  return (
    <ol className="flex items-center gap-1" aria-label="Avance de la orden">
      {FLOW.map((step, i) => (
        <li key={step} className="flex flex-1 flex-col gap-1">
          <span
            className={cn(
              "h-1.5 rounded-full",
              i < current ? "bg-foreground/60" : i === current ? "bg-brand" : "bg-muted"
            )}
          />
          <span
            className={cn(
              "truncate text-[11px]",
              i === current ? "font-semibold text-foreground" : "text-muted-foreground"
            )}
            aria-current={i === current ? "step" : undefined}
          >
            {i === current && status === "Pendiente" ? "En espera" : step}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ItemsTab({ wo }: { wo: WorkOrder }) {
  const items = wo.items ?? [];
  if (!items.length) return <p className="text-sm text-muted-foreground">Sin ítems cargados.</p>;
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Descripción</th>
            <th className="px-3 py-2 text-right font-medium">Cant.</th>
            <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Unitario</th>
            <th className="px-3 py-2 text-right font-medium">Neto</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.name ?? i} className="border-t border-border">
              <td className="px-3 py-2">{it.description}</td>
              <td className="px-3 py-2 text-right tabular-nums">{it.quantity}</td>
              <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{fmtMoney(it.unit_price_net)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {fmtMoney(it.amount_net ?? it.quantity * it.unit_price_net)}
              </td>
            </tr>
          ))}
          <tr className="border-t border-border bg-muted/30 font-semibold">
            <td className="px-3 py-2" colSpan={2}>
              Total neto
            </td>
            <td className="hidden sm:table-cell" />
            <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(wo.total_net || 0)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ActivityTab({ wo }: { wo: WorkOrder }) {
  const events = [...(wo.events ?? [])].reverse();
  if (!events.length) return <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>;
  return (
    <ol className="space-y-3 border-l border-border pl-4">
      {events.map((ev, i) => (
        <li key={ev.name ?? i} className="relative text-sm">
          <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-foreground/40 ring-2 ring-background" />
          <p>
            <span className="font-medium">{ev.user_name || ev.user_id || "Sistema"}</span>{" "}
            <span className="text-muted-foreground">
              {ev.from_status ? `pasó de ${ev.from_status} a` : "creó en"}
            </span>{" "}
            <span className="font-medium">{ev.to_status}</span>
          </p>
          {ev.reason && <p className="text-muted-foreground">“{ev.reason}”</p>}
          <p className="text-xs text-muted-foreground">{fmtDateTime(ev.event_datetime)}</p>
        </li>
      ))}
    </ol>
  );
}
