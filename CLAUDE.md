# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **Este repo ya no es un template en blanco** — es la app real de Lamicar (taller). Este archivo
> sigue describiendo el template en general; para el estado puntual del proyecto (qué se construyó,
> decisiones tomadas, gotchas encontrados, qué falta) ver **[.claude/PROJECT.md](.claude/PROJECT.md)**.

## Qué es esto

Template reutilizable de app interna Next.js + Frappe. Nace como copia de la **estructura** (no del
código de negocio) de `ats_app_talent`: mismo patrón de sesión, mismo shell (sidebar/topbar/breadcrumbs),
misma convención de rutas — pero el backend de datos es **Frappe Cloud vía API REST**, no Postgres/Drizzle.

La idea es clonar este repo por cada proyecto de cliente nuevo, y en cada uno:
- Cambiar diseño/branding (logo, nombre, paleta) — pensado para resolverse con otro repo de diseño.
- Agregar los doctypes de Frappe propios del cliente sobre `src/lib/frappe/resource.ts`.
- Agregar las páginas/rutas y el nav del sidebar (`src/components/shell/app-sidebar.tsx`) según el
  módulo que corresponda.
- Ajustar el mapeo de roles (`src/lib/frappe/auth.ts` → `getAppRoleForUser`) y el tipo `AppRole`
  (`src/lib/auth-shared.ts`) a los roles reales del proyecto.

## Estructura del repo

```
ats_app_web_frappe/
  .claude/            # config de Claude Code para este repo
  .env / .env.example # variables de entorno (raíz, junto a docker-compose.yml)
  backup/             # dumps/exports de Frappe si hace falta respaldarlos localmente
  schema/             # lugar para versionar exports de doctypes de Frappe (JSON), si aplica
  docker-compose.yml  # orquesta el único servicio "app" (Frappe queda afuera, en la nube)
  app/                # todo el código Next.js
    Dockerfile
    src/
```

A diferencia de `ats_app_talent` (que además levanta un servicio `db` de Postgres), acá no hay base
de datos propia — Frappe es externo, así que `docker-compose.yml` solo define el servicio `app`.

## Comandos

Todos corren desde `app/`:
- `npm run dev` — servidor de desarrollo (puerto 3000).
- `npm run build` / `npm run start` — build de producción / servir ese build.
- `npm run lint` — ESLint (`eslint-config-next`, flat config).

Desde la raíz: `docker compose up -d` levanta el servicio `app` (usa `.env` de la raíz).

## Variables de entorno (`.env`, raíz del repo)

- `FRAPPE_URL` — URL del sitio Frappe Cloud.
- `FRAPPE_API_KEY` / `FRAPPE_API_SECRET` — credenciales del service account (Frappe > Settings >
  API Access), usadas en **todas** las llamadas server-side a `/api/resource` y `/api/method`
  (header `Authorization: token key:secret`). Nunca se usan para autenticar al usuario final.
- `SESSION_SECRET` — clave para firmar la cookie de sesión propia (HMAC).
- `SESSION_COOKIE_SECURE` — `true` solo cuando hay HTTPS real delante (reverse proxy). En Docker
  local o dev sin TLS, dejar en `false`/sin setear — si no, el navegador descarta la cookie en
  silencio y el login "funciona" pero la sesión nunca queda guardada.
- `APP_PORT` — puerto expuesto por el contenedor `app` en `docker-compose.yml`.

## Autenticación — sesión propia + login-proxy a Frappe

No hay NextAuth ni SDK de Frappe del lado del navegador. El flujo es:

1. `src/app/login/page.tsx` + `src/components/login-form.tsx` — form simple, `POST /api/auth/login`.
2. `src/app/api/auth/login/route.ts`:
   - `loginToFrappe(email, password)` (`src/lib/frappe/auth.ts`) llama a
     `POST {FRAPPE_URL}/api/method/login` con las credenciales del usuario final — **esta es la
     única llamada que no usa el API key/secret del service account**. Si Frappe devuelve 401, la
     ruta devuelve 401 y no se crea sesión.
   - Si el login es válido, `getAppRoleForUser(email)` resuelve el rol de la app consultando
     Frappe con el service account (`roles` del usuario). Ya customizado para este proyecto: los
     5 Roles de Frappe de Lamicar (`WO Admin`/`WO Recepcion`/`WO Tecnico`/`WO Facturador`/
     `WO Auditor`) mapean 1:1 a `AppRole` — ver `.claude/PROJECT.md`. **El rol queda fijo en la
     cookie al momento del login**, no se recalcula en cada request — si cambiás el Role de un
     usuario en Frappe, tiene que cerrar sesión y volver a entrar para que se note.
   - `createSession(...)` (`src/lib/auth.ts`) firma y guarda la cookie propia (`app_session`,
     HMAC-SHA256 con `SESSION_SECRET`, httpOnly, 12h). Frappe no maneja la sesión de la app.
