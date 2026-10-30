import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Topbar } from "@/components/shell/topbar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { CatalogRowForm } from "@/components/admin/catalog-row-form";
import { EvidencePolicyForm } from "@/components/admin/evidence-policy-form";
import { CATALOG_DEFS } from "@/lib/frappe/catalogs";
import { FrappeApiError } from "@/lib/frappe/client";
import { getDoc, getList } from "@/lib/frappe/resource";
import {
  getBranches,
  getCustomerTypes,
  getEvidencePolicy,
  getServiceSegments,
  type WoEvidencePolicy,
} from "@/lib/frappe/work-orders";

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
  let branchOptions: Awaited<ReturnType<typeof getBranches>> = [];
  let customerTypes: Awaited<ReturnType<typeof getCustomerTypes>> = [];
  // Políticas: qué clientes (aseguradoras) tienen este convenio en su ficha.
  let policyClients: Array<{ name: string; client_name: string }> = [];
  let errorMessage: string | null = null;

  try {
    if (isEvidencePolicies) {
      const [policyResult, types, clients] = await Promise.all([
        getEvidencePolicy(rowId),
        getCustomerTypes(),
        getList<{ name: string; client_name: string }>("WO Client", {
          fields: ["name", "client_name"],
          filters: [["evidence_policy_id", "=", rowId]],
          orderBy: "client_name asc",
          limit: 0,
        }).catch(() => []),
      ]);
      policy = policyResult;
      customerTypes = types;
      policyClients = clients;
    } else {
      const [rowResult, segments, branches] = await Promise.all([
        getDoc<Record<string, unknown>>(def.doctype, rowId),
        getServiceSegments(),
        getBranches(),
      ]);
      row = rowResult;
      segmentOptions = segments;
      branchOptions = branches;
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
          policy && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Clientes con este convenio ({policyClients.length})</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Se asigna en la ficha de cada aseguradora (Clientes → Política de fotos). Al abrir una
                    OT para ese cliente, este checklist queda elegido solo.
                  </p>
                </CardHeader>
                <CardContent>
                  {policyClients.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ningún cliente tiene este convenio asignado todavía.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {policyClients.map((c) => (
                        <li key={c.name}>
                          <Link
                            href={`/clientes?c=${encodeURIComponent(c.name)}`}
                            className="inline-flex h-7 items-center rounded-md border border-border px-2.5 text-sm hover:bg-muted"
                          >
                            {c.client_name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <EvidencePolicyForm policy={policy} customerTypes={customerTypes} />
            </>
          )
        ) : (
          row && <CatalogRowForm def={def} segmentOptions={segmentOptions} branchOptions={branchOptions} row={row} />
        )}
      </div>
    </div>
  );
}
