"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EvidenceChecklist } from "@/components/work-orders/evidence-checklist";
import type { WoEvidencePolicy, WorkOrder } from "@/lib/frappe/work-orders";

// "Fotos y archivos" en la página completa de la OT (/work-orders/[id]): el mismo checklist que el
// panel lateral; tras cada carga/borrado se refresca la página (los datos vienen del server).
export function EvidenceCard({
  workOrder,
  policies,
  canEdit,
}: {
  workOrder: WorkOrder;
  policies: WoEvidencePolicy[];
  canEdit: boolean;
}) {
  const router = useRouter();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fotos y archivos</CardTitle>
      </CardHeader>
      <CardContent>
        <EvidenceChecklist
          workOrder={workOrder}
          policies={policies}
          canEdit={canEdit}
          onChange={() => router.refresh()}
          onReload={() => router.refresh()}
        />
      </CardContent>
    </Card>
  );
}
