import { redirect } from "next/navigation";
import { CATALOG_DEFS } from "@/lib/frappe/catalogs";

export default function ConfiguracionPage() {
  redirect(`/admin/configuracion/${CATALOG_DEFS[0].key}`);
}
