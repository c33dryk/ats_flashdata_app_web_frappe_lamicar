"use client"

import { Toast } from "@base-ui/react/toast"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

// Instancia compartida del manager de toasts — importable desde cualquier client component sin
// depender de contexto ("toast.add(...)" funciona aunque el componente que lo llama no esté
// dentro de <Toast.Provider>; el Provider solo se suscribe a esta instancia para saber qué
// renderizar). Mismo patrón/API que expone el registry de shadcn (style "base"):
// import { toast } from "@/components/ui/toast"; toast.add({ description, type }).
export const toast = Toast.createToastManager()

function ToastList() {
  const { toasts } = Toast.useToastManager()

  return toasts.map((t) => (
    <Toast.Root
      key={t.id}
      toast={t}
      className={cn(
        "group/toast relative flex w-full flex-col gap-1 rounded-lg border border-border bg-card p-3 pr-8 text-sm shadow-lg transition-all",
        "data-[type=error]:border-destructive/40 data-[type=error]:bg-destructive/10",
        "data-[type=success]:border-brand/40",
        "data-[swipe-direction]:touch-none",
        "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[ending-style]:translate-x-full"
      )}
    >
      {t.title && (
        <Toast.Title className="text-sm font-medium text-foreground" />
      )}
      {t.description && (
        <Toast.Description className="text-sm text-muted-foreground" />
      )}
      {t.actionProps && (
        <Toast.Action
          {...t.actionProps}
          className={cn(
            "mt-1 w-fit text-sm font-medium text-brand underline-offset-4 hover:underline",
            t.actionProps.className
          )}
        />
      )}
      <Toast.Close
        aria-label="Cerrar"
        className="absolute top-2 right-2 rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </Toast.Close>
    </Toast.Root>
  ))
}

export function Toaster() {
  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed right-4 bottom-4 z-[100] flex w-full max-w-sm flex-col gap-2 outline-none">
        <ToastList />
      </Toast.Viewport>
    </Toast.Portal>
  )
}
