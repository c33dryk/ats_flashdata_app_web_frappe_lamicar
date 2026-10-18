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
8. **Catálogos (ABM)** — los 6, incluido `WO Evidence Policy` (con tabla hija `requirements` →
   `WO Evidence Requirement`). `/admin/configuracion/[catalogKey]` (+`/new`, `+/[rowId]/edit`),
   dirigido por config (`lib/frappe/catalogs.ts` → `CATALOG_DEFS`) para no repetir componente+
   action 6 veces. Sidebar: acordeón bajo "Configuración".
   - "Eliminar" = desactivar (`is_active=0`), nunca borrado real (Work Order los referencia por
     Link). Sin `window.confirm`: desactiva al toque + toast con "Deshacer".
   - Filas inactivas ocultas por default; la tarjeta KPI "Inactivos" es clickeable y muestra
     *solo* las inactivas (con botón "Reactivar" por fila y "← Volver").
   - `evidence-policies` está en `CATALOG_DEFS` solo para reusar listado/sidebar/activar-
     desactivar tal cual (son campos planos) — el alta/edición es bespoke
     (`components/admin/evidence-policy-form.tsx` + `saveEvidencePolicyAction` en
     `admin/configuracion/actions.ts`), porque el pipeline genérico (`CatalogRowForm`/
     `saveCatalogRowAction`) no sabe manejar la tabla hija. Mismo patrón de tabla hija editable
     que `Work Order Item` en la edición de OT (estado local + `requirements_json` serializado a
     JSON en un campo oculto justo antes de submit) y misma concurrencia optimista (compara
     `modified`). Fieldnames verificados en vivo contra Frappe (`code`/`label`/`stage`
     `before|during|after|delivery`/`min_photos`/`allow_exception`).
9. **Tabla + buscador reutilizables**: `components/ui/table.tsx` (estilo global: borde, header
   uppercase gris) y `components/searchable-table.tsx` (buscador client-side vía atributo
   `data-search` en cada `<TableRow>` — necesario porque los listados son Server Components y no
   pueden pasarle una función `render` a un componente cliente).
10. **Toasts**: `components/ui/toast.tsx` (`export const toast = Toast.createToastManager()` +
    `<Toaster />`), sobre `@base-ui/react/toast` (ya venía instalado con `@base-ui/react`, no se
    agregó dependencia nueva). Mismo import path/API que el registry de shadcn (`toast.add({...})`
    style "base"). Provider en `layout.tsx`.
11. **Evidencia fotográfica general** (`components/work-orders/evidence-section.tsx`, actions
    `addEvidenceAction`/`removeEvidenceAction` en `work-orders/[id]/actions.ts`): la tabla hija
    `Work Order.evidence` (`WoEvidence`) y `frappeUploadFile` ya existían (los usaba la firma de
    entrega) — lo que faltaba era la UI de carga. Mismo patrón que la firma (`<input type=file>` →
    `FileReader` a base64 → `frappeUploadFile` → push a `evidence[]`), pero como acción aparte de
    `transitionWorkOrderAction` porque subir una foto no cambia el `status` de la OT. Muestra un
    checklist de la `WO Evidence Policy` aplicable (resuelta por `customer_type_id`, no hay link
    directo `Work Order` → política) **solo informativo** — no bloquea transiciones; eso quedó
    para una iteración futura si hace falta con datos reales de uso. `capture="environment"` en
    el input dispara la cámara nativa en mobile sin JS extra.
12. **Proxy de archivos privados** (`app/api/files/route.ts` + `frappeFetchFile` en
    `lib/frappe/client.ts`): al probar la evidencia fotográfica se vio que los links a
    `ev.url`/`delivery_signature_url` no abrían — ver gotcha correspondiente más abajo. Cualquier
    link a un archivo subido con `frappeUploadFile({ isPrivate: true, ... })` tiene que pasar por
    `/api/files?path=<file_url>` en vez de usar `ev.url`/`file_url` directo.
13. **Permisos centralizados** (`lib/permissions.ts`): `can(role, capability)` (createOrder,
    editOrder, uploadEvidence, manageCatalogs) y `SCREEN_ACCESS`/`canAccessPath` (qué pantallas ve
    cada rol). Lo usan sidebar (filtra el menú), `proxy.ts` (bloquea rutas), páginas y Server
    Actions — reemplazó ~10 listas de roles copiadas. Desvío del MVP: `facturador` sigue viendo
    OTs porque facturar vive en el detalle; sacárselo cuando exista `/facturacion`. Pantallas del
    MVP pendientes (con su acceso original): Remitos (todos), Clientes y Flota (todos),
    Facturación (admin, facturador, recepcion, auditor).
