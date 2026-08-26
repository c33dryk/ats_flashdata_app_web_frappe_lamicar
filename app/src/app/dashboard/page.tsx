import { Topbar } from "@/components/shell/topbar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getList } from "@/lib/frappe/resource";
import { FrappeApiError } from "@/lib/frappe/client";

interface FrappeUserRow {
  name: string;
  full_name: string;
}

export default async function DashboardPage() {
  let users: FrappeUserRow[] = [];
  let errorMessage: string | null = null;

  try {
    users = await getList<FrappeUserRow>("User", {
      fields: ["name", "full_name"],
      limit: 20,
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
        <Breadcrumbs items={[{ label: "Dashboard" }]} />
      </Topbar>

      <div className="flex-1 space-y-4 p-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Ejemplo de lectura desde Frappe (doctype &quot;User&quot;) — reemplazar por las
            entidades reales del proyecto.
          </p>
        </div>

        {errorMessage ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nombre</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.name}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.full_name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
