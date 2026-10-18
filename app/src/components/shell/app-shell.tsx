"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "./app-sidebar";
import { SidebarProvider } from "./sidebar-context";
import type { SessionPayload } from "@/lib/auth-shared";

// Rutas públicas (login, etc.): sin sidebar ni chrome interno. Al agregar una ruta pública nueva
// para este template, sumarla acá y también al matcher de proxy.ts.
const PUBLIC_PREFIXES = ["/login"];

export function AppShell({
  session,
  children,
}: {
  session: SessionPayload | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isPublic) {
    return <div className="flex min-h-full w-full flex-1 flex-col">{children}</div>;
  }

  return (
    <SidebarProvider>
      <AppSidebar session={session} />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto print:overflow-visible">{children}</div>
    </SidebarProvider>
  );
}