14. **Dashboard** (`/dashboard`, `?vista=gestion`): Operativo (KPIs que linkean a
    `/operaciones?filtro=...`, flujo por estado, segmentos, OTs activas) y Gestión (filtros por
    técnico/segmento/servicio/tipo cliente/vehículo/estado, gráfico de columnas día/mes/año por
    `creation`, desglose con fila "Sin asignar"). Lógica pura en `lib/dashboard-metrics.ts` →
    al migrar a Frappe es un Report/whitelisted method con GROUP BY. Diferencias con el MVP: los
    períodos se calculan desde hoy (el MVP tenía fechas hardcodeadas) y las Anuladas no suman.
15. **Operaciones** (`/operaciones`) — versión nueva del listado, **convive con `/work-orders`**
    (se dejó intacto a pedido del usuario hasta validar la nueva). Indicadores clickeables que
    filtran (`OPERATIONS_FILTERS` en `lib/work-order-status.ts`, `?filtro=`), lista por defecto,
    toggle a Kanban (`?vista=kanban`), Nueva Orden en modal (al crear se queda en la pantalla,
    toast con "Abrir"). Detalle/edición siguen en `/work-orders/[id]`.
16. **Kanban con drag & drop** (`components/operations/kanban-board.tsx`, `@dnd-kit/core`):
    soltar solo es válido si hay comando en `ALLOWED_TRANSITIONS` + `COMMAND_ROLES` (columnas
    inválidas se atenúan). start/finish se aplican directo (optimista con `useOptimistic`);
    mark_pending abre modal de motivo; deliver navega a `/work-orders/[id]?accion=deliver`
    (abre el panel de firma). Facturada/Anulada no son columnas. Mouse/touch toman la tarjeta
    entera (touch: mantener 200ms); teclado usa el ícono de arrastre.
17. **Panel lateral de OT** (`components/operations/work-order-panel.tsx`, estilo ClickUp): se
    abre desde lista/kanban/dashboard con `/operaciones?ot=<OT>` (pushState; "atrás" cierra). Lee
    `GET /api/work-orders/:id` (OT + políticas). Propiedades con ícono, stepper de estado,
    pestañas Fotos y archivos / Trabajos / Actividad, acciones fijas abajo (`WorkOrderActions`
    con `onSuccess` para recargar). En celular ocupa la pantalla. `/work-orders/[id]` sigue
    existiendo como "página completa".
18. **Fotos y archivos** (`components/work-orders/evidence-checklist.tsx`): checklist por etapa
    desde la WO Evidence Policy, miniaturas + visor, "Sacar foto" (`capture=environment`) y
    "Subir archivo" (imágenes/PDF, múltiple). Compresión en el navegador (`lib/image-compress.ts`,
    1920px JPEG 0.82) y subida en cola a `POST /api/work-orders/:id/evidence` (route handler, no
    Server Action). El requisito se guarda en `zone` (con fallback a prefijo `[CODE]` en `notes`
    si Frappe lo rechaza) — reglas en `lib/evidence.ts`.
20. **Facturación** (`/facturacion`, `components/billing/billing-board.tsx`): Entregadas por
    facturar + Facturadas, indicadores que filtran (por facturar, facturado este mes,
    facturadas, facturadas sin PDF), selección múltiple → **expedientes ZIP reales**
    (`GET /api/expedientes?ot=...`, fflate: resumen.txt + fotos/firma/factura bajadas de Frappe;
    URLs externas solo listadas, para evitar SSRF; máx. 50 OTs). "Facturar" abre el mismo panel
    lateral con el panel de factura, que ahora adjunta el **PDF de la factura** (se sube como
    evidencia `type=invoice` y la transición lo asocia validando que sea de esa OT → 
    `invoice_file_url`). Desde acá el **facturador ya no ve Operaciones ni /work-orders** (como
    el MVP); su Dashboard linkea a /facturacion.
21. **Remitos** (`/remitos`, `/remitos/[id]`): listado de entregas firmadas + remito imprimible
    (hoja blanca, logo, cliente, vehículo, trabajos sin precios, fotos "después", texto de
    conformidad y firma real). "Imprimir / Guardar PDF" usa el diálogo del navegador; el chrome
    de la app tiene `print:hidden`. En Frappe sería un Print Format.
19. **Logo Lamicar** (`public/lamicar-logo.png`, recortado del original de lamicar.ar): sidebar,
    topbar en mobile y login; en fondos oscuros va sobre pastilla blanca (el azul no contrasta).

## Decisiones de arquitectura (por qué, no solo qué)

- **Server Actions, no API routes nuevas**: todas las mutaciones (crear/editar OT, transiciones,
  ABM) usan `"use server"` + `useActionState`, no rutas `/api/*` propias — es el patrón nativo de
  Next 16/React 19 para forms, evita boilerplate. Las únicas excepciones son las ya provistas por
  el template (`/api/auth/*`) y `frappeUploadFile` (multipart, no puede ir por `useActionState`).
- **Modales = `<dialog>` nativo** (`components/ui/modal.tsx`), no el Dialog de shadcn/base-ui:
  foco atrapado, Esc y fondo inerte los da el navegador, sin dependencia nueva. `<select>`
  nativo con estilo compartido en `components/ui/native-select.ts` (`nativeSelectClassName`).
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
- **Catálogos: nunca borrado real, siempre `is_active`**: los 6 están referenciados por `Link`
  desde `Work Order` — borrar de verdad podría romper OTs existentes.
