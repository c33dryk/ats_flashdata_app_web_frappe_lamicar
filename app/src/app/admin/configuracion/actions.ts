"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { str } from "@/lib/form-data";
import { FrappeApiError } from "@/lib/frappe/client";
import { CATALOG_DEFS } from "@/lib/frappe/catalogs";
import { createDoc, updateDoc } from "@/lib/frappe/resource";
import {
  createEvidencePolicy,
  getEvidencePolicy,
  updateEvidencePolicy,
  type WoEvidencePolicy,
  type WoEvidenceRequirement,
} from "@/lib/frappe/work-orders";

export interface CatalogRowState {
  error: string | null;
}

export async function saveCatalogRowAction(
  _prevState: CatalogRowState,
  formData: FormData
): Promise<CatalogRowState> {
  const session = await getSession();
  if (!session || !can(session.role, "manageCatalogs")) {
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
  if (!session || !can(session.role, "manageCatalogs")) {
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

const STAGES = ["before", "during", "after", "delivery"] as const;

function parseRequirements(raw: string | undefined): WoEvidenceRequirement[] | null {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const requirements: WoEvidenceRequirement[] = [];
  for (const row of parsed) {
    if (typeof row !== "object" || row === null) return null;
    const r = row as Record<string, unknown>;
    const code = typeof r.code === "string" ? r.code.trim() : "";
    const label = typeof r.label === "string" ? r.label.trim() : "";
    if (!code || !label) return null;
    if (!STAGES.includes(r.stage as (typeof STAGES)[number])) return null;
    const minPhotos = Number(r.min_photos);
    if (!Number.isFinite(minPhotos) || minPhotos < 0) return null;

    requirements.push({
      name: typeof r.name === "string" && r.name ? r.name : undefined,
      code,
      label,
      stage: r.stage as WoEvidenceRequirement["stage"],
      min_photos: minPhotos,
      allow_exception: r.allow_exception ? 1 : 0,
    });
  }
  return requirements;
}

// Bespoke (no pasa por saveCatalogRowAction/def.fields) porque WO Evidence Policy tiene la
// tabla hija "requirements" — el pipeline genérico de catálogos solo sabe de campos planos.
export async function saveEvidencePolicyAction(
  _prevState: CatalogRowState,
  formData: FormData
): Promise<CatalogRowState> {
  const session = await getSession();
  if (!session || !can(session.role, "manageCatalogs")) {
    return { error: "No tenés permiso para editar catálogos." };
  }

  const requirements = parseRequirements(str(formData, "requirements_json"));
  if (requirements === null) {
    return { error: "Los requisitos cargados no son válidos." };
  }

  const policyName = str(formData, "policy_name");
  if (!policyName) return { error: "El nombre es obligatorio." };

  const data: Partial<WoEvidencePolicy> = {
    policy_name: policyName,
    customer_type_id: str(formData, "customer_type_id"),
    is_active: formData.get("is_active") === "on" ? 1 : 0,
    requirements,
  };

  const mode = str(formData, "mode");
  if (mode === "create") {
    const code = str(formData, "code");
    if (!code) return { error: "El código es obligatorio." };
    try {
      await createEvidencePolicy({ ...data, code });
    } catch (err) {
      return { error: catalogErrorMessage(err) };
    }
  } else if (mode === "update") {
    const originalName = str(formData, "original_name");
    if (!originalName) return { error: "Solicitud inválida." };
    const expectedModified = str(formData, "expected_modified");

    let fresh: WoEvidencePolicy;
    try {
      fresh = await getEvidencePolicy(originalName);
    } catch {
      return { error: "No se pudo leer la política. Recargá la página." };
    }
    if (fresh.modified !== expectedModified) {
      return { error: "Alguien más modificó esta política. Recargá la página." };
    }

    try {
      await updateEvidencePolicy(originalName, data);
    } catch (err) {
      return { error: catalogErrorMessage(err) };
    }
  } else {
    return { error: "Solicitud inválida." };
  }

  redirect("/admin/configuracion/evidence-policies");
}

function catalogErrorMessage(err: unknown): string {
  if (err instanceof FrappeApiError) {
    const body = err.body as { message?: string } | undefined;
    return body?.message ?? `No se pudo guardar (${err.status}).`;
  }
  return "No se pudo guardar el catálogo.";
}
