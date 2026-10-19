"use client";

import { useEffect, useRef } from "react";
import { ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Panel lateral (patrón único de la app para ver/crear/editar sin salir de la pantalla, estilo
// ClickUp). En escritorio se desliza desde la derecha sobre la lista atenuada (clic afuera
// cierra); en el celular ocupa toda la pantalla. Esc cierra salvo que haya un <dialog> abierto
// encima (visor de fotos, motivo de pendiente). Se monta solo mientras está abierto.

export function SidePanel({
  section,
  title,
  actions,
  footer,
  onClose,
  className,
  children,
}: {
  /** Primer tramo de la ruta en la barra superior (pantalla de origen). */
  section: string;
  /** Segundo tramo: qué se está viendo o creando. */
  title: string;
  /** Botones extra en la barra superior, a la izquierda del de cerrar. */
  actions?: React.ReactNode;
  /** Zona fija abajo (acciones principales, al alcance del pulgar en el celular). */
  footer?: React.ReactNode;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 hidden bg-black/25 sm:block dark:bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label={`${section}: ${title}`}
        className={cn(
          "fixed inset-0 z-50 flex flex-col bg-card shadow-2xl outline-none sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[min(720px,100vw)] sm:border-l sm:border-border",
          className
        )}
      >
        {/* Misma altura que el Topbar de la app (h-14) para que las líneas coincidan */}
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
          <nav className="flex min-w-0 flex-1 items-center gap-1 text-sm text-muted-foreground" aria-label="Ruta">
            <span className="hidden sm:inline">{section}</span>
            <ChevronRight className="hidden size-3.5 sm:inline" />
            <span className="truncate font-medium text-foreground">{title}</span>
          </nav>
          {actions}
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} title="Cerrar (Esc)" aria-label="Cerrar">
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="max-h-[60dvh] shrink-0 overflow-y-auto border-t border-border bg-card px-4 py-3 sm:px-6">
            {footer}
          </div>
        )}
      </aside>
    </>
  );
}
