"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "./sidebar-context";

export function MobileMenuButton() {
  const { setMobileOpen } = useSidebar();

  return (
    <button
      type="button"
      onClick={() => setMobileOpen(true)}
      title="Abrir menú"
      className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
    >
      <Menu className="h-4.5 w-4.5" />
    </button>
  );
}
