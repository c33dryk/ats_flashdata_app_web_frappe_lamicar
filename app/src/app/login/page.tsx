import { Suspense } from "react";
import Image from "next/image";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

// Nombre visible de la app — mismo placeholder que app-sidebar.tsx. Reemplazar por proyecto.
const APP_NAME = "App";

export default function LoginPage() {
  return (
    <div className="grid min-h-full w-full flex-1 grid-cols-1 bg-[#0a0a0f] text-white lg:grid-cols-2">
      {/* Columna izquierda: form */}
      <div className="flex flex-col justify-between px-8 py-10 sm:px-16 lg:px-20">
        <div>
          <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
          <p className="mt-1.5 bg-gradient-to-r from-violet-300 to-blue-300 bg-clip-text text-[11px] font-medium uppercase tracking-[0.25em] text-transparent">
            Gestión interna
          </p>
        </div>

        <div className="mx-auto w-full max-w-sm py-16">
          <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-white/50">Ingresá con tu usuario de Frappe.</p>

          <div className="mt-8">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-white/40">
          <span>Powered by</span>
          <span className="h-4 w-px bg-white/20" />
          <a
            href="https://atsoftware.ar/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 transition-colors hover:text-white/70"
          >
            <Image src="/atsoftware-logo.png" alt="ATSoftware" width={22} height={22} />
            <span>ATSoftware</span>
          </a>
          <span className="h-4 w-px bg-white/20" />
          <a
            href="https://flashdata.com.ar/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 transition-colors hover:text-white/70"
          >
            <Image src="/Flashdata.png" alt="Flashdata" width={113} height={40} className="h-8 w-auto rounded-sm" />
          </a>
        </div>
      </div>

      {/* Columna derecha: panel de marca. TODO: reemplazar por la imagen de fondo del proyecto
          (ver FR1_0009-1-scaled.jpg en ats_app_talent como referencia de tratamiento/overlay). */}
      <div className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/80 via-[#120a24]/85 to-[#0a0a0f]/90" />
      </div>
    </div>
  );
}
