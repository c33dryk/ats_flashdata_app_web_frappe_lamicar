import { NextResponse } from "next/server";
import { strToU8, zipSync, type Zippable } from "fflate";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { frappeFetchFile } from "@/lib/frappe/client";
import { getWorkOrder, type WorkOrder } from "@/lib/frappe/work-orders";
import { EVIDENCE_TYPE_LABEL, visibleNotes } from "@/lib/evidence";
import { fmtMileage, todayInShopTZ } from "@/lib/format";

// GET /api/expedientes?ot=OT-1&ot=OT-2 — descarga un ZIP con el expediente de cada OT: una
// carpeta por OT con resumen.txt + todos sus archivos reales (fotos, firma, factura) bajados de
// Frappe con el service account. Reemplaza al "ZIP" del MVP, que solo tenía fichas de texto.
//
// Solo se bajan archivos de Frappe (/files, /private/files). URLs externas (datos de ejemplo del
// MVP) se listan en enlaces_externos.txt en vez de pedirlas desde el server (evita SSRF).
//
// Migración a Frappe: whitelisted method que arme el ZIP server-side con frappe.get_doc + File.

const MAX_ORDERS = 50;

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !can(session.role, "exportDossier")) {
    return NextResponse.json({ error: "No tenés permiso para descargar expedientes." }, { status: 403 });
  }

  const names = [...new Set(new URL(req.url).searchParams.getAll("ot").filter(Boolean))];
  if (names.length === 0) return NextResponse.json({ error: "No se indicaron órdenes." }, { status: 400 });
  if (names.length > MAX_ORDERS) {
    return NextResponse.json({ error: `Máximo ${MAX_ORDERS} órdenes por descarga.` }, { status: 400 });
  }

  const files: Zippable = {};
  for (const name of names) {
    const folder = safe(name);
    let wo: WorkOrder;
    try {
      wo = await getWorkOrder(name);
    } catch {
      files[`${folder}/ERROR.txt`] = strToU8(`No se pudo leer la orden ${name} desde Frappe.\n`);
      continue;
    }

    files[`${folder}/resumen.txt`] = strToU8(summary(wo));

    const external: string[] = [];
    const used = new Set<string>();
    await Promise.all(
      (wo.evidence ?? []).map(async (ev, i) => {
        const label = `${String(i + 1).padStart(2, "0")}_${safe(EVIDENCE_TYPE_LABEL[ev.type] ?? ev.type)}`;
        if (!/^\/(private\/)?files\//.test(ev.url)) {
          external.push(`${label}: ${ev.url}`);
          return;
        }
        try {
          const { buffer } = await frappeFetchFile(ev.url);
          let path = `${folder}/${label}_${safe(ev.filename || ev.url.split("/").pop() || "archivo")}`;
          while (used.has(path)) path = path.replace(/(\.[^.]*)?$/, "_1$1");
          used.add(path);
          files[path] = new Uint8Array(buffer);
        } catch {
          files[`${folder}/${label}_ERROR.txt`] = strToU8(`No se pudo bajar ${ev.url}\n`);
        }
      })
    );
    if (external.length) files[`${folder}/enlaces_externos.txt`] = strToU8(external.sort().join("\n") + "\n");
  }

  // level 0: fotos y PDFs ya vienen comprimidos; recomprimir solo gasta CPU.
  const zip = zipSync(files, { level: 0 });
  const filename = names.length === 1 ? `expediente_${safe(names[0])}.zip` : `expedientes_${todayInShopTZ()}.zip`;
  return new NextResponse(new Blob([zip], { type: "application/zip" }), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/** Nombre seguro para rutas dentro del ZIP. */
function safe(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_").slice(-100);
}

function summary(wo: WorkOrder): string {
  const money = (v?: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(v || 0);
  const vehicleExtra = [wo.vehicle_year, wo.vehicle_color, fmtMileage(wo.vehicle_mileage)]
    .filter(Boolean)
    .join(" · ");
  // null = dato opcional ausente (se omite la línea); "" = línea en blanco entre secciones.
  const lines: Array<string | null> = [
    `ORDEN DE TRABAJO ${wo.name}`,
    `Estado: ${wo.status}`,
    wo.siniestro ? `Siniestro: ${wo.siniestro}` : null,
    `Alta: ${wo.creation ?? "—"}`,
    "",
    "CLIENTE",
    `  ${wo.customer_name}`,
    wo.customer_phone ? `  Tel: ${wo.customer_phone}` : null,
    wo.customer_email ? `  Email: ${wo.customer_email}` : null,
    "",
    "VEHÍCULO",
    `  Patente: ${wo.license_plate}`,
    wo.vehicle_brand_model ? `  ${wo.vehicle_brand_model}` : null,
    vehicleExtra ? `  ${vehicleExtra}` : null,
    "",
    "TRABAJOS",
    ...(wo.items?.length
      ? wo.items.map((it) => `  ${it.quantity} x ${it.description} — ${money(it.amount_net ?? it.quantity * it.unit_price_net)}`)
      : ["  (sin ítems)"]),
    `  TOTAL NETO: ${money(wo.total_net)}`,
    "",
    "ENTREGA",
    wo.delivery_signed_at ? `  Firmó ${wo.delivery_signed_by ?? "—"} el ${wo.delivery_signed_at}` : "  Sin entrega registrada",
    "",
    "FACTURA",
    wo.invoice_number
      ? `  Nº ${wo.invoice_number} · ${wo.invoice_date ?? "—"} · ${money(wo.invoice_amount)}`
      : "  Sin facturar",
    "",
    "ARCHIVOS",
    ...((wo.evidence ?? []).length
      ? (wo.evidence ?? []).map(
          (ev, i) =>
            `  ${String(i + 1).padStart(2, "0")}. ${EVIDENCE_TYPE_LABEL[ev.type] ?? ev.type}${visibleNotes(ev) ? ` — ${visibleNotes(ev)}` : ""}`
        )
      : ["  (sin archivos)"]),
    "",
    "HISTORIAL",
    ...((wo.events ?? []).map(
      (ev) => `  ${ev.event_datetime ?? ""} ${ev.from_status ?? "—"} → ${ev.to_status} (${ev.user_name ?? ev.user_id ?? ""})${ev.reason ? ` "${ev.reason}"` : ""}`
    )),
  ];
  return lines.filter((l) => l !== null).join("\n") + "\n";
}
