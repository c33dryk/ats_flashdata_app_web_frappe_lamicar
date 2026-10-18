import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { buttonVariants } from "@/components/ui/button";
import { FrappeApiError } from "@/lib/frappe/client";
import { getCatalogOptions, getWorkOrder, type WorkOrder } from "@/lib/frappe/work-orders";
import { labelOf, type DashboardCatalogs } from "@/lib/dashboard-metrics";
import { fileHref, isImage } from "@/lib/evidence";
import { fmtMileage } from "@/lib/format";
import { PrintButton } from "./print-button";

// Remito de entrega y conformidad, imprimible ("Guardar como PDF" desde el diálogo de impresión).
// Se ve como hoja de papel (blanca también en modo oscuro). Sin precios: el remito acredita la
// entrega y los trabajos realizados; los importes van en la factura.
//
// Migración a Frappe: Print Format de Work Order con el mismo contenido.

function fmtDateTime(value?: string) {
  if (!value) return "—";
  const d = new Date(value.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("es-AR", { dateStyle: "long", timeStyle: "short" });
}

export default async function RemitoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let wo: WorkOrder;
  let catalogs: DashboardCatalogs;
  try {
    [wo, catalogs] = await Promise.all([getWorkOrder(id), getCatalogOptions()]);
  } catch (err) {
    if (err instanceof FrappeApiError && err.status === 404) notFound();
    return (
      <p className="m-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        No se pudo leer la orden desde Frappe.
      </p>
    );
  }

  const signature = (wo.evidence ?? []).find((e) => e.type === "signature")?.url ?? wo.delivery_signature_url;
  const afterPhotos = (wo.evidence ?? []).filter((e) => e.type === "photo_after" && isImage(e)).slice(0, 4);
  const vehicleDetail = [
    labelOf(catalogs.vehicleTypes, wo.vehicle_type_id),
    wo.vehicle_year,
    wo.vehicle_color,
    fmtMileage(wo.vehicle_mileage),
  ]
    .filter(Boolean)
    .join(" · ");
  const service = [labelOf(catalogs.segments, wo.service_segment_id), labelOf(catalogs.services, wo.service_type_id)]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-1 flex-col">
      <Topbar>
        <Breadcrumbs items={[{ label: "Remitos", href: "/remitos" }, { label: wo.name }]} />
      </Topbar>

      <div className="flex-1 space-y-4 p-6 print:p-0">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 print:hidden">
          <Link href="/remitos" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft className="size-4" /> Remitos
          </Link>
          {wo.delivery_signed_at && <PrintButton />}
        </div>

        {!wo.delivery_signed_at && (
          <p className="mx-auto max-w-3xl rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            Esta orden todavía no tiene la entrega firmada: el remito se emite al entregar.
          </p>
        )}

        {/* Hoja */}
        <article className="mx-auto max-w-3xl space-y-6 rounded-lg bg-white p-8 text-sm text-neutral-900 shadow-sm ring-1 ring-black/10 print:max-w-none print:rounded-none print:p-0 print:shadow-none print:ring-0">
          <header className="flex items-start justify-between gap-6 border-b border-neutral-300 pb-4">
            <Image src="/lamicar-logo.png" alt="Lamicar Cristales" width={156} height={40} className="h-10 w-auto" />
            <div className="text-right">
              <p className="text-base font-bold tracking-tight">REMITO DE ENTREGA Y CONFORMIDAD</p>
              <p>
                Orden de trabajo <strong>{wo.name}</strong>
              </p>
              <p className="text-neutral-600">{fmtDateTime(wo.delivery_signed_at)}</p>
              {wo.siniestro && <p className="text-neutral-600">Siniestro {wo.siniestro}</p>}
            </div>
          </header>

          <section className="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
            <div>
              <h2 className="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Cliente</h2>
              <p className="font-semibold">{wo.customer_name}</p>
              {labelOf(catalogs.customerTypes, wo.customer_type_id) && (
                <p>{labelOf(catalogs.customerTypes, wo.customer_type_id)}</p>
              )}
              {wo.customer_phone && <p>Tel. {wo.customer_phone}</p>}
              {wo.customer_email && <p>{wo.customer_email}</p>}
            </div>
            <div>
              <h2 className="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Vehículo</h2>
              <p className="font-semibold">
                {wo.license_plate}
                {wo.vehicle_brand_model && ` · ${wo.vehicle_brand_model}`}
              </p>
              {vehicleDetail && <p>{vehicleDetail}</p>}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Trabajos realizados</h2>
            {service && <p className="mb-2 font-medium">{service}</p>}
            {wo.items?.length ? (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-neutral-300 text-left text-xs text-neutral-500">
                    <th className="py-1.5 pr-2 font-medium">Descripción</th>
                    <th className="w-20 py-1.5 text-right font-medium">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {wo.items.map((it, i) => (
                    <tr key={it.name ?? i} className="border-b border-neutral-200">
                      <td className="py-1.5 pr-2">{it.description}</td>
                      <td className="py-1.5 text-right tabular-nums">{it.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="whitespace-pre-line">{wo.description || "—"}</p>
            )}
          </section>

          {afterPhotos.length > 0 && (
            <section className="break-inside-avoid">
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                Registro fotográfico de la entrega
              </h2>
              <div className="grid grid-cols-4 gap-2">
                {afterPhotos.map((ph, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- archivo privado servido por /api/files
                  <img
                    key={ph.name ?? i}
                    src={fileHref(ph.url)}
                    alt={`Foto de entrega ${i + 1}`}
                    className="aspect-[4/3] w-full rounded object-cover ring-1 ring-black/10"
                  />
                ))}
              </div>
            </section>
          )}

          <section className="break-inside-avoid space-y-6 border-t border-neutral-300 pt-4">
            <p>
              El cliente recibe la unidad detallada en conformidad con los trabajos realizados, habiendo
              verificado su estado al momento de la entrega.
            </p>
            <div className="grid grid-cols-2 gap-10">
              <div className="flex flex-col items-center">
                <div className="flex h-24 w-full items-end justify-center border-b border-neutral-500">
                  {signature && (
                    // eslint-disable-next-line @next/next/no-img-element -- firma privada servida por /api/files
                    <img src={fileHref(signature)} alt="Firma del cliente" className="max-h-24 object-contain" />
                  )}
                </div>
                <p className="mt-1 text-xs text-neutral-600">Firma del cliente</p>
                <p className="font-medium">{wo.delivery_signed_by ?? ""}</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="h-24 w-full border-b border-neutral-500" />
                <p className="mt-1 text-xs text-neutral-600">Por Lamicar</p>
              </div>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
