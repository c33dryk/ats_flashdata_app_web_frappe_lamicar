"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Estado del panel lateral de OT de una pantalla (Operaciones, Facturación…). La OT abierta vive
 * en la URL (?ot=): se puede compartir el link y "atrás" cierra el panel. pushState/replaceState
 * se sincronizan con useSearchParams sin volver a pedir la página al server.
 */
export function useOrderPanel() {
  const openOt = useSearchParams().get("ot");
  const [panelAction, setPanelAction] = useState<string | undefined>();

  const openOrder = useCallback((name: string, action?: string) => {
    setPanelAction(action);
    const url = new URL(window.location.href);
    url.searchParams.set("ot", name);
    window.history.pushState(null, "", url);
  }, []);

  const closeOrder = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("ot");
    window.history.replaceState(null, "", url);
  }, []);

  /** Click normal abre el panel; Ctrl/Cmd/Shift/medio-click deja que el link abra otra pestaña. */
  const onOrderLinkClick = useCallback(
    (e: React.MouseEvent, name: string) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      openOrder(name);
    },
    [openOrder]
  );

  return { openOt, panelAction, openOrder, closeOrder, onOrderLinkClick };
}