- **`total_net`/`amount_net` calculados en la app**: los doctypes son *Custom DocType* creados por
  Desk sin controller Python (`class X(Document): pass`), así que no hay ningún hook server-side
  que sume los ítems — si se llegara a instalar una Frappe App con lógica propia en el futuro, hay
  que decidir quién manda (la app o el server) para no calcular dos veces.

## Gotchas encontrados (para no repetirlos)

- **Server Actions cortan el body en 1MB** → nunca subir fotos/PDFs por Server Action (la
  `addEvidenceAction` vieja en base64 falla con fotos reales de celular). Usar el route handler
  de evidencia. El proxy de Next además bufferea hasta 10MB por request (tope app: 8MB).
- **Las 5 WO Evidence Policy están todas en customer_type `ASEG`** (una por aseguradora) y la OT
  no guarda cuál aplica → el panel deja elegirla. Falta un Link `evidence_policy_id` en Work Order.
- **Evidencias de ejemplo del MVP tienen URLs externas** (Unsplash): `fileHref` las usa directo;
  solo las rutas `/files`/`/private/files` pasan por `/api/files`.
- **En el MVP el remito PDF, la factura y el ZIP de expedientes eran simulados** (archivos de
  texto con extensión .pdf / fichas con links): hay que construirlos de verdad, no portarlos.
- **`getList` sin `limit` → Frappe devuelve solo 20 filas.** Los catálogos y el ABM venían
  truncados en silencio. `limit: 0` = todas (ya aplicado a catálogos, ABM y dashboard).
- **Actualizar `next` con `npm run dev` corriendo deja el dev server en 500** (hasta `/login`):
  queda el binario viejo en memoria con `node_modules` nuevos. Reiniciar `npm run dev`.

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
- **`file_url` de `frappeUploadFile` no se puede linkear directo desde el browser.** Es una ruta
  relativa al *sitio de Frappe* (`/private/files/x.png`), no a esta app — un `<a href={file_url}>`
  resuelve mal (contra `localhost:3000`/el dominio de la app). Y aunque se arme la URL absoluta a
  Frappe, los archivos `is_private=1` están protegidos por sesión del lado de Frappe: un click del
  navegador no manda el header `Authorization: token key:secret` (eso solo lo puede mandar un
  `fetch` server-side), así que igual daría error de permiso. Por eso todo link a un archivo
  subido así tiene que pasar por el proxy `/api/files?path=<file_url>` (protegido por la sesión
  propia de la app, hace el fetch a Frappe server-side con el service account). Detectado primero
  en el link de la firma de entrega (`delivery_signature_url`) al agregar evidencia fotográfica.

## Qué falta — roadmap para la próxima sesión

Ya cerrados en esta sesión: ABM de `WO Evidence Policy` (con tabla hija) y evidencia fotográfica
general (subida + checklist informativo), incluyendo el fix del proxy de archivos privados
(`/api/files`) que salió al probar la firma de entrega. Quedan, en este orden:

1. **Adjuntar el PDF real de la factura al facturar** (hoy `invoice`/`InvoicePanel` solo carga
   número/fecha/monto — `invoice_file_url` ya existe en el tipo `WorkOrder` pero nada lo escribe
   todavía). Para arrancar: mismo patrón que la firma/fotos —
   `frappeUploadFile({ isPrivate: true, ... })` desde `InvoicePanel`/`transitionWorkOrderAction`
   (command `invoice`) — y el link para verlo tiene que salir armado como
   `/api/files?path=...` **desde el vamos** (no repetir el bug de `file_url` relativo, ver gotcha
   correspondiente más arriba).
2. **Pasada de diseño/UX general** — colores por estado, vista Kanban, iconografía, etc., tomando
   como referencia el dashboard de `ats_app_talent` (inspiración del formato de listados/ABMs
   actual). Explícitamente para el final, una vez cerrado el dominio funcional — este es el punto
   natural para arrancarla si los ítems 1/3/4 no son prioritarios todavía.
3. **Portal de cliente** — doctype `WO Client` ya creado en Frappe, sin usar por la app. Falta
   definir alcance (¿qué puede ver/hacer un cliente final? ¿login propio o solo un link con
   token?) antes de plantear el diseño técnico — arrancar esa conversación con el usuario, no
   asumir el approach.
4. **Tests** — no hay ninguno configurado en el template todavía. Definir con el usuario qué nivel
   (¿unit sobre `ALLOWED_TRANSITIONS`/parsers de Server Actions? ¿e2e?) antes de elegir
   herramienta (Vitest/Playwright/etc., ninguna instalada hoy).

Para retomar: preguntarle al usuario cuál de estos sigue (no asumir el orden de arriba como
obligatorio, es solo la lista tal como se fue acordando en esta sesión).