3. `src/proxy.ts` (reemplazo de `middleware.ts` en Next 16, runtime Node.js) protege todo excepto
   `/login` y `/api/auth/*`: sin cookie válida, redirige a `/login`; con sesión pero rol distinto
   de `admin`, bloquea `/admin/*`.
   **Al agregar una ruta pública nueva (sin login) hay que sumarla al `matcher` de `proxy.ts` y a
   `PUBLIC_PREFIXES` en `src/components/shell/app-shell.tsx`** — si no, el proxy la redirige a
   `/login` y un `fetch(...).then(r => r.json())` del cliente que no chequea `r.ok` explota con
   `SyntaxError: Unexpected token '<'` porque siguió el redirect a la página HTML de login (bug
   real ya rastreado en el proyecto de referencia, `ats_app_talent`).
4. Tipos client-safe (sin `node:crypto`/`next/headers`): `src/lib/auth-shared.ts` — es lo único de
   auth que un componente cliente puede importar sin romper el build.

## Capa de datos — Frappe, no Postgres

`src/lib/frappe/`:
- `client.ts` — `frappeFetch(path, init)`: wrapper de `fetch` contra `FRAPPE_URL` con el header
  `Authorization: token ${FRAPPE_API_KEY}:${FRAPPE_API_SECRET}`. Lanza `FrappeApiError` (con
  `status` y `body`) si la respuesta no es `ok`.
- `resource.ts` — helpers genéricos sobre el REST estándar de Frappe: `getList(doctype, {fields,
  filters, limit, orderBy})`, `getDoc`, `createDoc`, `updateDoc`, `deleteDoc`, y `callMethod` para
  whitelisted methods (`/api/method/<dotted.path>`). **Este es el punto de extensión del
  template** — cada proyecto agrega acá (o en archivos hermanos) las funciones tipadas para sus
  propios doctypes, en vez de hacer `fetch()` sueltos por la app. En este proyecto son
  `work-orders.ts` (dominio de OT + catálogos + máquina de estados) y `catalogs.ts` (config
  `CATALOG_DEFS` del ABM).
- `auth.ts` — `loginToFrappe` (login de usuario final) y `getAppRoleForUser` (mapeo de roles,
  placeholder a customizar).

`src/app/dashboard/page.tsx` es un ejemplo end-to-end (login → sesión → ruta protegida → `getList`
contra Frappe → tabla) que sirve de plantilla copy-paste para agregar pantallas nuevas sobre otros
doctypes.

## Shell / UI compartida

Copiado de `ats_app_talent` casi sin cambios (son 100% genéricos, sin acoplamiento a Postgres):
- `src/components/shell/app-shell.tsx` — decide si la ruta actual es pública (`PUBLIC_PREFIXES`,
  hoy solo `/login`) o va con sidebar completo.
- `src/components/shell/app-sidebar.tsx` — `navPrincipal` tiene Dashboard + Órdenes de Trabajo;
  `navAdmin` tiene un grupo "Configuración" que se expande como acordeón (sub-links generados
  desde `CATALOG_DEFS`, ver `.claude/PROJECT.md`) — patrón reusable si se agregan más secciones
  admin. `APP_NAME` sigue en placeholder genérico ("App").
- `topbar.tsx`, `breadcrumbs.tsx`, `theme-toggle.tsx`, `theme-provider.tsx`, `sidebar-context.tsx`,
  `mobile-menu-button.tsx` — sin cambios respecto a Talent.

### ⚠️ shadcn/ui usa `@base-ui/react`, no Radix

`components.json` → `"style": "base-nova"`. Igual que en Talent: **no usar `asChild`** (no falla
en TypeScript pero rompe en runtime) — para un link con pinta de botón, usar
`buttonVariants({...})` como `className` de un `<Link>` normal. Componentes ya instalados: `Button`,
`Badge`, `Avatar`/`AvatarFallback`, `Separator`, `Input`, `Textarea`, `Label`, `Card`, `Table`,
`DropdownMenu`, `Toast` (`components/ui/toast.tsx` — `export const toast` + `<Toaster />`, sobre
`@base-ui/react/toast`). **No hay `Dialog`/`Tabs`/`Select` instalados** — todo lo que sería un
modal se resolvió como panel `Card` inline, y los combos son `<select>` nativo estilado a mano
(ver `.claude/PROJECT.md`, sección "Decisiones de arquitectura"). Si se agregan componentes nuevos
con `npx shadcn@latest add ...`, revisar el código generado antes de asumir que se comporta como
el shadcn/Radix "clásico".

## Estado actual

Este proyecto es la app de Lamicar (taller de reparación de vehículos), sobre el dominio
`Work Order`/catálogos de Frappe Cloud (`hub.lamicar.app`) — **no** el estado en blanco del
template. Roles reales (`admin`/`recepcion`/`tecnico`/`facturador`/`auditor`), listado/detalle/
alta/edición/transiciones de OT, ABM de catálogos y toasts ya están implementados. Ver
**[.claude/PROJECT.md](.claude/PROJECT.md)** para el detalle completo (qué se construyó, por qué,
gotchas, y qué falta).

No hay tests configurados en el template todavía.
