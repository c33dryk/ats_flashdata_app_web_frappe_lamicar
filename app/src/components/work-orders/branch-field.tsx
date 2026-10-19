import Link from "next/link";
import { Label } from "@/components/ui/label";
import { nativeSelectClassName } from "@/components/ui/native-select";
import type { WoBranch } from "@/lib/frappe/work-orders";

// Sucursal / taller de la OT: primer campo del alta y de la edición. Se muestra siempre; si no hay
// sucursales cargadas lo avisa (y al admin le deja el link para cargarlas) en vez de esconderse.
// Obligatoria en el alta cuando hay sucursales (lo valida también el server).

export function BranchField({
  branches,
  required,
  defaultValue = "",
  canManage,
}: {
  branches: WoBranch[];
  required: boolean;
  defaultValue?: string;
  /** Puede cargar sucursales (admin): muestra el link a Configuración si no hay ninguna. */
  canManage?: boolean;
}) {
  if (branches.length === 0) {
    return (
      <div className="space-y-1">
        <span className="text-sm font-medium">Sucursal / taller</span>
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
          Todavía no hay sucursales cargadas.{" "}
          {canManage && (
            <Link href="/admin/configuracion/branches" className="font-medium text-foreground underline-offset-4 hover:underline">
              Cargarlas en Configuración
            </Link>
          )}
        </p>
      </div>
    );
  }

  // En edición, una sucursal que ya no está activa se sigue mostrando (si no, se perdería al guardar).
  const inactive = defaultValue && !branches.some((b) => b.name === defaultValue);
  return (
    <div className="space-y-1">
      <Label htmlFor="branch_id">Sucursal / taller{required ? " *" : ""}</Label>
      <select id="branch_id" name="branch_id" defaultValue={defaultValue} required={required} className={nativeSelectClassName}>
        <option value="">{required ? "Elegí la sucursal" : "Sin sucursal"}</option>
        {inactive && <option value={defaultValue}>{defaultValue} (inactiva)</option>}
        {branches.map((b) => (
          <option key={b.name} value={b.name}>
            {b.branch_name}
          </option>
        ))}
      </select>
    </div>
  );
}
