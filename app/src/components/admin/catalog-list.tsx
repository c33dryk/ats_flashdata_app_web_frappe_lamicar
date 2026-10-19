import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchableTable } from "@/components/searchable-table";
import { DeactivateCatalogRowButton } from "@/components/admin/deactivate-catalog-row-button";
import { ReactivateCatalogRowButton } from "@/components/admin/reactivate-catalog-row-button";
import { cn } from "@/lib/utils";
import type { CatalogDef } from "@/lib/frappe/catalogs";

function StatCard({
  label,
  value,
  href,
  active,
}: {
  label: string;
  value: number;
  href?: string;
  active?: boolean;
}) {
  const card = (
    <Card
      size="sm"
      className={cn(
        href && "cursor-pointer transition-colors hover:bg-muted/50",
        active && "ring-2 ring-foreground/60"
      )}
    >
      <CardHeader className="pb-0">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

export function CatalogList({
  def,
  rows,
  showInactive,
}: {
  def: CatalogDef;
  rows: Record<string, unknown>[];
  showInactive: boolean;
}) {
  const total = rows.length;
  const active = rows.filter((r) => !!r.is_active).length;
  const inactive = total - active;
  const visibleRows = rows.filter((r) => (showInactive ? !r.is_active : !!r.is_active));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total"
          value={total}
          href={`/admin/configuracion/${def.key}`}
          active={!showInactive}
        />
        <StatCard
          label="Activos"
          value={active}
          href={`/admin/configuracion/${def.key}`}
          active={!showInactive}
        />
        <StatCard
          label="Inactivos"
          value={inactive}
          href={`/admin/configuracion/${def.key}?inactive=1`}
          active={showInactive}
        />
      </div>

      {showInactive && (
        <Link
          href={`/admin/configuracion/${def.key}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Volver
        </Link>
      )}

      {visibleRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {showInactive ? "No hay filas inactivas." : "Sin filas para mostrar."}
        </p>
      ) : (
        <SearchableTable placeholder={`Buscar en ${def.label.toLowerCase()}...`}>
          <Table>
            <TableHeader>
              <TableRow>
                {def.listColumns.map((col) => {
                  const field = def.fields.find((f) => f.name === col);
                  const numeric = field?.type === "number";
                  return (
                    <TableHead key={col} className={numeric ? "text-center" : undefined}>
                      {field?.label ?? col}
                    </TableHead>
                  );
                })}
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => {
                const rowId = String(row[def.idField]);
                const searchText = def.listColumns
                  .map((col) => String(row[col] ?? ""))
                  .join(" ")
                  .toLowerCase();
                return (
                  <TableRow key={rowId} data-search={searchText}>
                    {def.listColumns.map((col) => {
                      const field = def.fields.find((f) => f.name === col);
                      const numeric = field?.type === "number";
                      return (
                        <TableCell key={col} className={numeric ? "text-center" : undefined}>
                          {String(row[col] ?? "—")}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Link
                          href={`/admin/configuracion/${def.key}/${encodeURIComponent(rowId)}/edit`}
                          className={buttonVariants({ variant: "outline", size: "icon-sm" })}
                          title="Editar"
                          aria-label="Editar"
                        >
                          <Pencil className="size-3.5" />
                        </Link>
                        {row.is_active ? (
                          <DeactivateCatalogRowButton catalogKey={def.key} rowId={rowId} />
                        ) : (
                          <ReactivateCatalogRowButton catalogKey={def.key} rowId={rowId} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </SearchableTable>
      )}
    </div>
  );
}
