# Lamicar Work Orders — estado del proyecto

Este archivo es la memoria persistente **del repo** (no de una sesión de Claude en particular)
para el desarrollo de la app real de Lamicar sobre el template `ats_app_web_frappe`. Se actualiza
a medida que avanzan las iteraciones — es la fuente de verdad sobre qué se decidió, por qué, y qué
falta. `CLAUDE.md` explica el template en general; este archivo explica **este proyecto puntual**.

## Qué es esto

App interna de gestión de órdenes de trabajo (OT) para un taller (Lamicar — cristales, mecánica
ligera, calibración ADAS, etc.). Backend: Frappe Cloud (`hub.lamicar.app`), doctypes creados a
mano vía Desk (no hay una Frappe App/módulo Python custom instalada — **no existe** ningún
whitelisted method propio en el servidor real, todo pasa por el REST genérico de Frappe).

## Referencia: el MVP viejo (`D:\Lab\lamicar-workorders`)

Antes de este repo hubo un prototipo funcional en `D:\Lab\lamicar-workorders` que **no se está
usando como código** (usa una librería de UI propia `@flashdata/v4`, incompatible con el shell/
shadcn de este template) pero sí como **referencia funcional y de modelo de datos**. Resumen de lo
relevante ahí, para no tener que releerlo de nuevo:

- `frappe_app/workorders_os/` — la Frappe App que ese MVP asumía instalada (doctypes + un
  whitelisted method `execute_command`/`bootstrap` en `api/v1.py`). **Este repo no tiene esa app
  instalada en `hub.lamicar.app`** — los doctypes se crearon manualmente por Desk con la misma
  forma, pero las mutaciones acá van todas por el REST genérico (`getList`/`getDoc`/`createDoc`/
  `updateDoc`), no por ese método custom.
- `docs/DIAGRAMAS_ASCII.md` — documenta el modelo de datos y la máquina de estados de la OT
  (Nueva → En Curso → Pendiente/Terminada → Entregada → Facturada, con Anulada como salida).
  Ese diagrama es la base de `ALLOWED_TRANSITIONS` en `work-orders.ts` (ver abajo).
- `app/page.tsx` (el MVP, ~4260 líneas) — de ahí salieron los criterios de permisos por rol
  (`canStartWork`, `canFinishWork`, `canDeliver`, `canInvoice`, `canCancel`, `canCreateOrder`,
  `canEditOrder`) que hoy viven en `COMMAND_ROLES` (`work-orders.ts`) y en los checks de rol de
  cada Server Action/página.
- Los 12 doctypes del módulo "Lamicar Services" en Frappe (confirmados vía Desk y `/api/resource`,
  fieldnames reales — **no** los camelCase que usaba el frontend del MVP viejo):
  `Work Order`, `Work Order Item`, `WO Evidence`, `WO Evidence Policy`, `WO Evidence Requirement`,
  `WO Customer Type`, `WO Vehicle Type`, `WO Service Segment`, `WO Service Type`, `WO Operator`,
  `WO Work Order Event`, `WO Client` (este último sin usar todavía).
- 5 Roles de Frappe ya creados en `hub.lamicar.app`: `WO Admin`, `WO Recepcion`, `WO Tecnico`,
  `WO Facturador`, `WO Auditor`.

## Qué se construyó (por iteración)

1. **Capa de datos** (`app/src/lib/frappe/work-orders.ts`): tipos + `getWorkOrders`/`getWorkOrder`/
   `createWorkOrder`/`updateWorkOrder` + getters de catálogos (`getCustomerTypes`, etc., todos
   filtrados a `is_active=1` porque alimentan `<select>`s).
2. **Roles reales**: `AppRole` (`auth-shared.ts`) son los 5 roles de Lamicar (`admin`, `recepcion`,
   `tecnico`, `facturador`, `auditor`), mapeados desde los Roles de Frappe en
   `lib/frappe/auth.ts` → `getAppRoleForUser` (prioridad admin > recepcion > tecnico > facturador
   > auditor; sin ninguno de los 5, cae a `auditor`). Nav: `/work-orders` en `navPrincipal`.
