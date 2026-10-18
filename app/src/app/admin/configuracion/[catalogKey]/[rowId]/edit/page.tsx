import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { CatalogRowForm } from "@/components/admin/catalog-row-form";
import { EvidencePolicyForm } from "@/components/admin/evidence-policy-form";
import { CATALOG_DEFS } from "@/lib/frappe/catalogs";
import { FrappeApiError } from "@/lib/frappe/client";
import { getDoc } from "@/lib/frappe/resource";
import { getCustomerTypes, getEvidencePolicy, getServiceSegments, type WoEvidencePolicy } from "@/lib/frappe/work-orders";

export default async function EditCatalogRowPage({
  params,
}: {
  params: Promise<{ catalogKey: string; rowId: string }>;
}) {
  const { catalogKey, rowId } = await params;
  const def = CATALOG_DEFS.find((d) => d.key === catalogKey);
  if (!def) notFound();

  const isEvidencePolicies = catalogKey === "evidence-policies";

  let row: Record<string, unknown> | null = null;
  let policy: WoEvidencePolicy | null = null;
  let segmentOptions: Awaited<ReturnType<typeof getServiceSegments>> = [];
  let customerTypes: Awaited<ReturnType<typeof getCustomerTypes>> = [];
  let errorMessage: string | null = null;

  try {
    if (isEvidencePolicies) {
      const [policyResult, types] = await Promise.all([getEvidencePolicy(rowId), getCustomerTypes()]);
      policy = policyResult;
      customerTypes = types;
    } else {
      const [rowResult, segments] = await Promise.all([
        getDoc<Record<string, unknown>>(def.doctype, rowId),
        getServiceSegments(),
      ]);
      row = rowResult;
      segmentOptions = segments;
    }
  } catch (err) {
    if (err instanceof FrappeApiError && err.status === 404) notFound();
    errorMessage =
      err instanceof FrappeApiError
        ? `No se pudo conectar con Frappe (${err.status}). Revisá FRAPPE_URL / FRAPPE_API_KEY / FRAPPE_API_SECRET en .env.`
        : "No se pudo conectar con Frappe. Revisá la configuración en .env.";
  }

  return (
    <div className="flex flex-1 flex-col">
      <Topbar>
        <Breadcrumbs
          items={[
            { label: "Configuración" },
            { label: def.label, href: `/admin/configuracion/${def.key}` },
            { label: `Editar ${rowId}` },
          ]}
        />
      </Topbar>

      <div className="flex-1 space-y-4 p-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Editar: {rowId}</h1>
        </div>

        {errorMessage ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : isEvidencePolicies ? (
          policy && <EvidencePolicyForm policy={policy} customerTypes={customerTypes} />
        ) : (
          row && <CatalogRowForm def={def} segmentOptions={segmentOptions} row={row} />
        )}
      </div>
    </div>
  );
}
