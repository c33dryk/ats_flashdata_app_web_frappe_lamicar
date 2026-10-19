import { redirect } from "next/navigation";

// El alta de OT vive en el panel lateral de Operaciones (?nueva=1 lo abre).
export default function NewWorkOrderPage() {
  redirect("/operaciones?nueva=1");
}
