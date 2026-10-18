# Cambios pendientes en Frappe (hub.lamicar.app)

Lista única de lo que la app necesita del lado de Frappe para los próximos módulos: facturas y
notas de crédito, remitos numerados, clientes y flota, política de evidencia por OT. Todo es
**aditivo**: no se borra ni renombra nada existente, así que se puede aplicar sin afectar las OTs
actuales.

Convenciones (las mismas de los catálogos existentes): módulo `Lamicar Services`, Custom DocType,
nombre del registro = un dato de negocio (código, patente, número de comprobante), baja lógica con
`is_active` / estado `Anulado` (nunca se borra, porque otros documentos referencian por Link).

> **Quién lo aplica:** un usuario Administrator / System Manager. La cuenta de servicio que usa la
> app **no** puede crear DocTypes (recibe 403 al leerlos, es lo esperado).

### Estado (verificado desde la app el 2026-10-18)

| Cambio | Estado |
|---|---|
| DocType `WO Branch` + permiso de la cuenta de servicio | ✅ aplicado |
| `Work Order.branch_id`, `WO Operator.branch_id` | ✅ aplicado |
| `WO Branch.point_of_sale` (punto de venta de remitos) | ⏳ pendiente |
| DocTypes `WO Invoice` + `WO Invoice Line` (facturas / NC / ND) | ⏳ pendiente |
| DocType `WO Delivery Note` (remitos numerados) | ⏳ pendiente |
| DocType `WO Vehicle` (flota) | ⏳ pendiente |
| Campos nuevos en `Work Order` (sección 3) | ⏳ pendiente |
| Permisos de la cuenta de servicio (sección 5) | ⏳ pendiente (`WO Client` sigue dando 403) |
| Confirmaciones (sección 6) | ⏳ pendiente |

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

## 4. `WO Client` (ya existe, la app todavía no lo usa)

- Pasarnos la lista de campos actual. Lo que la app necesita como mínimo:

| Campo | Tipo | Notas |
|---|---|---|
| `client_name` | Data, obligatorio | Nombre / razón social |
| `tax_id` | Data | CUIT / DNI — dato sensible, solo visible para roles que lo necesiten |
| `customer_type_id` | Link `WO Customer Type` | Particular, aseguradora, flota… |
| `phone`, `email` | Data | |
| `address` | Small Text | |
| `is_active` | Check, default 1 | Baja lógica |

Si los nombres reales difieren, no hace falta renombrarlos: la app se adapta.

## 5. Permisos de la cuenta de servicio

El Role del usuario de la API (el de `FRAPPE_API_KEY`) necesita **leer / escribir / crear** en:
`WO Client`, `WO Vehicle`, `WO Invoice`, `WO Delivery Note` (la tabla hija `WO Invoice Line`
hereda del padre). Sin esto, las pantallas nuevas dan 403.

## 6. Confirmar (sin cambios)

- **`WO Evidence` → campo `zone`**: ¿es `Data` (texto libre) o `Select`? La app guarda ahí el
  código del requisito de la política. Si es `Select`, pasarlo a `Data` (los valores actuales se
  conservan).
- **Políticas de evidencia**: las 5 activas tienen `customer_type_id = ASEG`. Confirmar que es
  una política por aseguradora.
- **Backups de Frappe Cloud**: que incluyan los **archivos privados** (fotos, firmas, PDFs de las
  OTs), no solo la base de datos.

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
