import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { FrappeApiError } from "@/lib/frappe/client";
import { getEvidencePoliciesForCustomerType, getWorkOrder } from "@/lib/frappe/work-orders";

// GET /api/work-orders/:id — la OT completa + las políticas de evidencia de su tipo de cliente.
// La consume el panel lateral de /operaciones (client-side, para abrirlo sin recargar la lista).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });

  const { id } = await params;
  try {
    const workOrder = await getWorkOrder(id);
    const policies = await getEvidencePoliciesForCustomerType(workOrder.customer_type_id);
    return NextResponse.json({ workOrder, policies });
  } catch (err) {
    const status = err instanceof FrappeApiError ? err.status : 502;
    return NextResponse.json(
      { error: status === 404 ? "La orden no existe." : "No se pudo leer la orden de trabajo." },
      { status }
    );
  }
}
