import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { buttonVariants } from "@/components/ui/button";
import { CatalogList } from "@/components/admin/catalog-list";
import { CATALOG_DEFS } from "@/lib/frappe/catalogs";
import { getList } from "@/lib/frappe/resource";
import { FrappeApiError } from "@/lib/frappe/client";

export default async function CatalogListPage({
  params,
  searchParams,
}: {
  params: Promise<{ catalogKey: string }>;
  searchParams: Promise<{ inactive?: string }>;
}) {
  const { catalogKey } = await params;
  const { inactive } = await searchParams;
  const showInactive = inactive === "1";
  const def = CATALOG_DEFS.find((d) => d.key === catalogKey);
  if (!def) notFound();

  let rows: Record<string, unknown>[] = [];
  let errorMessage: string | null = null;

  try {
    rows = await getList<Record<string, unknown>>(def.doctype, {
      fields: def.fields.map((f) => f.name),
      orderBy: `${def.idField} asc`,
      limit: 0, // sin limit, Frappe corta en 20 filas
    });
  } catch (err) {
    errorMessage =
      err instanceof FrappeApiError
        ? `No se pudo conectar con Frappe (${err.status}). Revisá FRAPPE_URL / FRAPPE_API_KEY / FRAPPE_API_SECRET en .env.`
        : "No se pudo conectar con Frappe. Revisá la configuración en .env.";
  }

  return (
    <div className="flex flex-1 flex-col">
      <Topbar>
        <Breadcrumbs items={[{ label: "Configuración" }, { label: def.label }]} />
      </Topbar>

      <div className="flex-1 space-y-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{def.label}</h1>
            <p className="text-sm text-muted-foreground">
              Catálogo usado en las órdenes de trabajo.
            </p>
          </div>
          <Link href={`/admin/configuracion/${def.key}/new`} className={buttonVariants({})}>
            <Plus className="size-4" />
            Nuevo
          </Link>
        </div>

        {errorMessage ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : (
          <CatalogList def={def} rows={rows} showInactive={showInactive} />
        )}
      </div>
    </div>
  );
}
