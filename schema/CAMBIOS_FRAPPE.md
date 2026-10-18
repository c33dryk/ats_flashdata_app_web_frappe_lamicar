# Cambios pendientes en Frappe (hub.lamicar.app)

Lista única de lo que la app necesita del lado de Frappe para los próximos módulos (sucursales,
evidencia por aseguradora, clientes y flota). Todo es **aditivo**: no se borra ni renombra nada
existente, así que se puede aplicar sin afectar las OTs actuales.

Convenciones que respetan los DocTypes nuevos (las mismas de los catálogos existentes): módulo
`Lamicar Services`, Custom DocType, el nombre del registro es un campo de negocio (`code`,
patente…), baja lógica con `is_active` (nunca se borra, porque las OTs referencian por Link).

> **Quién lo aplica:** un usuario Administrator / System Manager. La cuenta de servicio que usa la
> app **no** puede crear DocTypes (recibe 403 al leerlos, es lo esperado).

---

## 1. DocTypes nuevos

| DocType | Para qué | Definición |
|---|---|---|
| `WO Branch` | Sucursales / talleres | [`wo_branch.doctype.json`](wo_branch.doctype.json) |
| `WO Vehicle` | Flota: un registro por patente, ligado al cliente | [`wo_vehicle.doctype.json`](wo_vehicle.doctype.json) |

Se pueden crear por API (con la key de un Administrator):

```bash
curl -X POST "https://hub.lamicar.app/api/resource/DocType" \
  -H "Authorization: token <API_KEY_ADMIN>:<API_SECRET_ADMIN>" \
  -H "Content-Type: application/json" \
  --data @schema/wo_branch.doctype.json
```

(repetir con `wo_vehicle.doctype.json`; **crear `WO Vehicle` después de revisar el punto 3**,
porque tiene un Link a `WO Client`). O cargarlos a mano en Desk con los campos del JSON.

## 2. Campos nuevos en `Work Order`

Work Order es un Custom DocType: los campos se agregan editando el DocType en Desk.

| Campo | Tipo | Opciones | Obligatorio | Para qué |
|---|---|---|---|---|
| `branch_id` | Link | `WO Branch` | **No** | Sucursal donde se hace el trabajo |
| `evidence_policy_id` | Link | `WO Evidence Policy` | **No** | Qué política de fotos aplica (hoy hay 5 para `ASEG`, una por aseguradora, y la OT no lo guarda) |
| `client_id` | Link | `WO Client` | **No** | Cliente del maestro (los campos de texto `customer_name`/`customer_phone`/`customer_email` se mantienen como copia histórica) |
| `vehicle_id` | Link | `WO Vehicle` | **No** | Vehículo de la flota (`license_plate` y demás se mantienen como copia) |

⚠️ **Ninguno obligatorio en Frappe.** Las OTs existentes no tienen estos valores y Frappe valida
obligatorios en cada guardado: cualquier transición o edición de una OT vieja empezaría a fallar.
La obligatoriedad para OTs nuevas la valida la app.

Sugerido además: marcar `branch_id` y `client_id` como *In Standard Filter*.

Opcional: `branch_id` (Link `WO Branch`) también en **`WO Operator`**, si cada técnico pertenece a
una sucursal.

## 3. `WO Client` (ya existe, la app todavía no lo usa)

- La cuenta de servicio recibe **403** al leerlo: darle permiso (ver punto 4).
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

## 4. Permisos de la cuenta de servicio

El Role del usuario de la API (el de `FRAPPE_API_KEY`) necesita **leer / escribir / crear** en:
`WO Branch`, `WO Client`, `WO Vehicle` — igual que ya tiene en los otros catálogos. Sin esto, las
pantallas nuevas dan 403.

## 5. Revisar (sin cambios, solo confirmar)

- **`WO Evidence` → campo `zone`**: ¿es `Data` (texto libre) o `Select`? La app guarda ahí el
  código del requisito de la política (`FOTO_PANORAMICA`, …). Si es `Select`, cambiarlo a `Data`
  (los valores actuales se conservan). Mientras tanto la app tiene un plan B automático.
- **Políticas de evidencia**: las 5 activas tienen `customer_type_id = ASEG`. Confirmar que la
  idea es una política por aseguradora (con el campo `evidence_policy_id` del punto 2 se elige
  por OT).

---

### Cuando esté aplicado

Avisar y la app suma: ABM de sucursales, clientes y vehículos en Configuración; selector de
sucursal, cliente (con autocompletar) y vehículo por patente al crear la OT; política de
evidencia guardada en la OT; filtros por sucursal en Dashboard y Operaciones; pantalla
Clientes y Flota.
