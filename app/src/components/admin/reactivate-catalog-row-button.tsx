"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { setCatalogRowActive } from "@/app/admin/configuracion/actions";

export function ReactivateCatalogRowButton({
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
    const result = await setCatalogRowActive(catalogKey, rowId, true);
    setPending(false);

    if (result.error) {
      toast.add({ title: "Error", description: result.error, type: "error", priority: "high" });
      return;
    }

    router.refresh();
    toast.add({ title: "Fila reactivada", description: rowId, type: "success" });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      disabled={pending}
      onClick={handleClick}
      title="Reactivar"
      aria-label="Reactivar"
    >
      <RotateCcw className="size-3.5" />
    </Button>
  );
}
