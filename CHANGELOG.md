# Changelog

Versión de la app = `version` de `app/package.json` ([SemVer](https://semver.org/lang/es/)). Se ve
en el login y en el menú de usuario del sidebar (`v1.2.0 · <commit>`).

- **patch** (1.2.**1**): arreglos y parches de seguridad sin cambio de funcionalidad.
- **minor** (1.**3**.0): funcionalidad nueva (pantallas, campos, flujos).
- **major** (**2**.0.0): cambios que rompen algo para el usuario o requieren cambios en Frappe
  (`schema/CAMBIOS_FRAPPE.md`) antes de desplegar.

Release: `cd app && npm run release:minor` (o `:patch`/`:major`), anotar abajo, commit
`chore(release): vX.Y.Z`, `git tag -a vX.Y.Z -m vX.Y.Z`, `git push --follow-tags`.
Deploy en el server: `./deploy.sh` (o `./deploy.sh vX.Y.Z` para un release puntual).

## [Sin publicar]

## [1.2.0] - 2026-10-30

### Seguridad
- `/api/files`: bloqueado el path traversal que permitía leer la API de Frappe con el service account.
- Evidencia: solo fotos y PDF; los demás archivos se descargan en vez de abrirse en la app (XSS).
- Sesión con vencimiento validado en el server (12 h); hay que volver a iniciar sesión una vez.
- Login: usuarios de Frappe sin rol `WO *` ya no entran como auditor.
- Edición de OT: el técnico no recibe precios de lista; los ítems solo pueden ser de la misma OT.

### Agregado
- Versión visible en el login y en el menú de usuario del sidebar.
- `deploy.sh`: deploy de producción (pull + build con el commit + logs).
- Formularios de alta/edición de OT con pestañas, tableros por rol, políticas de evidencia por cliente.

## [0.1.0]
- Versión inicial: OT (listado, detalle, alta, edición, transiciones), catálogos, clientes y
  unidades, evidencia fotográfica y firma de entrega.
