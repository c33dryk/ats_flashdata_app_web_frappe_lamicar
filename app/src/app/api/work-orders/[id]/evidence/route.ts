import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { FrappeApiError, frappeUploadFile } from "@/lib/frappe/client";
import {
  COMMAND_ROLES,
  getWorkOrder,
  updateWorkOrder,
  type WoEvidence,
  type WorkOrder,
} from "@/lib/frappe/work-orders";
import {
  EVIDENCE_LOCKED_STATUSES,
  MAX_UPLOAD_BYTES,
  UPLOADABLE_TYPES,
  withRequirementPrefix,
} from "@/lib/evidence";

// POST /api/work-orders/:id/evidence — sube UN archivo (multipart) y lo agrega a la tabla hija
// `evidence` de la OT. Es un route handler y no una Server Action porque las Server Actions
// cortan el body en 1MB y las fotos/PDFs pesan más; además así el archivo viaja en binario, no en
// base64.
//
// Campos: file (obligatorio), type (WoEvidence.type), requirement (code del requisito de la
// política, opcional), notes, expected_modified (concurrencia: el cliente manda el `modified` que
// tiene y recibe el nuevo para la siguiente carga — por eso las cargas van de a una).
//
// type=invoice (PDF de la factura) sigue la regla de "Facturar" (COMMAND_ROLES.invoice) y solo
// con la OT en Entregada; el resto, la de cargar evidencia.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const { id } = await params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const file = form.get("file");
  const type = String(form.get("type") ?? "") as WoEvidence["type"];
  const requirement = String(form.get("requirement") ?? "").trim() || undefined;
  const notes = String(form.get("notes") ?? "").trim() || undefined;
  const expectedModified = String(form.get("expected_modified") ?? "");

  const isInvoice = type === "invoice";
  if (!(file instanceof File) || file.size === 0 || (!isInvoice && !UPLOADABLE_TYPES.has(type))) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const allowed = isInvoice ? COMMAND_ROLES.invoice.includes(session.role) : can(session.role, "uploadEvidence");
  if (!allowed) {
    return NextResponse.json({ error: "No tenés permiso para cargar este archivo." }, { status: 403 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "El archivo supera los 8 MB." }, { status: 413 });
  }

  let fresh: WorkOrder;
  try {
    fresh = await getWorkOrder(id);
  } catch {
    return NextResponse.json({ error: "No se pudo leer la orden de trabajo." }, { status: 502 });
  }
  if (fresh.modified !== expectedModified) {
    return NextResponse.json(
      { error: "La orden fue modificada por otro usuario. Se recargaron los datos; volvé a intentar." },
      { status: 409 }
    );
  }
  if (isInvoice ? fresh.status !== "Entregada" : EVIDENCE_LOCKED_STATUSES.includes(fresh.status)) {
    return NextResponse.json({ error: "Esta orden ya no admite carga de archivos." }, { status: 409 });
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80) || "archivo";
  const filename = `${id}_${requirement ?? type}_${Date.now()}_${safeName}`;
  let fileUrl: string;
  try {
    const uploaded = await frappeUploadFile({
      filename,
      content: Buffer.from(await file.arrayBuffer()),
      isPrivate: true,
      doctype: "Work Order",
      docname: id,
    });
    fileUrl = uploaded.file_url;
  } catch (err) {
    const status = err instanceof FrappeApiError ? err.status : 502;
    return NextResponse.json({ error: `No se pudo subir el archivo (${status}).` }, { status: 502 });
  }

  const row: WoEvidence = { type, zone: requirement, url: fileUrl, filename, notes };
  let updated: WorkOrder;
  try {
    updated = await updateWorkOrder(id, { evidence: [...(fresh.evidence ?? []), row] });
  } catch (err) {
    // Si `zone` no acepta el código del requisito (Select con opciones fijas), se reintenta
    // guardándolo como prefijo en las notas — ver lib/evidence.ts.
    if (requirement && err instanceof FrappeApiError && err.status === 417) {
      try {
        updated = await updateWorkOrder(id, {
          evidence: [
            ...(fresh.evidence ?? []),
            { ...row, zone: undefined, notes: withRequirementPrefix(requirement, notes) },
          ],
        });
      } catch (retryErr) {
        return saveError(retryErr);
      }
    } else {
      return saveError(err);
    }
  }

  revalidatePath(`/work-orders/${id}`);
  return NextResponse.json({ workOrder: updated });
}

function saveError(err: unknown) {
  const message =
    err instanceof FrappeApiError
      ? ((err.body as { message?: string } | undefined)?.message ?? `No se pudo guardar el archivo (${err.status}).`)
      : "No se pudo guardar el archivo.";
  return NextResponse.json({ error: message }, { status: 502 });
}