3. **Listado + detalle de OT** (`/work-orders`, `/work-orders/[id]`) — solo lectura.
4. **Color de marca configurable**: `BRAND_COLOR` en `.env` → CSS var `--brand` inyectada en
   `layout.tsx`, usada en `bg-brand`/`text-brand` (sidebar activo, `variant="brand"` de
   Button/Badge). El verde de Lamicar es `#00e659`.
5. **Crear OT** (`/work-orders/new`) — Server Action (`work-orders/actions.ts`), sin ítems
   todavía. Roles: `admin`, `recepcion`.
6. **Transiciones de estado** (`work-orders/[id]/actions.ts` → `transitionWorkOrderAction`,
   componente `work-order-actions.tsx`): máquina de estados en `ALLOWED_TRANSITIONS`/
   `COMMAND_ROLES` (`work-orders.ts`). Incluye firma digital (canvas → `frappeUploadFile` →
   Frappe File Manager) para `deliver`, y **control de concurrencia real**: la action relee el doc
   fresco y compara `modified` contra el que vio el cliente antes de guardar (no confía en que
   Frappe rechace un PUT desactualizado).
7. **Editar OT** (`/work-orders/[id]/edit`) — cabecera + ítems (`Work Order Item`, tabla hija).
   `total_net`/`amount_net` se recalculan **en la app** (no hay controller Python en Frappe que lo
   haga). Bloqueado en `Facturada`/`Anulada`. Mismo patrón de concurrencia que las transiciones.
8. **Catálogos (ABM)** — 5 de los 6 catálogos simples (todo menos `WO Evidence Policy`, que tiene
   tabla hija de requisitos y quedó pendiente). `/admin/configuracion/[catalogKey]` (+`/new`,
   `+/[rowId]/edit`), dirigido por config (`lib/frappe/catalogs.ts` → `CATALOG_DEFS`) para no
   repetir componente+action 5 veces. Sidebar: acordeón bajo "Configuración".
   - "Eliminar" = desactivar (`is_active=0`), nunca borrado real (Work Order los referencia por
     Link). Sin `window.confirm`: desactiva al toque + toast con "Deshacer".
   - Filas inactivas ocultas por default; la tarjeta KPI "Inactivos" es clickeable y muestra
     *solo* las inactivas (con botón "Reactivar" por fila y "← Volver").
9. **Tabla + buscador reutilizables**: `components/ui/table.tsx` (estilo global: borde, header
   uppercase gris) y `components/searchable-table.tsx` (buscador client-side vía atributo
   `data-search` en cada `<TableRow>` — necesario porque los listados son Server Components y no
   pueden pasarle una función `render` a un componente cliente).
10. **Toasts**: `components/ui/toast.tsx` (`export const toast = Toast.createToastManager()` +
    `<Toaster />`), sobre `@base-ui/react/toast` (ya venía instalado con `@base-ui/react`, no se
    agregó dependencia nueva). Mismo import path/API que el registry de shadcn (`toast.add({...})`
    style "base"). Provider en `layout.tsx`.

## Decisiones de arquitectura (por qué, no solo qué)

- **Server Actions, no API routes nuevas**: todas las mutaciones (crear/editar OT, transiciones,
  ABM) usan `"use server"` + `useActionState`, no rutas `/api/*` propias — es el patrón nativo de
  Next 16/React 19 para forms, evita boilerplate. Las únicas excepciones son las ya provistas por
  el template (`/api/auth/*`) y `frappeUploadFile` (multipart, no puede ir por `useActionState`).
- **Sin componente `Dialog`/`Tabs`/`Select` de shadcn instalados**: en vez de instalarlos, todo lo
  que sería un modal es un panel `Card` inline (paneles de transición en `work-order-actions.tsx`,
  antes también en el ABM), y los combos son `<select>` nativo estilado a mano
  (`selectClassName`, repetido en los forms — candidato a extraer si aparece un tercer lugar que
  lo necesite). Fue una decisión explícita para no arriesgarse con componentes `@base-ui/react`
  sin probar (ver advertencia en `CLAUDE.md`).
