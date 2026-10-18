import { cn } from "@/lib/utils";

// Estilo compartido para <select> nativo (no hay Select de shadcn instalado — ver
// .claude/PROJECT.md, "Decisiones de arquitectura"). Mismo look que <Input>.
export const nativeSelectClassName = cn(
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30"
);
