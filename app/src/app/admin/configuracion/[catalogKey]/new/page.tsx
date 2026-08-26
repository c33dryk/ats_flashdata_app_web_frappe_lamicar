import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { CatalogRowForm } from "@/components/admin/catalog-row-form";
import { CATALOG_DEFS } from "@/lib/frappe/catalogs";
import { FrappeApiError } from "@/lib/frappe/client";
import { getServiceSegments } from "@/lib/frappe/work-orders";

export default async function NewCatalogRowPage({
  params,
}: {
  params: Promise<{ catalogKey: string }>;
}) {
  const { catalogKey } = await params;
  const def = CATALOG_DEFS.find((d) => d.key === catalogKey);
  if (!def) notFound();

  let segmentOptions: Awaited<ReturnType<typeof getServiceSegments>> = [];
  let errorMessage: string | null = null;
  try {
    segmentOptions = await getServiceSegments();
  } catch (err) {
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
            { label: "Nuevo" },
          ]}
        />
      </Topbar>

      <div className="flex-1 space-y-4 p-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{def.newLabel}</h1>
        </div>

        {errorMessage ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : (
          <CatalogRowForm def={def} segmentOptions={segmentOptions} />
        )}
      </div>
    </div>
  );
}
