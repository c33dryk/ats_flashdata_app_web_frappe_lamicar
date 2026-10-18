"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { StatusBadge } from "@/components/work-orders/status-badge";
import { transitionWorkOrderAction } from "@/app/work-orders/[id]/actions";
import { labelOf, type DashboardCatalogs } from "@/lib/dashboard-metrics";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/auth-shared";
import {
  ALLOWED_TRANSITIONS,
  COMMAND_ROLES,
  type DashboardWorkOrder,
  type WorkOrderCommand,
  type WorkOrderStatus,
} from "@/lib/frappe/work-orders";

// Kanban con drag & drop (dnd-kit). Las reglas NO viven acá: soltar una tarjeta en otra columna
// solo es válido si existe un comando en ALLOWED_TRANSITIONS que lleve a ese estado y el rol lo
// tiene en COMMAND_ROLES — las mismas tablas que valida transitionWorkOrderAction en el server
// (que además relee la OT y compara `modified` para no pisar cambios ajenos).
//
// Según el comando:
//   start / finish  → se aplica directo (optimista: la tarjeta se mueve ya, vuelve si falla).
//   mark_pending    → modal chico pidiendo el motivo.
//   deliver         → abre el panel lateral de la OT con el panel de firma de entrega.

/** Comando que lleva `from` → `to` para este rol, o null si el movimiento no está permitido. */
function commandFor(from: WorkOrderStatus, to: WorkOrderStatus, role: AppRole): WorkOrderCommand | null {
  const entry = (Object.entries(ALLOWED_TRANSITIONS[from] ?? {}) as [WorkOrderCommand, WorkOrderStatus][]).find(
    ([cmd, target]) => target === to && COMMAND_ROLES[cmd].includes(role)
  );
  return entry ? entry[0] : null;
}

const announcements: Announcements = {
  onDragStart: ({ active }) => `Tomaste la orden ${active.id}.`,
  onDragOver: ({ active, over }) =>
    over ? `Orden ${active.id} sobre la columna ${over.id}.` : `Orden ${active.id} fuera de las columnas.`,
  onDragEnd: ({ active, over }) =>
    over ? `Orden ${active.id} soltada en ${over.id}.` : `Orden ${active.id} soltada sin mover.`,
  onDragCancel: ({ active }) => `Movimiento de la orden ${active.id} cancelado.`,
};

