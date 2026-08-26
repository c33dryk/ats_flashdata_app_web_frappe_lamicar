"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { str } from "@/lib/form-data";
import { FrappeApiError } from "@/lib/frappe/client";
import { CATALOG_DEFS } from "@/lib/frappe/catalogs";
import { createDoc, updateDoc } from "@/lib/frappe/resource";

export interface CatalogRowState {
  error: string | null;
}

export async function saveCatalogRowAction(
  _prevState: CatalogRowState,
  formData: FormData
): Promise<CatalogRowState> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return { error: "No tenés permiso para editar catálogos." };
  }

  const catalogKey = str(formData, "catalog_key");
  const def = CATALOG_DEFS.find((d) => d.key === catalogKey);
  if (!def) return { error: "Catálogo inválido." };

  const mode = str(formData, "mode");
  const data: Record<string, unknown> = {};
  for (const field of def.fields) {
    if (field.type === "checkbox") {
      data[field.name] = formData.get(field.name) === "on" ? 1 : 0;
    } else if (field.type === "number") {
      const v = str(formData, field.name);
      data[field.name] = v ? Number(v) : undefined;
    } else {
      data[field.name] = str(formData, field.name);
    }
  }

  if (mode === "create") {
    if (!data[def.idField]) {
      return { error: "El código es obligatorio." };
    }
    try {
      await createDoc(def.doctype, data);
    } catch (err) {
      return { error: catalogErrorMessage(err) };
    }
  } else if (mode === "update") {
    const originalName = str(formData, "original_name");
    if (!originalName) return { error: "Solicitud inválida." };
    delete data[def.idField];
    try {
      await updateDoc(def.doctype, originalName, data);
    } catch (err) {
      return { error: catalogErrorMessage(err) };
    }
  } else {
    return { error: "Solicitud inválida." };
  }

  redirect(`/admin/configuracion/${def.key}`);
}

// "Eliminar"/"Deshacer" en el ABM = activar o desactivar (is_active), no borrado real — estos
// catálogos se referencian por Link desde Work Order, borrar de verdad rompería las órdenes que
// ya usan ese código. A diferencia de saveCatalogRowAction, esto NO recorre def.fields: solo
// toca is_active, así no pisa (con 0) otros checkboxes del mismo catálogo. Se invoca directo
// desde un onClick (no desde un <form>), por eso no usa el shape (prevState, formData) de
// useActionState ni hace redirect — el caller refresca la vista y muestra el toast.
export async function setCatalogRowActive(
  catalogKey: string,
  rowId: string,
  isActive: boolean
): Promise<CatalogRowState> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return { error: "No tenés permiso para editar catálogos." };
  }

  const def = CATALOG_DEFS.find((d) => d.key === catalogKey);
  if (!def) return { error: "Catálogo inválido." };

  try {
    await updateDoc(def.doctype, rowId, { is_active: isActive ? 1 : 0 });
  } catch (err) {
    return { error: catalogErrorMessage(err) };
  }

  revalidatePath(`/admin/configuracion/${def.key}`);
  return { error: null };
}

function catalogErrorMessage(err: unknown): string {
  if (err instanceof FrappeApiError) {
    const body = err.body as { message?: string } | undefined;
    return body?.message ?? `No se pudo guardar (${err.status}).`;
  }
  return "No se pudo guardar el catálogo.";
}
