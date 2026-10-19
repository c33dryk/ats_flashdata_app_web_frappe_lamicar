"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Modal sobre <dialog> nativo (showModal): el navegador ya resuelve foco atrapado, Esc para cerrar,
// capa encima de todo y fondo inerte. Se eligió en vez de instalar el Dialog de shadcn
// (@base-ui/react) para no sumar un componente sin probar — ver .claude/PROJECT.md.
export function Modal({
  open,
  onClose,
  title,
  description,
  className,
  fullScreen = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  className?: string;
  /** Ocupa toda la pantalla (ej. firmar la entrega); el contenido se estira al alto disponible. */
  fullScreen?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      // Esc dispara "cancel": lo cerramos vía estado del padre para que open quede sincronizado.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // Click en el fondo (fuera del contenido) cierra.
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "overflow-hidden bg-background p-0 text-foreground backdrop:bg-black/50",
        fullScreen
          ? "m-0 h-dvh max-h-none w-screen max-w-none"
          : "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg rounded-xl shadow-xl ring-1 ring-foreground/10",
        className
      )}
    >
      {open && (
        <div className={cn("flex flex-col", fullScreen ? "h-full" : "max-h-[calc(100dvh-2rem)]")}>
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <h2 className="text-base font-semibold">{title}</h2>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-md p-1 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className={cn("px-5 py-4", fullScreen ? "flex min-h-0 flex-1 flex-col" : "overflow-y-auto")}>
            {children}
          </div>
        </div>
      )}
    </dialog>
  );
}
