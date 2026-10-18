import Image from "next/image";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { MobileMenuButton } from "@/components/shell/mobile-menu-button";

export function Topbar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border bg-background px-4 sm:px-6">
      <MobileMenuButton />
      <span className="mr-3 inline-flex shrink-0 lg:hidden dark:rounded dark:bg-white dark:px-1 dark:py-0.5">
        <Image src="/lamicar-logo.png" alt="Lamicar" width={78} height={20} className="h-5 w-auto" />
      </span>
      <div className="min-w-0 flex-1 overflow-x-auto">{children}</div>
      <ThemeToggle />
    </header>
  );
}
