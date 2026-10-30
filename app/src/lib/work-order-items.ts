import type { WoServiceType, WorkOrderItem } from "./frappe/work-orders";

// Ítems de OT (tabla hija `Work Order Item`) que llegan del form como JSON en un input hidden.
// Lo usan el alta y la edición (Server Actions). El neto de cada ítem y el total se calculan acá
// porque Frappe no tiene controller que los sume (ver .claude/PROJECT.md).

/** Ítems válidos (sin filas vacías), o null si el JSON no es válido. */
export function parseItems(raw: string | undefined): WorkOrderItem[] | null {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const items: WorkOrderItem[] = [];
  for (const row of parsed) {
    if (typeof row !== "object" || row === null) return null;
    const r = row as Record<string, unknown>;
    const description = typeof r.description === "string" ? r.description.trim() : "";
    if (!description) continue;
    const quantity = Number(r.quantity);
    const unitPriceNet = Number(r.unit_price_net);
    if (!Number.isFinite(quantity) || quantity <= 0) return null;
    if (!Number.isFinite(unitPriceNet) || unitPriceNet < 0) return null;

    items.push({
      name: typeof r.name === "string" && r.name ? r.name : undefined,
      service_type_id: typeof r.service_type_id === "string" && r.service_type_id ? r.service_type_id : undefined,
      description,
      quantity,
      unit_price_net: unitPriceNet,
      amount_net: Math.round(quantity * unitPriceNet * 100) / 100,
    });
  }
  return items;
}

/** Total neto de los ítems, redondeado a centavos. */
export function sumItems(items: WorkOrderItem[]): number {
  return Math.round(items.reduce((acc, it) => acc + (it.amount_net ?? 0), 0) * 100) / 100;
}

/**
 * Precios de ítems cargados por quien no ve importes (técnico): nunca los manda el navegador.
 * Un ítem que ya existía conserva su precio (por `name`); uno nuevo del catálogo toma el precio de
 * lista de su tipo de trabajo; uno libre queda en $0 para que lo valorice recepción.
 */
export function applyServerPrices(
  items: WorkOrderItem[],
  previous: WorkOrderItem[],
  serviceTypes: WoServiceType[]
): WorkOrderItem[] {
  const previousPrice = new Map(previous.map((it) => [it.name, it.unit_price_net]));
  const listPrice = new Map(serviceTypes.map((s) => [s.name, s.suggested_price ?? 0]));
  return items.map((it) => {
    const price =
      (it.name && previousPrice.get(it.name)) || (it.service_type_id && listPrice.get(it.service_type_id)) || 0;
    return { ...it, unit_price_net: price, amount_net: Math.round(it.quantity * price * 100) / 100 };
  });
}
