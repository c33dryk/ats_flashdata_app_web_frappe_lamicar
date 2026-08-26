# ats_app_web_frappe — Agent Quick Reference

Template reutilizable de app interna: Next.js 16 (App Router, TS) + shadcn/ui (`base-nova`,
`@base-ui/react`) + Frappe Cloud como backend de datos vía API REST. Nace como fork de la
**estructura** de `ats_app_talent` (sesión, shell, rutas), sin Postgres/Drizzle.

📖 **Documentación completa:** [CLAUDE.md](CLAUDE.md).

## Quick Start

```bash
# Desde app/
npm run dev      # servidor de desarrollo, puerto 3000
npm run build    # build de producción
npm run lint     # ESLint

# Desde la raíz
docker compose up -d   # levanta el servicio "app" (requiere .env)
```

**Env:** copiar `.env.example` → `.env` (raíz). Claves: `FRAPPE_URL`, `FRAPPE_API_KEY`,
`FRAPPE_API_SECRET`, `SESSION_SECRET`, `SESSION_COOKIE_SECURE`, `APP_PORT`.

## Patrones críticos

- **Auth:** cookie propia HMAC-firmada (`src/lib/auth.ts`), no NextAuth. El login
  (`api/auth/login/route.ts`) valida contra Frappe (`loginToFrappe`) y recién ahí crea la sesión —
  Frappe nunca maneja la sesión de la app.
- **`src/proxy.ts`:** guardia todo excepto `/login` y `/api/auth/*`. Ruta pública nueva → sumarla
  al `matcher` acá y a `PUBLIC_PREFIXES` en `app-shell.tsx`, o rompe con un `SyntaxError` en el
  cliente (redirect a HTML de login seguido por un `fetch().json()` que no chequea `r.ok`).
- **Datos:** todo vía `src/lib/frappe/resource.ts` (`getList`, `getDoc`, `createDoc`, `updateDoc`,
  `deleteDoc`, `callMethod`) con el service account (API key/secret). Nunca Postgres/Drizzle acá.
- **shadcn = `@base-ui/react`, no Radix:** nunca `asChild` — usar `buttonVariants()` como
  `className` de un `<Link>` para un link con pinta de botón.

## Para arrancar un proyecto de cliente nuevo sobre este template

1. Cambiar `APP_NAME`, logo y paleta (`app-sidebar.tsx`, `globals.css`, `login/page.tsx`) —
   normalmente resuelto en un repo de diseño aparte.
2. Completar `.env` con el `FRAPPE_URL`/API key-secret reales del cliente.
3. Ajustar `getAppRoleForUser` (`lib/frappe/auth.ts`) y `AppRole` (`lib/auth-shared.ts`) a los
   roles reales.
4. Agregar los doctypes del proyecto sobre `lib/frappe/resource.ts`, y las páginas/nav
   correspondientes (ver `dashboard/page.tsx` como plantilla).

---

Ante la duda, **leer [CLAUDE.md](CLAUDE.md)** para arquitectura y detalles del flujo de auth/datos.
