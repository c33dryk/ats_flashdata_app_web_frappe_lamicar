# Cambios pendientes en Frappe (hub.lamicar.app)

Lista única de lo que la app necesita del lado de Frappe para los próximos módulos: facturas y
notas de crédito, remitos numerados, clientes y flota, política de evidencia por OT. Todo es
**aditivo**: no se borra ni renombra nada existente, así que se puede aplicar sin afectar las OTs
actuales.

Convenciones (las mismas de los catálogos existentes): módulo `Lamicar Services`, doctype de la
app `lamicar_services` (no Custom, ver abajo), nombre del registro = un dato de negocio (código, patente, número de comprobante), baja lógica con
`is_active` / estado `Anulado` (nunca se borra, porque otros documentos referencian por Link).

> **Cómo se aplica:** los doctypes de Lamicar **no son Custom DocTypes**: son archivos de la app
> Frappe `lamicar_services` (`/opt/ATS/VersatileHub/services/lamicar/data/apps/lamicar_services/`,
> repo git propio). Un cambio = editar o agregar el JSON del doctype ahí + `bench --site
> hub.lamicar.app migrate` (lo hace quien tiene acceso al servidor). No usar Desk ni
> `POST /api/resource/DocType`: quedaría como Custom, fuera del repo. La cuenta de servicio de la
> app no puede crear DocTypes (403, es lo esperado). Los JSON de esta carpeta son la
> **especificación**; la fuente de verdad es la app Frappe. Los pasos "por API / en Desk" de más
> abajo quedan solo como referencia de los campos.

### Estado (verificado desde la app el 2026-10-18)

| Cambio | Estado |
|---|---|
| DocType `WO Branch` + permiso de la cuenta de servicio | ✅ aplicado |
| `Work Order.branch_id`, `WO Operator.branch_id` | ✅ aplicado |
| `WO Branch.point_of_sale` (punto de venta de remitos) | ⏳ pendiente |
| DocTypes `WO Invoice` + `WO Invoice Line` (facturas / NC / ND) | ⏳ pendiente |
| DocType `WO Delivery Note` (remitos numerados) | ⏳ pendiente |
| DocType `WO Vehicle` (flota) | ✅ aplicado 2026-10-18 |
| DocType `WO Client` (**no existía**, se creó; sección 4) | ✅ aplicado 2026-10-18 |
| `Work Order.evidence_policy_id`, `.client_id`, `.vehicle_id` | ✅ aplicado 2026-10-18 |
| `Work Order.delivery_note_id`, `.invoiced_net` | ⏳ pendiente (dependen de `WO Delivery Note`) |
| Permisos de la cuenta de servicio (sección 5) | ✅ `WO Client` y `WO Vehicle` · ⏳ `WO Invoice`, `WO Delivery Note` |
| `WO Evidence.zone` → `Data` (sección 6) | ✅ aplicado 2026-10-18 (era `Select`) |
| Backups (sección 6) | ⚠️ **no hay backup automático** (ver sección 6) |

---

## 1. Decisiones de negocio que reflejan estos cambios

- **Facturas**: Lamicar no emite desde la app; las cargan (y más adelante se integran con
  **Tango**, buscando el comprobante allá e imputándolo). Una factura puede cubrir **una o varias
  OTs**, puede ser **parcial**, y existen **notas de crédito** (y débito). → La factura es un
  documento propio con renglones por OT; la OT queda **Facturada automáticamente cuando el saldo
  llega a 0** (FC + ND − NC ≥ total neto de la OT).
- **Remitos**: **numeración automática**, **un punto de venta por sucursal**, **una OT por
  remito**. El número lo asigna Frappe (no la app), así nunca se repite aunque se emitan dos a la
  vez. Un remito anulado conserva su número.
- No se usan **Sales Invoice / Delivery Note de ERPNext**: generan asientos contables y la
  contabilidad la lleva Tango. Estos DocTypes livianos siguen siendo 100% Frappe.

## 2. DocTypes nuevos

Crear **en este orden** (por los Link entre ellos):

| # | DocType | Para qué | Definición |
|---|---|---|---|
| 1 | `WO Vehicle` | Flota: un registro por patente, ligado al cliente | [`wo_vehicle.doctype.json`](wo_vehicle.doctype.json) |
| 2 | `WO Invoice Line` | Tabla hija: a qué OT se imputa cada importe del comprobante | [`wo_invoice_line.doctype.json`](wo_invoice_line.doctype.json) |
| 3 | `WO Invoice` | Comprobante de venta: FC / NC / ND | [`wo_invoice.doctype.json`](wo_invoice.doctype.json) |
| 4 | `WO Delivery Note` | Remito de entrega numerado | [`wo_delivery_note.doctype.json`](wo_delivery_note.doctype.json) |

Se pueden crear por API (con la key de un Administrator), uno por uno:

```bash
curl -X POST "https://hub.lamicar.app/api/resource/DocType" \
  -H "Authorization: token <API_KEY_ADMIN>:<API_SECRET_ADMIN>" \
  -H "Content-Type: application/json" \
  --data @schema/wo_invoice_line.doctype.json
```

O cargarlos a mano en Desk con los campos del JSON.

