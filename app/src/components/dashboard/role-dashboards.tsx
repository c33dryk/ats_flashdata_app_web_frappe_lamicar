import Link from "next/link";
import { Plus, UserRoundX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiGrid, KpiTile } from "@/components/ui/kpi-tile";
import { AgeTag, OrderListCard, OrderRow } from "@/components/dashboard/order-list";
import { OperatorPicker } from "@/components/dashboard/operator-picker";
import {
  computeBillingStats,
  computeReceptionStats,
  computeWorkshopStats,
  daysSince,
  labelOf,
  workloadByOperator,
  type DashboardCatalogs,
} from "@/lib/dashboard-metrics";
import { fmtMoney, fmtMoneyCompact } from "@/lib/format";
import type { DashboardWorkOrder } from "@/lib/frappe/work-orders";

// Tableros por rol del Dashboard: cada uno muestra solo lo que ese puesto necesita para trabajar
// hoy (ver DASHBOARD_VIEWS en lib/permissions.ts). Server Components: los números salen de
// funciones puras de lib/dashboard-metrics.ts.

const otHref = (base: string, name: string) => `${base}?ot=${encodeURIComponent(name)}`;

// ── Recepción ───────────────────────────────────────────────────────────────────

export function ReceptionDashboard({
  rows,
  catalogs,
  todayISO,
  canCreate,
}: {
  rows: DashboardWorkOrder[];
  catalogs: DashboardCatalogs;
  todayISO: string;
  canCreate: boolean;
}) {
  const s = computeReceptionStats(rows, todayISO);
  const service = (wo: DashboardWorkOrder) =>
    [labelOf(catalogs.services, wo.service_type_id), labelOf(catalogs.operators, wo.assigned_operator_id)]
      .filter(Boolean)
      .join(" · ") || undefined;

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex flex-wrap gap-2">
          <Link href="/operaciones?nueva=1" className={buttonVariants({ variant: "brand" })}>
            <Plus className="size-4" /> Nueva orden
          </Link>
          <Link href="/clientes" className={buttonVariants({ variant: "outline" })}>
            Clientes
          </Link>
          <Link href="/unidades" className={buttonVariants({ variant: "outline" })}>
            Unidades
          </Link>
        </div>
      )}

      <KpiGrid label="Indicadores de recepción">
        <KpiTile hero label="Ingresaron hoy" value={String(s.receivedToday.length)} sub="Órdenes dadas de alta hoy" />
        <KpiTile
          href="/operaciones?filtro=por-entregar"
          label="Para entregar"
          value={String(s.readyToDeliver.length)}
          sub="Terminadas: avisar al cliente"
        />
        <KpiTile
          href="/operaciones?filtro=Pendiente"
          label="En espera"
          value={String(s.waiting.length)}
          sub="Repuestos, autorización, cliente…"
        />
        <KpiTile label="Sin técnico" value={String(s.unassigned.length)} sub="Activas sin operario asignado" />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <OrderListCard
          title="Listas para entregar"
          hint="Terminadas en taller: coordinar la entrega con el cliente"
          orders={s.readyToDeliver}
          empty="No hay unidades listas para entregar."
          moreHref="/operaciones?filtro=por-entregar"
          renderRow={(wo) => (
            <OrderRow
              wo={wo}
              href={otHref("/operaciones", wo.name)}
              meta={wo.siniestro ? `Siniestro ${wo.siniestro}` : undefined}
              aside={<AgeTag days={daysSince(wo.modified, todayISO)} warn={2} danger={5} />}
            />
          )}
        />
        <OrderListCard
          title="En espera"
          hint="Lo más viejo primero"
          orders={s.waiting}
          empty="No hay órdenes en espera."
          moreHref="/operaciones?filtro=Pendiente"
          renderRow={(wo) => (
            <OrderRow
              wo={wo}
              href={otHref("/operaciones", wo.name)}
              note={wo.pending_reason || "sin motivo cargado"}
              aside={<AgeTag days={daysSince(wo.modified, todayISO)} />}
            />
          )}
        />
        <OrderListCard
          title="Sin técnico asignado"
          hint="Activas que todavía no tienen operario"
          orders={s.unassigned}
          empty="Todas las órdenes activas tienen técnico."
          renderRow={(wo) => (
            <OrderRow
              wo={wo}
              href={otHref("/operaciones", wo.name)}
              showStatus
              meta={labelOf(catalogs.services, wo.service_type_id)}
              aside={<AgeTag days={daysSince(wo.creation, todayISO)} prefix="hace" />}
            />
          )}
        />
        <OrderListCard
          title="Ingresos de hoy"
          orders={s.receivedToday}
          empty="Todavía no ingresó ninguna orden hoy."
          renderRow={(wo) => (
            <OrderRow wo={wo} href={otHref("/operaciones", wo.name)} showStatus meta={service(wo)} />
          )}
        />
      </div>
    </div>
  );
}

