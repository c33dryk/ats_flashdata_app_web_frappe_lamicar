import { cn } from "@/lib/utils";

// Control segmentado (pestañas compactas). Solo clases, para usar tanto con <Link> (Server
// Component, estado en la URL) como con <button> (Client Component, estado local).
export const segmentedGroupClass =
  "inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5";

export function segmentedItemClass(active: boolean) {
  return cn(
    "inline-flex h-7 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
    active
      ? "bg-background text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground"
  );
}
