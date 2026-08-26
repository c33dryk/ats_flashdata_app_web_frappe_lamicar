"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  ChevronsUpDown,
  Settings,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type SessionPayload } from "@/lib/auth-shared";
import { useSidebar } from "./sidebar-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Nombre visible de la app en el sidebar. Reemplazar por proyecto (o levantarlo de una env var
// NEXT_PUBLIC_APP_NAME si distintos deploys del mismo template necesitan nombres distintos).
const APP_NAME = "App";

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// Placeholder mínimo — cada proyecto de cliente reemplaza/extiende esta lista con sus propias
// secciones (igual patrón: href, label, icon).
const navPrincipal = [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }];

// Vacío por default: agregar acá los links solo-admin del proyecto (gateado por
// session.role === "admin" más abajo, y por proxy.ts para /admin/*).
const navAdmin: Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "flex flex-row items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

export function AppSidebar({ session }: { session: SessionPayload | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const { mobileOpen, setMobileOpen } = useSidebar();

  // Cerrar el drawer móvil al navegar a otra ruta.
  useEffect(() => {
    setMobileOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar transition-transform duration-200 lg:static lg:z-auto lg:w-auto lg:translate-x-0 lg:transition-[width]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-14" : "lg:w-60"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2 overflow-hidden">
              <Boxes className="h-6 w-6 shrink-0 text-foreground" />
              <span className="truncate text-sm font-semibold tracking-tight">{APP_NAME}</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
            className={cn(
              "hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:flex",
              collapsed && "mx-auto"
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden px-2.5 py-4">
          <div className="flex flex-col gap-1">
            {navPrincipal.map((item) => (
              <NavLink
                key={item.href}
                {...item}
                active={pathname === item.href}
                collapsed={collapsed}
              />
            ))}
          </div>

          {session?.role === "admin" && navAdmin.length > 0 && (
            <div className="flex flex-col gap-1">
              {!collapsed && (
                <p className="flex items-center gap-1.5 px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                  <ShieldCheck className="h-3 w-3" />
                  Administración
                </p>
              )}
              {navAdmin.map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  active={pathname.startsWith(item.href)}
                  collapsed={collapsed}
                />
              ))}
            </div>
          )}
        </nav>

        {session && (
          <div className="shrink-0 border-t border-border px-2.5 py-3">
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm transition-colors hover:bg-muted/60",
                  collapsed && "justify-center px-0"
                )}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-[11px] font-semibold">
                    {initialsOf(session.name)}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="block truncate text-sm font-medium">{session.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {ROLE_LABELS[session.role]}
                      </span>
                    </span>
                    <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <div className="px-1.5 py-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {session.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {ROLE_LABELS[session.role]}
                  </span>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <Settings className="h-4 w-4" />
                  Configuración de usuario
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </aside>
    </>
  );
}
