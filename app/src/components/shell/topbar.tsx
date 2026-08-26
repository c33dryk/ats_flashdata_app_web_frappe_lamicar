import { ThemeToggle } from "@/components/shell/theme-toggle";
import { MobileMenuButton } from "@/components/shell/mobile-menu-button";

export function Topbar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border bg-background px-4 sm:px-6">
      <MobileMenuButton />
      <div className="min-w-0 flex-1 overflow-x-auto">{children}</div>
      <ThemeToggle />
    </header>
  );
}
