"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SidePanel } from "@/components/ui/side-panel";
import { nativeSelectClassName } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { setVehicleActiveAction } from "@/app/clientes/actions";
import { labelOf, type CatalogOption } from "@/lib/dashboard-metrics";
import { cn } from "@/lib/utils";
import type { OrderRef, WoClient, WoVehicle } from "@/lib/clients-shared";
import { OrderList } from "./order-list";
import { VehicleForm } from "./vehicle-form";

// ABM de unidades (WO Vehicle, flota): listado, alta/edición en modal, baja lógica.

export function VehiclesBoard({
  vehicles,
  clients,
  ordersByVehicle,
  orderBase,
  vehicleTypes,
  customerTypes,
  canViewTaxId,
}: {
  vehicles: WoVehicle[];
  clients: WoClient[];
  /** Historial de OTs por patente (vinculadas o, en OTs viejas, por patente escrita). */
  ordersByVehicle: Record<string, OrderRef[]>;
  /** Pantalla donde se abren las OTs (/operaciones, o /facturacion para quien no ve el taller). */
  orderBase: string;
  vehicleTypes: CatalogOption[];
  customerTypes: CatalogOption[];
  canViewTaxId: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const searchParams = useSearchParams();
  // Ficha abierta en el panel: vive en la URL (?u=) para poder linkearla desde la OT.
  const [editing, setEditingState] = useState<WoVehicle | "new" | null>(
    () => vehicles.find((x) => x.name === searchParams.get("u")) ?? null
  );
  function setEditing(value: WoVehicle | "new" | null) {
    setEditingState(value);
    const url = new URL(window.location.href);
    if (value && value !== "new") url.searchParams.set("u", value.name);
    else url.searchParams.delete("u");
    window.history.replaceState(null, "", url);
  }
  const [pending, startTransition] = useTransition();

  const clientById = useMemo(() => new Map(clients.map((c) => [c.name, c])), [clients]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vehicles.filter(
      (v) =>
        (showInactive ? !v.is_active : v.is_active) &&
        (!type || v.vehicle_type_id === type) &&
        (!q ||
          [v.license_plate, v.brand_model, v.color, v.vin, clientById.get(v.client_id ?? "")?.client_name]
            .filter(Boolean)
            .some((x) => x!.toLowerCase().includes(q)))
    );
  }, [vehicles, query, type, showInactive, clientById]);
  const inactiveCount = vehicles.filter((v) => !v.is_active).length;

  function toggleActive(v: WoVehicle) {
    startTransition(async () => {
      const res = await setVehicleActiveAction(v.name, !v.is_active);
      if (!res.ok) {
        toast.add({ title: "No se pudo actualizar", description: res.error, type: "error", priority: "high" });
        return;
      }
      toast.add({ title: v.is_active ? `${v.license_plate} desactivada` : `${v.license_plate} reactivada`, type: "success" });
      setEditing(null);
      router.refresh();
    });
  }

  const current = editing && editing !== "new" ? editing : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por patente, modelo, color, chasis o dueño…"
            className="pl-8"
            aria-label="Buscar unidades"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={cn(nativeSelectClassName, "w-auto min-w-44")}
          aria-label="Categoría"
        >
          <option value="">Todas las categorías</option>
          {vehicleTypes.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        {inactiveCount > 0 && (
          <Button type="button" variant="outline" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? "← Ver activas" : `Inactivas (${inactiveCount})`}
          </Button>
        )}
        <Button type="button" className="ml-auto" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Nueva unidad
        </Button>
      </div>

      <Card className="gap-0 py-0">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {vehicles.length === 0
              ? "Todavía no hay unidades. Creá la primera acá o directamente al dar de alta una OT."
              : "No hay unidades con esos filtros."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patente</TableHead>
                <TableHead>Marca / modelo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Año / color</TableHead>
                <TableHead>Dueño</TableHead>
                <TableHead className="text-right">OTs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((v) => (
                <TableRow key={v.name} onClick={() => setEditing(v)} className="cursor-pointer">
                  <TableCell>
                    <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {v.license_plate}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{v.brand_model || "—"}</TableCell>
                  <TableCell>{labelOf(vehicleTypes, v.vehicle_type_id) ?? "—"}</TableCell>
                  <TableCell>{[v.year, v.color].filter(Boolean).join(" · ") || "—"}</TableCell>
                  <TableCell>{clientById.get(v.client_id ?? "")?.client_name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{ordersByVehicle[v.name]?.length ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {editing && (
        <SidePanel section="Unidades" title={current ? current.license_plate : "Nueva unidad"} onClose={() => setEditing(null)}>
          <div className="space-y-5 px-4 py-4 sm:px-6">
            <VehicleForm
              key={current?.name ?? "new"}
              initial={current ?? undefined}
              initialOwner={current?.client_id ? clientById.get(current.client_id) ?? null : null}
              vehicleTypes={vehicleTypes}
              customerTypes={customerTypes}
              canViewTaxId={canViewTaxId}
              onSaved={(v) => {
                toast.add({ title: current ? "Unidad actualizada" : `Unidad ${v.license_plate} creada`, type: "success" });
                setEditing(null);
                router.refresh();
              }}
              onCancel={() => setEditing(null)}
            />
            {current && (
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-sm font-medium">
                  Historial de órdenes ({ordersByVehicle[current.name]?.length ?? 0})
                </p>
                <OrderList orders={ordersByVehicle[current.name] ?? []} orderBase={orderBase} show="customer" />
              </div>
            )}
            {current && (
              <div className="flex justify-between border-t border-border pt-4">
                <span className="text-sm text-muted-foreground">
                  {current.is_active ? "Activa" : "Inactiva: no aparece al buscar patentes en una OT."}
                </span>
                <Button
                  type="button"
                  variant={current.is_active ? "destructive" : "outline"}
                  size="sm"
                  disabled={pending}
                  onClick={() => toggleActive(current)}
                >
                  {current.is_active ? "Desactivar" : "Reactivar"}
                </Button>
              </div>
            )}
          </div>
        </SidePanel>
      )}
    </div>
  );
}