### Detalles de numeración (importante)

- **`WO Invoice`** → nombre `format:{voucher_type}-{letter}-{point_of_sale}-{number}`, por
  ejemplo `FC-A-00003-00001234`. Es la misma clave que usa Tango. Como el nombre es único, **no
  se puede cargar dos veces el mismo comprobante**.
- **`WO Delivery Note`** → nombre `format:R-{point_of_sale}-{########}`, por ejemplo
  `R-0001-00000001`. Frappe lleva un contador **separado por cada punto de venta**.
  **Verificar con un remito de prueba en dos sucursales** que cada una arranque en 1; si la
  versión de Frappe no separa el contador por prefijo, avisar y lo resolvemos con *Naming Series*.

## 3. Campos nuevos en DocTypes existentes

Se agregan editando el DocType en Desk.

**`Work Order`**

| Campo | Tipo | Opciones | Para qué |
|---|---|---|---|
| `evidence_policy_id` | Link | `WO Evidence Policy` | Qué política de fotos aplica (hoy hay 5 para `ASEG`, una por aseguradora) |
| `client_id` | Link | `WO Client` | Cliente del maestro (`customer_name` y demás se mantienen como copia histórica) |
| `vehicle_id` | Link | `WO Vehicle` | Vehículo de la flota (`license_plate` y demás se mantienen como copia) |
| `delivery_note_id` | Link | `WO Delivery Note` | Remito vigente de la OT |
| `invoiced_net` | Currency | — (solo lectura) | Neto facturado acumulado (FC + ND − NC); lo mantiene la app |

**`WO Branch`**

| Campo | Tipo | Para qué |
|---|---|---|
| `point_of_sale` | Data | Punto de venta de los remitos de esa sucursal, con ceros (ej. `0001`) |

⚠️ **Ningún campo nuevo obligatorio en Frappe.** Las OTs existentes no tienen estos valores y
Frappe valida obligatorios en cada guardado: cualquier transición o edición de una OT vieja
empezaría a fallar. La obligatoriedad para registros nuevos la valida la app.

Sugerido: marcar `client_id` como *In Standard Filter* en Work Order.

## 4. `WO Client` ✅ (creado 2026-10-18)

**No existía** en el site: el 403 que recibía la cuenta de servicio no era de permisos, sino que
Frappe responde 403 también para doctypes inexistentes. Se creó con estos campos:

| Campo | Tipo | Notas |
|---|---|---|
| `client_name` | Data, obligatorio | Nombre / razón social (title field) |
| `customer_type_id` | Link `WO Customer Type` | In Standard Filter |
| `tax_id` | Data | CUIT / DNI. **permlevel 1**: en Desk solo lo ven Admin, Recepción y Facturador. La cuenta de la API es WO Admin y lo recibe siempre: si algún rol no debe verlo, ocultarlo en la app |
| `phone` | Data (Phone) | |
| `email` | Data (Email) | |
| `address` | Small Text | |
| `is_active` | Check, default 1 | Baja lógica |

Nombre del registro: serie `CLI-#####` (no hay un campo natural único; el CUIT/DNI puede faltar).
`Work Order.client_id` quedó como *In Standard Filter*.

## 5. Permisos de la cuenta de servicio

El usuario de la API tiene el rol **WO Admin**. Necesita **leer / escribir / crear** en:
`WO Client` ✅, `WO Vehicle` ✅ (verificado creando y editando registros), `WO Invoice` ⏳,
`WO Delivery Note` ⏳ (la tabla hija `WO Invoice Line` hereda del padre). `WO Recepcion` también
crea clientes y vehículos; el resto de los roles solo lee. Borrar: solo System Manager.

## 6. Confirmar (sin cambios)

- ✅ **`WO Evidence` → campo `zone`**: era `Select`, se pasó a `Data`. Los valores existentes se
  conservaron.
- **Políticas de evidencia**: las 5 activas tienen `customer_type_id = ASEG`. Confirmar que es
  una política por aseguradora.
- ⚠️ **Backups**: no es Frappe Cloud sino self-hosted, y hoy `hub.lamicar.app` **no tiene backup
  automático**: ni backups programados de Frappe ni Restic (los scripts de `/opt/ATS/restic`
  apuntan a rutas y bases que no son las de Lamicar, y no hay cron). Fotos, firmas, PDFs y base
  de datos no tienen copia externa. Pendiente con infraestructura.

---

### Datos existentes

- Las OTs ya facturadas guardan la factura en campos de la propia OT (`invoice_number`,
  `invoice_date`, `invoice_amount`, `invoice_file_url`). Se mantienen; cuando exista
  `WO Invoice`, la app ofrece migrarlas (una factura por OT, como fueron cargadas).
- Las entregas ya firmadas no tienen remito numerado: se muestran como "remito anterior, sin
  número". No se les asigna número retroactivo salvo que se pida.

### Cuando esté aplicado

Avisar y la app suma: carga de comprobantes (FC/NC/ND) con imputación a una o varias OTs y saldo
por OT; remito numerado al entregar; ABM de clientes y vehículos; selector de cliente
(autocompletar) y vehículo por patente al crear la OT; política de evidencia guardada en la OT;
pantalla Clientes y Flota.
