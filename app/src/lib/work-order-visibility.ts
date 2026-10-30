import type { AppRole } from "./auth-shared";
import type { WorkOrder } from "./frappe/work-orders";
import { can, canSeeStatus } from "./permissions";

// Recorte de datos de OT según el rol, del lado del server, ANTES de mandarlos al navegador: el
// técnico no recibe importes (total, precios de ítems, datos de la factura, PDF de la factura) ni
// OTs fuera del circuito de taller. Ocultar en la UI no alcanza: se verían en la red.
//
// Migración a Frappe: permlevel en los campos de importe (el Role técnico sin acceso a ese nivel)
// + permission_query_conditions por estado.

const AMOUNT_FIELDS = [
  "total_net",
  "invoice_amount",
  "invoice_number",
  "invoice_date",
  "invoice_file_name",
  "invoice_file_url",
] as const;

/** La OT sin importes si el rol no puede verlos (los ítems quedan con precio 0). */
export function redactOrder<T extends Partial<WorkOrder>>(role: AppRole, wo: T): T {
  if (can(role, "viewAmounts")) return wo;
  const out: T = { ...wo };
  for (const field of AMOUNT_FIELDS) delete out[field];
  if (out.items) {
    out.items = out.items.map((it) => ({ ...it, unit_price_net: 0, amount_net: undefined }));
  }
  if (out.evidence) out.evidence = out.evidence.filter((e) => e.type !== "invoice");
  return out;
}

/** Filas visibles para el rol (por estado) y sin importes si corresponde. */
export function visibleOrdersFor<T extends Partial<WorkOrder> & { status: string }>(role: AppRole, rows: T[]): T[] {
  return rows.filter((w) => canSeeStatus(role, w.status)).map((w) => redactOrder(role, w));
}