- **Concurrencia optimista casera**: el doctype `Work Order` tiene un campo `row_version` (se
  incrementa en cada mutación, más por trazabilidad/paridad con el modelo del MVP viejo que por
  necesidad real), pero el control real de conflictos es comparar `modified` (leído fresco justo
  antes de guardar) contra el `modified` que el cliente tenía cuando abrió la página. Se eligió
  esto en vez de confiar en que el PUT de Frappe rechace un `modified` desactualizado, porque ese
  comportamiento no estaba verificado para el REST genérico.
- **Catálogos: nunca borrado real, siempre `is_active`**: los 5 (y el que falta) están
  referenciados por `Link` desde `Work Order` — borrar de verdad podría romper OTs existentes.
- **`total_net`/`amount_net` calculados en la app**: los doctypes son *Custom DocType* creados por
  Desk sin controller Python (`class X(Document): pass`), así que no hay ningún hook server-side
  que sume los ítems — si se llegara a instalar una Frappe App con lógica propia en el futuro, hay
  que decidir quién manda (la app o el server) para no calcular dos veces.

## Gotchas encontrados (para no repetirlos)

- **`Datetime` en tablas hijas de Frappe exige `"YYYY-MM-DD HH:MM:SS"` literal** — `.toISOString()`
  de JS (`2026-08-25T23:00:00.000Z`) rompe con `MySQLdb.OperationalError: Incorrect datetime
  value` porque el update de child tables va directo a `INSERT` sin pasar por la normalización que
  sí aplica a los campos de nivel superior. Ver `toFrappeDatetime()` en
  `work-orders/[id]/actions.ts`.
- **`.env`: un valor que empieza con `#` sin comillas se trunca a vacío** — `@next/env` (el loader
  de Next para `.env`) trata `#` como inicio de comentario aunque esté pegado al valor
  (`BRAND_COLOR=#00e659` → vacío). Hay que citarlo: `BRAND_COLOR="#00e659"`.
- **El rol queda fijo en la cookie de sesión al momento del login** — `getAppRoleForUser` se
  llama una sola vez, en `/api/auth/login`, no en cada request. Si cambiás el mapeo de roles o los
  Roles de Frappe de un usuario, hay que **cerrar sesión y volver a entrar** para que se refleje;
  si no, parece que "no anda" pero es una sesión vieja.
- **Server → Client Component: no se puede pasar una función como prop.** Por eso
  `SearchableTable` filtra vía atributos `data-search` en el DOM en vez de un `<DataTable
  render={...}>` genérico — los listados que arma son Server Components.
- **Un registro con `name` sin resolver** (ej. `OT-.YYYY.-.#####` literal, el patrón de autoname
  sin sustituir) rompe el link a `/work-orders/[id]`, no es un bug de la app — es un doc mal
  creado en Frappe. Se resuelve borrándolo/no dejando que se cree así (verificar que el
  `autoname` del doctype esté bien configurado antes de crear el primer registro).

## Qué falta

- `WO Evidence Policy` + `WO Evidence Requirement` (catálogo con tabla hija) — ABM pendiente.
- Evidencia fotográfica general (fotos antes/durante/después, más allá de la firma de entrega).
- Adjuntar el PDF real de la factura al facturar (hoy solo se cargan número/fecha/monto).
- Pasada de diseño/UX general (quedó explícitamente para el final, una vez cerrado el dominio
  funcional) — colores por estado, vista Kanban, iconografía, etc., como el dashboard de
  referencia (`ats_app_talent`) que se usó de inspiración para el formato de listados/ABMs.
- Portal de cliente (`WO Client`, doctype ya creado, sin usar).
- Tests (no hay ninguno configurado en el template todavía).