export function KanbanBoard({
  rows,
  columns,
  catalogs,
  role,
  selected,
  onOpen,
  onLinkClick,
}: {
  rows: DashboardWorkOrder[];
  columns: WorkOrderStatus[];
  catalogs: DashboardCatalogs;
  role: AppRole;
  /** OT abierta en el panel (se resalta la tarjeta). */
  selected: string | null;
  onOpen: (name: string, action?: string) => void;
  onLinkClick: (e: React.MouseEvent, name: string) => void;
}) {
  const [, startTransition] = useTransition();
  const [optimisticRows, moveOptimistic] = useOptimistic(
    rows,
    (current, move: { name: string; status: WorkOrderStatus }) =>
      current.map((w) => (w.name === move.name ? { ...w, status: move.status } : w))
  );
  const [dragging, setDragging] = useState<DashboardWorkOrder | null>(null);
  const [pendingReason, setPendingReason] = useState<{ wo: DashboardWorkOrder } | null>(null);
  const [reason, setReason] = useState("");
  // Evita que el click que sigue a soltar una tarjeta (que es un <Link>) navegue al detalle.
  const justDragged = useRef(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // En touch, mantener apretado 200ms para tomar la tarjeta (si no, el gesto es scroll).
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const validTargets = dragging
    ? columns.filter((c) => c !== dragging.status && commandFor(dragging.status, c, role))
    : [];

  function run(wo: DashboardWorkOrder, command: WorkOrderCommand, target: WorkOrderStatus, why?: string) {
    startTransition(async () => {
      moveOptimistic({ name: wo.name, status: target });
      const fd = new FormData();
      fd.set("order_id", wo.name);
      fd.set("command", command);
      fd.set("expected_modified", wo.modified ?? "");
      if (why) fd.set("reason", why);
      const res = await transitionWorkOrderAction({ error: null }, fd);
      if (res.error) {
        toast.add({ title: `No se pudo mover ${wo.name}`, description: res.error, type: "error", priority: "high" });
      } else {
        toast.add({ title: `${wo.name} → ${target}`, type: "success" });
      }
    });
  }

  function onDragStart(e: DragStartEvent) {
    justDragged.current = true;
    setDragging(optimisticRows.find((w) => w.name === e.active.id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    const wo = dragging;
    setDragging(null);
    setTimeout(() => (justDragged.current = false), 0);
    if (!wo || !e.over) return;
    const target = e.over.id as WorkOrderStatus;
    if (target === wo.status) return;
    const command = commandFor(wo.status, target, role);
    if (!command) {
      toast.add({
        title: "Movimiento no permitido",
        description: `De ${wo.status} no se puede pasar a ${target} (o tu rol no tiene ese permiso).`,
        type: "error",
      });
      return;
    }
    if (command === "mark_pending") {
      setReason("");
      setPendingReason({ wo });
    } else if (command === "deliver") {
      onOpen(wo.name, "deliver");
    } else {
      run(wo, command, target);
    }
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setDragging(null);
          setTimeout(() => (justDragged.current = false), 0);
        }}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "Para mover una orden, presioná espacio o enter sobre el ícono de arrastre, usá las flechas para elegir la columna y volvé a presionar espacio para soltar. Escape cancela.",
          },
        }}
      >
        <div className="-mx-6 overflow-x-auto px-6 pb-2">
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(220px, 1fr))` }}
          >
            {columns.map((col) => (
              <Column
                key={col}
                status={col}
                cards={optimisticRows.filter((w) => w.status === col)}
                catalogs={catalogs}
                role={role}
                state={!dragging ? "idle" : validTargets.includes(col) ? "valid" : col === dragging.status ? "origin" : "invalid"}
                draggingName={dragging?.name}
                justDragged={justDragged}
                selected={selected}
                onLinkClick={onLinkClick}
              />
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="rotate-1 rounded-lg bg-card p-3 shadow-lg ring-2 ring-brand">
              <CardBody wo={dragging} catalogs={catalogs} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <Modal
        open={!!pendingReason}
        onClose={() => setPendingReason(null)}
        title={`Pasar ${pendingReason?.wo.name ?? ""} a Pendiente`}
        description="Indicá por qué la orden queda en espera (repuesto, autorización del seguro, etc.)."
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pendingReason || !reason.trim()) return;
            run(pendingReason.wo, "mark_pending", "Pendiente", reason.trim());
            setPendingReason(null);
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="pending-reason">Motivo *</Label>
            <Textarea
              id="pending-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPendingReason(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!reason.trim()}>
              Pasar a Pendiente
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Column({
  status,
  cards,
  catalogs,
  role,
  state,
  draggingName,
  justDragged,
  selected,
  onLinkClick,
}: {
  status: WorkOrderStatus;
  cards: DashboardWorkOrder[];
  catalogs: DashboardCatalogs;
  role: AppRole;
  state: "idle" | "valid" | "invalid" | "origin";
  draggingName?: string;
  justDragged: React.RefObject<boolean>;
  selected: string | null;
  onLinkClick: (e: React.MouseEvent, name: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: state === "invalid" });

  return (
    <section
      ref={setNodeRef}
      aria-label={`${status}: ${cards.length} órdenes`}
      className={cn(
        "flex min-h-40 flex-col gap-2 rounded-xl bg-muted/50 p-2 transition-all",
        state === "valid" && "outline-2 outline-offset-2 outline-dashed outline-brand",
        state === "valid" && isOver && "bg-brand/10",
        state === "invalid" && "opacity-40"
      )}
    >
      <header className="flex items-center justify-between px-1 py-1">
        <StatusBadge status={status} />
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">{cards.length}</span>
      </header>
      {cards.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          {state === "valid" ? "Soltá acá" : "Sin órdenes"}
        </p>
      ) : (
        cards.map((wo) => (
          <DraggableCard
            key={wo.name}
            wo={wo}
            catalogs={catalogs}
            canDrag={Object.keys(ALLOWED_TRANSITIONS[wo.status] ?? {}).some((cmd) =>
              COMMAND_ROLES[cmd as WorkOrderCommand].includes(role)
            )}
            isDragging={draggingName === wo.name}
            isSelected={selected === wo.name}
            justDragged={justDragged}
            onLinkClick={onLinkClick}
          />
        ))
      )}
    </section>
  );
}

function DraggableCard({
  wo,
  catalogs,
  canDrag,
  isDragging,
  isSelected,
  justDragged,
  onLinkClick,
}: {
  wo: DashboardWorkOrder;
  catalogs: DashboardCatalogs;
  canDrag: boolean;
  isDragging: boolean;
  isSelected: boolean;
  justDragged: React.RefObject<boolean>;
  onLinkClick: (e: React.MouseEvent, name: string) => void;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes } = useDraggable({
    id: wo.name,
    disabled: !canDrag,
  });

  return (
    <div
      ref={setNodeRef}
      // Mouse/touch toman la tarjeta entera; el teclado, solo el ícono (así Enter sobre el link
      // sigue abriendo la OT).
      onMouseDown={listeners?.onMouseDown as React.MouseEventHandler | undefined}
      onTouchStart={listeners?.onTouchStart as React.TouchEventHandler | undefined}
      style={{ touchAction: canDrag ? "manipulation" : undefined }}
      className={cn(
        "group relative rounded-lg bg-card text-sm shadow-xs ring-1 ring-foreground/10 transition-shadow hover:shadow-md",
        canDrag && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
        isSelected && "ring-2 ring-foreground/60"
      )}
    >
      <a
        href={`/operaciones?ot=${encodeURIComponent(wo.name)}`}
        draggable={false}
        onClick={(e) => {
          if (justDragged.current) e.preventDefault();
          else onLinkClick(e, wo.name);
        }}
        className="block rounded-lg p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <CardBody wo={wo} catalogs={catalogs} />
      </a>
      {canDrag && (
        <button
          ref={setActivatorNodeRef}
          type="button"
          onKeyDown={listeners?.onKeyDown as React.KeyboardEventHandler | undefined}
          {...attributes}
          aria-label={`Mover ${wo.name}`}
          className="absolute top-2 right-1.5 rounded p-0.5 text-muted-foreground/60 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <GripVertical className="size-4" />
        </button>
      )}
    </div>
  );
}

function Plate({ value }: { value: string }) {
  return (
    <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">{value}</span>
  );
}

function CardBody({ wo, catalogs }: { wo: DashboardWorkOrder; catalogs: DashboardCatalogs }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 pr-5">
        <span className="font-semibold">{wo.name}</span>
        {wo.siniestro && (
          <span className="truncate text-[11px] text-muted-foreground">Sin. {wo.siniestro}</span>
        )}
      </div>
      <span className="font-medium">{wo.customer_name}</span>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Plate value={wo.license_plate} />
        <span className="truncate">{wo.vehicle_brand_model}</span>
      </span>
      <span className="text-xs text-muted-foreground">
        {labelOf(catalogs.services, wo.service_type_id) ?? wo.description ?? ""}
      </span>
      {wo.status === "Pendiente" && wo.pending_reason && (
        <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
          En espera: {wo.pending_reason}
        </span>
      )}
      <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5 text-xs">
        <span className="font-semibold tabular-nums">{fmtMoney(wo.total_net || 0)}</span>
        <span className="text-muted-foreground">
          {labelOf(catalogs.operators, wo.assigned_operator_id)?.split(" ")[0] ?? "Sin asignar"}
        </span>
      </div>
    </div>
  );
}
