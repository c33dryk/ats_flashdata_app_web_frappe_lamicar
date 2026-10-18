import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toast } from "@base-ui/react/toast";
import "./globals.css";
import { AppShell } from "@/components/shell/app-shell";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { Toaster, toast } from "@/components/ui/toast";
import { getSession } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lamicar · Órdenes de trabajo",
  description: "Boilerplate Next.js + Frappe",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  // Color de marca por cliente/proyecto (ver .env: BRAND_COLOR) — se inyecta acá como CSS
  // variable en vez de hardcodearlo en globals.css, así cada deploy del template lo cambia sin
  // tocar código. Sin BRAND_COLOR seteado, --brand cae al fallback definido en globals.css.
  const brandColor = process.env.BRAND_COLOR;

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="flex h-full min-h-full antialiased"
        style={brandColor ? ({ "--brand": brandColor } as CSSProperties) : undefined}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <Toast.Provider toastManager={toast}>
            <AppShell session={session}>{children}</AppShell>
            <Toaster />
          </Toast.Provider>
        </ThemeProvider>
      </body>
    </html>
  );
}
