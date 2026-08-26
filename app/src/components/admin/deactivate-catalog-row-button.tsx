"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { setCatalogRowActive } from "@/app/admin/configuracion/actions";

export function DeactivateCatalogRowButton({
  catalogKey,
  rowId,
}: {
  catalogKey: string;
  rowId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const result = await setCatalogRowActive(catalogKey, rowId, false);
    setPending(false);

    if (result.error) {
      toast.add({ title: "Error", description: result.error, type: "error", priority: "high" });
      return;
    }

    router.refresh();
    toast.add({
      title: "Fila desactivada",
      description: rowId,
      type: "success",
      actionProps: {
        children: "Deshacer",
        onClick: async () => {
          const undo = await setCatalogRowActive(catalogKey, rowId, true);
          if (undo.error) {
            toast.add({ title: "Error", description: undo.error, type: "error", priority: "high" });
            return;
          }
          router.refresh();
          toast.add({ description: "Reactivada", type: "success" });
        },
      },
    });
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size="icon-sm"
      disabled={pending}
      onClick={handleClick}
      title="Eliminar"
      aria-label="Eliminar"
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}
