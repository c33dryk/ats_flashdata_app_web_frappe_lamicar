import Link from "next/link";
import { StatusBadge } from "@/components/work-orders/status-badge";
import type { OrderRef } from "@/lib/clients-shared";
import type { WorkOrderStatus } from "@/lib/frappe/work-orders";

// OTs de un cliente o de una unidad (más nuevas primero). Cada una abre el panel de la OT en
// `orderBase` (Operaciones, o Facturación para quien no ve el taller).
export function OrderList({
  orders,
  orderBase,
  show,
}: {
  orders: OrderRef[];
  orderBase: string;
  /** Qué mostrar junto al número: la patente (ficha de cliente) o el cliente (ficha de unidad). */
  show: "plate" | "customer";
}) {
  if (orders.length === 0) return <p className="text-sm text-muted-foreground">Sin órdenes de trabajo.</p>;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {orders.map((o) => (
        <li key={o.name}>
          <Link
            href={`${orderBase}?ot=${encodeURIComponent(o.name)}`}
            className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50"
          >
            <span className="font-medium">{o.name}</span>
            <StatusBadge status={o.status as WorkOrderStatus} />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {show === "plate" ? o.license_plate : o.customer_name}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {o.creation ? new Date(o.creation.replace(" ", "T")).toLocaleDateString("es-AR") : ""}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