// ── Taller (técnico) ────────────────────────────────────────────────────────────

export function WorkshopDashboard({
  rows,
  catalogs,
  todayISO,
  operatorId,
  canPickOperator,
  notLinked,
}: {
  rows: DashboardWorkOrder[];
  catalogs: DashboardCatalogs;
  todayISO: string;
  /** Técnico cuyo tablero se muestra ("" = todo el taller, solo admin). */
  operatorId: string;
  canPickOperator: boolean;
  /** El usuario técnico no está vinculado a ningún operario (WO Operator.system_user). */
  notLinked?: boolean;
}) {
  if (notLinked) {
    return (
      <Card>
        <CardContent className="flex items-start gap-3 py-2">
          <UserRoundX className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Tu usuario no está vinculado a un operario.</p>
            <p className="text-muted-foreground">
              Pedile al administrador que en Configuración → Operarios cargue tu email en
              &quot;Usuario del sistema&quot;. Mientras tanto podés ver las órdenes en Operaciones.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const s = computeWorkshopStats(rows, operatorId);
  const all = !operatorId;
  const meta = (wo: DashboardWorkOrder) =>
    [
      labelOf(catalogs.services, wo.service_type_id),
      all && (labelOf(catalogs.operators, wo.assigned_operator_id) ?? "Sin técnico"),
      wo.description,
    ]
      .filter(Boolean)
      .join(" · ") || undefined;
  const row = (wo: DashboardWorkOrder, extra?: Partial<React.ComponentProps<typeof OrderRow>>) => (
    <OrderRow
      wo={wo}
      href={otHref("/operaciones", wo.name)}
      meta={meta(wo)}
      aside={<AgeTag days={daysSince(wo.creation, todayISO)} warn={5} danger={10} prefix="en taller" />}
      {...extra}
    />
  );
  const workload = all ? workloadByOperator(rows, catalogs.operators) : [];
  const maxLoad = Math.max(1, ...workload.map((w) => w.count));

  return (
    <div className="space-y-4">
      {canPickOperator && <OperatorPicker operators={catalogs.operators} value={operatorId} />}

      <KpiGrid label="Indicadores del taller">
        <KpiTile hero label={all ? "En curso" : "Mis trabajos en curso"} value={String(s.inProgress.length)} />
        <KpiTile label="Por empezar" value={String(s.toStart.length)} sub="Nuevas asignadas" />
        <KpiTile label="En espera" value={String(s.waiting.length)} sub="Frenadas por algún motivo" />
        <KpiTile label="Terminadas" value={String(s.finished.length)} sub="Esperando entrega" />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <OrderListCard
          title="En curso"
          orders={s.inProgress}
          limit={10}
          empty="No hay trabajos en curso."
          renderRow={(wo) => row(wo)}
        />
        <OrderListCard
          title="Por empezar"
          hint="Lo más viejo primero"
          orders={s.toStart}
          limit={10}
          empty="No hay órdenes nuevas asignadas."
          renderRow={(wo) => row(wo)}
        />
        <OrderListCard
          title="En espera"
          orders={s.waiting}
          empty="Nada en espera."
          renderRow={(wo) => row(wo, { note: wo.pending_reason || "sin motivo cargado" })}
        />
        {all ? (
          <Card>
            <CardHeader>
              <CardTitle>Carga por técnico</CardTitle>
              <p className="text-xs text-muted-foreground">Órdenes activas (nuevas, en curso y en espera)</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {workload.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay órdenes activas.</p>
              ) : (
                workload.map((w) => (
                  <div key={w.key} className="flex items-center gap-3 text-sm">
                    <span className="w-36 shrink-0 truncate">{w.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <div className="h-full rounded-full bg-foreground/70" style={{ width: `${(w.count / maxLoad) * 100}%` }} />
                    </div>
                    <span className="w-8 shrink-0 text-right font-semibold tabular-nums">{w.count}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ) : (
          <OrderListCard
            title="Terminadas"
            hint="Ya pasaron a recepción para entregar"
            orders={s.finished}
            empty="No hay terminadas pendientes de entrega."
            renderRow={(wo) => row(wo)}
          />
        )}
      </div>
    </div>
  );
}

// ── Facturación ─────────────────────────────────────────────────────────────────

export function BillingDashboard({
  rows,
  catalogs,
  todayISO,
}: {
  rows: DashboardWorkOrder[];
  catalogs: DashboardCatalogs;
  todayISO: string;
}) {
  const s = computeBillingStats(rows, todayISO);

  return (
    <div className="space-y-4">
      <KpiGrid label="Indicadores de facturación">
        <KpiTile
          hero
          href="/facturacion"
          label="Por facturar"
          value={String(s.queue.length)}
          sub="Entregadas con remito, sin factura"
        />
        <KpiTile
          href="/facturacion"
          label="Monto por facturar"
          value={fmtMoney(s.queueAmount)}
          compactValue={fmtMoneyCompact(s.queueAmount)}
          sub={`+ ${fmtMoney(s.readySoonAmount)} terminadas por entregar`}
        />
        <KpiTile
          label="Facturado este mes"
          value={fmtMoney(s.invoicedThisMonthAmount)}
          compactValue={fmtMoneyCompact(s.invoicedThisMonthAmount)}
          sub={`${s.invoicedThisMonth.length} facturas`}
        />
        <KpiTile label="Sin valorizar" value={String(s.notValued.length)} sub="Entregadas con total $0" />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OrderListCard
            title="Cola de facturación"
            hint="Entregadas sin facturar, la más vieja primero"
            orders={s.queue}
            limit={10}
            empty="No hay órdenes por facturar."
            moreHref="/facturacion"
            renderRow={(wo) => (
              <OrderRow
                wo={wo}
                href={otHref("/facturacion", wo.name)}
                meta={
                  [labelOf(catalogs.customerTypes, wo.customer_type_id), wo.siniestro && `Siniestro ${wo.siniestro}`]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
                aside={
                  <>
                    <p className="text-sm font-semibold tabular-nums">
                      {wo.total_net ? (
                        fmtMoney(wo.total_net)
                      ) : (
                        <span className="text-amber-700 dark:text-amber-300">Sin valorizar</span>
                      )}
                    </p>
                    <AgeTag days={daysSince(wo.delivery_date || wo.modified, todayISO)} warn={7} danger={15} prefix="entregada" />
                  </>
                }
              />
            )}
          />
        </div>
        <OrderListCard
          title="Facturadas recientemente"
          orders={s.recentInvoiced}
          empty="Todavía no hay órdenes facturadas."
          renderRow={(wo) => (
            <OrderRow
              wo={wo}
              href={otHref("/facturacion", wo.name)}
              aside={
                <p className="text-sm font-semibold tabular-nums">{fmtMoney(wo.invoice_amount || wo.total_net || 0)}</p>
              }
            />
          )}
        />
      </div>
    </div>
  );
}
