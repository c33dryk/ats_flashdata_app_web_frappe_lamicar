"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { str } from "@/lib/form-data";
import { FrappeApiError, frappeUploadFile } from "@/lib/frappe/client";
import {
  ALLOWED_TRANSITIONS,
  COMMAND_ROLES,
  getWorkOrder,
  updateWorkOrder,
  type WoEvidence,
  type WoWorkOrderEvent,
  type WorkOrder,
  type WorkOrderCommand,
} from "@/lib/frappe/work-orders";

export interface TransitionState {
  error: string | null;
}

const EVIDENCE_LOCKED_STATUSES = ["Facturada", "Anulada"] as const;

// Campos "Datetime" de Frappe en tablas hijas se insertan tal cual contra MySQL (no pasan por la
// normalización que sí aplica a los campos de nivel superior) — necesitan literalmente
// "YYYY-MM-DD HH:MM:SS", no el "2026-08-25T23:00:00.000Z" de Date.toISOString().
function toFrappeDatetime(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function isWorkOrderCommand(value: string | undefined): value is WorkOrderCommand {
  return !!value && value in COMMAND_ROLES;
}

export async function transitionWorkOrderAction(
  _prevState: TransitionState,
  formData: FormData
): Promise<TransitionState> {
  const session = await getSession();
  if (!session) return { error: "Tu sesión expiró. Recargá la página." };

  const orderId = str(formData, "order_id");
  const command = str(formData, "command");
  const expectedModified = str(formData, "expected_modified");

  if (!orderId || !isWorkOrderCommand(command)) {
    return { error: "Solicitud inválida." };
  }

  if (!COMMAND_ROLES[command].includes(session.role)) {
    return { error: "No tenés permiso para realizar esta acción." };
  }

  let fresh: WorkOrder;
  try {
    fresh = await getWorkOrder(orderId);
  } catch {
    return { error: "No se pudo leer la orden de trabajo. Recargá la página." };
  }

  if (fresh.modified !== expectedModified) {
    return { error: "La orden fue modificada por otro usuario. Recargá la página." };
  }

  const nextStatus = ALLOWED_TRANSITIONS[fresh.status]?.[command];
  if (!nextStatus) {
    return { error: "Transición no permitida desde el estado actual. Recargá la página." };
  }

  const payload: Partial<WorkOrder> = { status: nextStatus, row_version: (fresh.row_version ?? 1) + 1 };
  let reason: string | undefined;
  const today = new Date().toISOString().slice(0, 10);

  if (command === "mark_pending") {
    reason = str(formData, "reason");
    if (!reason) return { error: "El motivo es obligatorio." };
    payload.pending_reason = reason;
  } else if (command === "cancel") {
    reason = str(formData, "reason");
    if (!reason) return { error: "El motivo es obligatorio." };
  } else if (command === "invoice") {
    const invoiceNumber = str(formData, "invoice_number");
    const invoiceDate = str(formData, "invoice_date");
    const invoiceAmountRaw = str(formData, "invoice_amount");
    const invoiceAmount = invoiceAmountRaw ? Number(invoiceAmountRaw) : NaN;
    if (!invoiceNumber || !invoiceDate || !Number.isFinite(invoiceAmount) || invoiceAmount <= 0) {
      return { error: "Nº de comprobante, fecha y monto son obligatorios." };
    }
    payload.invoice_number = invoiceNumber;
    payload.invoice_date = invoiceDate;
    payload.invoice_amount = invoiceAmount;
    // PDF de la factura: ya subido como evidencia type=invoice (POST /api/work-orders/:id/evidence).
    // Solo se acepta una URL que exista en esa OT, no cualquiera que mande el cliente.
    const invoiceFileUrl = str(formData, "invoice_file_url");
    if (invoiceFileUrl) {
      const file = (fresh.evidence ?? []).find((e) => e.type === "invoice" && e.url === invoiceFileUrl);
      if (!file) return { error: "El archivo de la factura no se encontró en la orden. Volvé a subirlo." };
      payload.invoice_file_url = file.url;
      payload.invoice_file_name = file.filename;
    }
  } else if (command === "deliver") {
    const signedBy = str(formData, "signed_by");
    const signatureDataUrl = str(formData, "signature_data_url");
    if (!signedBy || !signatureDataUrl) {
      return { error: "Firmante y firma son obligatorios." };
    }
    const base64 = signatureDataUrl.split(",").pop() ?? "";
    let fileUrl: string;
    try {
      const uploaded = await frappeUploadFile({
        filename: `firma_${orderId}.png`,
        contentBase64: base64,
        isPrivate: true,
        doctype: "Work Order",
        docname: orderId,
      });
      fileUrl = uploaded.file_url;
    } catch (err) {
      return {
        error:
          err instanceof FrappeApiError
            ? `No se pudo subir la firma (${err.status}).`
            : "No se pudo subir la firma.",
      };
    }

    const now = toFrappeDatetime(new Date());
    payload.delivery_signed_by = signedBy;
    payload.delivery_signature_url = fileUrl;
    payload.delivery_signed_at = now;
    payload.delivery_date = fresh.delivery_date || today;
    payload.delivery_note_file_name = `remito_firma_${orderId}.png`;

    const evidenceRow: WoEvidence = {
      type: "signature",
      url: fileUrl,
      filename: `firma_${orderId}.png`,
      signed_by: signedBy,
      signed_at: now,
    };
    payload.evidence = [...(fresh.evidence ?? []), evidenceRow];
  }

  const event: WoWorkOrderEvent = {
    from_status: fresh.status,
    to_status: nextStatus,
    user_id: session.userId,
    user_name: session.name,
    reason,
    event_datetime: toFrappeDatetime(new Date()),
  };
  payload.events = [...(fresh.events ?? []), event];

  try {
    await updateWorkOrder(orderId, payload);
  } catch (err) {
    return {
      error:
        err instanceof FrappeApiError
          ? ((err.body as { message?: string } | undefined)?.message ??
            `No se pudo actualizar la orden (${err.status}).`)
          : "No se pudo actualizar la orden de trabajo.",
    };
  }

  revalidatePath(`/work-orders/${orderId}`);
  revalidatePath("/work-orders");
  revalidatePath("/operaciones");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function removeEvidenceAction(
  orderId: string,
  evidenceName: string,
  expectedModified: string
): Promise<{ error: string | null }> {
  const session = await getSession();
  if (!session || !can(session.role, "uploadEvidence")) {
    return { error: "No tenés permiso para editar evidencia." };
  }

  let fresh: WorkOrder;
  try {
    fresh = await getWorkOrder(orderId);
  } catch {
    return { error: "No se pudo leer la orden de trabajo. Recargá la página." };
  }
  if (fresh.modified !== expectedModified) {
    return { error: "La orden fue modificada por otro usuario. Recargá la página." };
  }
  if (EVIDENCE_LOCKED_STATUSES.includes(fresh.status as (typeof EVIDENCE_LOCKED_STATUSES)[number])) {
    return { error: "Esta orden ya no admite editar evidencia." };
  }

  const evidence = (fresh.evidence ?? []).filter((e) => e.name !== evidenceName);
  try {
    await updateWorkOrder(orderId, { evidence });
  } catch (err) {
    return {
      error:
        err instanceof FrappeApiError
          ? ((err.body as { message?: string } | undefined)?.message ?? `No se pudo quitar la foto (${err.status}).`)
          : "No se pudo quitar la foto.",
    };
  }

  revalidatePath(`/work-orders/${orderId}`);
  return { error: null };
}
