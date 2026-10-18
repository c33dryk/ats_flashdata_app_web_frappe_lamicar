"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { transitionWorkOrderAction, type TransitionState } from "@/app/work-orders/[id]/actions";
import {
  ALLOWED_TRANSITIONS,
  COMMAND_ROLES,
  type WorkOrder,
  type WorkOrderCommand,
} from "@/lib/frappe/work-orders";
import type { AppRole } from "@/lib/auth-shared";

const COMMAND_LABELS: Record<WorkOrderCommand, string> = {
  start: "Iniciar",
  mark_pending: "Marcar Pendiente",
  finish: "Terminar",
  deliver: "Entregar",
  invoice: "Facturar",
  cancel: "Anular",
};

const initialState: TransitionState = { error: null };

export function WorkOrderActions({
  workOrder,
  role,
  initialPanel,
  onSuccess,
}: {
  workOrder: WorkOrder;
  role: AppRole;
  /** Panel a abrir de entrada (?accion=deliver desde el kanban), si el comando está disponible. */
  initialPanel?: string;
  /** Se llama cuando una transición terminó bien (el panel lateral recarga la OT). */
  onSuccess?: () => void;
}) {
  const [state, dispatch, pending] = useActionState(transitionWorkOrderAction, initialState);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) onSuccess?.();
    wasPending.current = pending;
  }, [pending, state, onSuccess]);

  const availableCommands = (
    Object.entries(ALLOWED_TRANSITIONS[workOrder.status] ?? {}) as [WorkOrderCommand, string][]
  )
    .map(([cmd]) => cmd)
    .filter((cmd) => COMMAND_ROLES[cmd].includes(role));

  const [activePanel, setActivePanel] = useState<WorkOrderCommand | null>(() =>
    availableCommands.find((c) => c === initialPanel && c !== "start" && c !== "finish") ?? null
  );

  function baseFormData(command: WorkOrderCommand) {
    const fd = new FormData();
    fd.set("order_id", workOrder.name);
    fd.set("command", command);
    fd.set("expected_modified", workOrder.modified ?? "");
    return fd;
  }

  function runSimple(command: WorkOrderCommand) {
    dispatch(baseFormData(command));
  }

  if (availableCommands.length === 0) return null;

  return (
    <div className="space-y-3">
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {availableCommands.map((cmd) => (
          <Button
            key={cmd}
            type="button"
            variant={cmd === "cancel" ? "destructive" : "brand"}
            disabled={pending}
            onClick={() => {
              if (cmd === "start" || cmd === "finish") {
                setActivePanel(null);
                runSimple(cmd);
              } else {
                setActivePanel(activePanel === cmd ? null : cmd);
              }
            }}
          >
            {COMMAND_LABELS[cmd]}
          </Button>
        ))}
      </div>

      {activePanel === "mark_pending" && (
        <ReasonPanel
          title="Marcar Pendiente"
          fieldLabel="Motivo de espera"
          pending={pending}
          onCancel={() => setActivePanel(null)}
          onConfirm={(reason) => {
            const fd = baseFormData("mark_pending");
            fd.set("reason", reason);
            dispatch(fd);
            setActivePanel(null);
          }}
        />
      )}

      {activePanel === "cancel" && (
        <ReasonPanel
          title="Anular Orden de Trabajo"
          fieldLabel="Motivo de anulación"
          pending={pending}
          onCancel={() => setActivePanel(null)}
          onConfirm={(reason) => {
            const fd = baseFormData("cancel");
            fd.set("reason", reason);
            dispatch(fd);
            setActivePanel(null);
          }}
        />
      )}

      {activePanel === "invoice" && (
        <InvoicePanel
          defaultAmount={workOrder.total_net}
          pending={pending}
          onCancel={() => setActivePanel(null)}
          onConfirm={(fields) => {
            const fd = baseFormData("invoice");
            fd.set("invoice_number", fields.number);
            fd.set("invoice_date", fields.date);
            fd.set("invoice_amount", fields.amount);
            dispatch(fd);
            setActivePanel(null);
          }}
        />
      )}

      {activePanel === "deliver" && (
        <DeliverPanel
          defaultSignedBy={workOrder.customer_name}
          pending={pending}
          onCancel={() => setActivePanel(null)}
          onConfirm={(fields) => {
            const fd = baseFormData("deliver");
            fd.set("signed_by", fields.signedBy);
            fd.set("signature_data_url", fields.signatureDataUrl);
            dispatch(fd);
            setActivePanel(null);
          }}
        />
      )}
    </div>
  );
}

function ReasonPanel({
  title,
  fieldLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  title: string;
  fieldLabel: string;
  pending: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="reason">{fieldLabel} *</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={pending || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            Confirmar
          </Button>
          <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InvoicePanel({
  defaultAmount,
  pending,
  onConfirm,
  onCancel,
}: {
  defaultAmount?: number;
  pending: boolean;
  onConfirm: (fields: { number: string; date: string; amount: string }) => void;
  onCancel: () => void;
}) {
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : "");

  const valid = number.trim() && date && Number(amount) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar Facturación</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="invoice_number">Nº comprobante *</Label>
          <Input id="invoice_number" value={number} onChange={(e) => setNumber(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="invoice_date">Fecha *</Label>
          <Input
            id="invoice_date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="invoice_amount">Monto *</Label>
          <Input
            id="invoice_amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="col-span-3 flex gap-2">
          <Button
            type="button"
            disabled={pending || !valid}
            onClick={() => onConfirm({ number: number.trim(), date, amount })}
          >
            Confirmar
          </Button>
          <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DeliverPanel({
  defaultSignedBy,
  pending,
  onConfirm,
  onCancel,
}: {
  defaultSignedBy: string;
  pending: boolean;
  onConfirm: (fields: { signedBy: string; signatureDataUrl: string }) => void;
  onCancel: () => void;
}) {
  const [signedBy, setSignedBy] = useState(defaultSignedBy);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  function pos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const point = "touches" in e ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function start(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { x, y } = pos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawingRef.current = true;
  }

  function move(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { x, y } = pos(e, canvas);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  }

  function stop() {
    drawingRef.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrega de Vehículo y Conformidad de Remito</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="signed_by">Firmado por *</Label>
          <Input id="signed_by" value={signedBy} onChange={(e) => setSignedBy(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Firma *</Label>
          <canvas
            ref={canvasRef}
            width={400}
            height={150}
            className="w-full max-w-md touch-none rounded-md border border-input bg-white"
            onMouseDown={start}
            onMouseMove={move}
            onMouseUp={stop}
            onMouseLeave={stop}
            onTouchStart={start}
            onTouchMove={move}
            onTouchEnd={stop}
          />
          <Button type="button" variant="outline" size="sm" onClick={clear}>
            Borrar firma
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={pending || !signedBy.trim() || !hasSignature}
            onClick={() =>
              onConfirm({
                signedBy: signedBy.trim(),
                signatureDataUrl: canvasRef.current?.toDataURL("image/png") ?? "",
              })
            }
          >
            Confirmar Entrega
          </Button>
          <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
