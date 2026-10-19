import { redirect } from "next/navigation";

// El listado viejo de OTs se reemplazó por Operaciones (lista + kanban + panel lateral).
export default function WorkOrdersPage() {
  redirect("/operaciones");
}
