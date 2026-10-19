# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **Este repo ya no es un template en blanco** — es la app real de Lamicar (taller). Este archivo
> sigue describiendo el template en general; para el estado puntual del proyecto (qué se construyó,
> decisiones tomadas, gotchas encontrados, qué falta) ver **[.claude/PROJECT.md](.claude/PROJECT.md)**.

> ⚠️ **Next.js 16, no el Next que conocés.** `app/AGENTS.md` (regenerado por `next dev`) pide leer
> la guía relevante en `app/node_modules/next/dist/docs/` antes de escribir código — hay APIs y
> convenciones con breaking changes (ej. `middleware.ts` → `src/proxy.ts`). No editar ni borrar ese
> bloque de `app/AGENTS.md`: `next dev` lo vuelve a generar.

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
./
  .claude/PROJECT.md  # estado/decisiones/gotchas/roadmap de Lamicar — leer antes de tocar dominio
  .env / .env.example # variables de entorno (raíz, junto a docker-compose.yml)
  backup/             # dumps/exports de Frappe (gitignored: pueden tener datos reales)
  schema/             # lugar para versionar exports de doctypes de Frappe (JSON), hoy vacío
  docker-compose.yml       # local: servicio "app", publica APP_PORT al host
  docker-compose.prod.yml  # prod: VersatileHub + Traefik → portal.lamicar.app (ver "Deploy")
  app/                # todo el código Next.js (output: "standalone")
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
- `npx tsc --noEmit` — chequeo de tipos rápido sin buildear (no hay script dedicado).

Desde la raíz: `docker compose up -d` levanta el servicio `app` (usa `.env` de la raíz).

No hay tests ni test runner instalado (ver roadmap en `.claude/PROJECT.md` antes de elegir uno).

`npm run dev`/`build` corridos desde `app/` igual leen el `.env` **de la raíz**: `next.config.ts`
llama a `loadEnvConfig(..)` sobre el directorio padre con `forceReload` (sin eso, `@next/env`
devuelve el cache vacío de `app/`). No crear un `app/.env` aparte.

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
- `BRAND_COLOR` — color de acento (CSS var `--brand`, inyectada en `<body>` desde `layout.tsx`;
  fallback en `globals.css`). **Va entre comillas** (`BRAND_COLOR="#00e659"`): sin comillas
  `@next/env` toma el `#` como comentario y el valor queda vacío.
- `LAMICAR_PORTAL_DOMAIN` / `LAMICAR_PORTAL_APP_PORT` — solo para `docker-compose.prod.yml`.

## Deploy (producción)

`docker-compose.prod.yml` corre en VersatileHub detrás de Traefik (red externa `web`), dominio
`portal.lamicar.app`, mismo host que Frappe (`hub.lamicar.app`). Puntos no obvios:
- `HOSTNAME=0.0.0.0` es obligatorio: el server standalone de Next bindea a `$HOSTNAME` (que Docker
  setea al container ID) y Traefik no llega.
- `certresolver=letsencrypt` (HTTP-01) fijo, no el default de Traefik (Cloudflare DNS-01):
  `lamicar.app` está en otra cuenta de Cloudflare.
- `SESSION_COOKIE_SECURE` default `true` acá (hay HTTPS real).

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
  `status` y `body`) si la respuesta no es `ok`. También `frappeUploadFile` (multipart al File
  Manager de Frappe; lo usan firma de entrega y evidencia) y `frappeFetchFile` (descarga
  server-side). **Los `file_url` privados nunca se linkean directo** desde el browser (son
  relativos al sitio Frappe y requieren el token del service account): siempre vía
  `/api/files?path=<file_url>` (`src/app/api/files/route.ts`, exige sesión y solo acepta
  `/files/...` o `/private/files/...`).
- `resource.ts` — helpers genéricos sobre el REST estándar de Frappe: `getList(doctype, {fields,
  filters, limit, orderBy})`, `getDoc`, `createDoc`, `updateDoc`, `deleteDoc`, y `callMethod` para
  whitelisted methods (`/api/method/<dotted.path>`). **Este es el punto de extensión del
  template** — cada proyecto agrega acá (o en archivos hermanos) las funciones tipadas para sus
  propios doctypes, en vez de hacer `fetch()` sueltos por la app. En este proyecto son
  `work-orders.ts` (dominio de OT + catálogos + máquina de estados) y `catalogs.ts` (config
  `CATALOG_DEFS` del ABM).
- `auth.ts` — `loginToFrappe` (login de usuario final) y `getAppRoleForUser` (mapeo de los 5
  Roles `WO *` de Frappe a `AppRole`).

En `hub.lamicar.app` los doctypes son de la app Frappe `lamicar_services` (archivos versionados,
no Custom DocTypes; ver `schema/CAMBIOS_FRAPPE.md`), **sin controller Python con lógica ni
whitelisted methods propios**: toda la lógica de negocio (máquina de estados `ALLOWED_TRANSITIONS`/
`COMMAND_ROLES`, totales de ítems, concurrencia optimista comparando `modified`) vive en la app
Next. Pensar en esto al migrar a una Frappe App con lógica server-side (decidir quién manda).

`src/app/dashboard/page.tsx` es un ejemplo end-to-end (login → sesión → ruta protegida → `getList`
contra Frappe → tabla) que sirve de plantilla copy-paste para agregar pantallas nuevas sobre otros
doctypes.

## Patrón de páginas y mutaciones

- Páginas = Server Components que leen con las funciones de `lib/frappe/*` y chequean rol con
  `getSession()`. Cada ruta tiene su `loading.tsx` que solo renderiza `<PageLoading />`
  (`components/ui/page-loading.tsx`) — replicarlo al agregar rutas.
- Mutaciones = **Server Actions** (`actions.ts` junto a la ruta, `"use server"` + `useActionState`),
  no rutas `/api/*` nuevas. Cada action re-chequea el rol (no confiar en que la UI ocultó el botón)
  y lee el `FormData` con `str()` de `lib/form-data.ts` (strings vacíos → `undefined`, para no pisar
  campos de Frappe con `""`). Tablas hijas editables se serializan a JSON en un `<input hidden>`.
- Un Server Component no puede pasar funciones como props a un Client Component — por eso
  `SearchableTable` filtra por atributo `data-search` en vez de recibir un `render`.

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
`DropdownMenu`, `PageLoading`, `Toast` (`components/ui/toast.tsx` — `export const toast` + `<Toaster />`, sobre
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
gotchas, y qué falta). Al cerrar una iteración, actualizar ese archivo (no este).
