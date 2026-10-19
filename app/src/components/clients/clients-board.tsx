"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
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
import { setClientActiveAction } from "@/app/clientes/actions";
import { labelOf, type CatalogOption } from "@/lib/dashboard-metrics";
import { cn } from "@/lib/utils";
import type { OrderRef, WoClient, WoVehicle } from "@/lib/clients-shared";
import { OrderList } from "./order-list";
import { ClientForm } from "./client-form";

// ABM de clientes (WO Client): listado con búsqueda, alta/edición en modal, baja lógica.

export function ClientsBoard({
  clients,
  vehicles,
  ordersByClient,
  orderBase,
  customerTypes,
  canViewTaxId,
}: {
  clients: WoClient[];
  vehicles: WoVehicle[];
  /** OTs de cada cliente (Work Order.client_id), más nuevas primero. */
  ordersByClient: Record<string, OrderRef[]>;
  /** Pantalla donde se abren las OTs (/operaciones, o /facturacion para quien no ve el taller). */
  orderBase: string;
  customerTypes: CatalogOption[];
  canViewTaxId: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const searchParams = useSearchParams();
  // Ficha abierta en el panel: vive en la URL (?c=) para poder linkearla desde la OT.
  const [editing, setEditingState] = useState<WoClient | "new" | null>(
    () => clients.find((x) => x.name === searchParams.get("c")) ?? null
  );
  function setEditing(value: WoClient | "new" | null) {
    setEditingState(value);
    const url = new URL(window.location.href);
    if (value && value !== "new") url.searchParams.set("c", value.name);
    else url.searchParams.delete("c");
    window.history.replaceState(null, "", url);
  }
  const [pending, startTransition] = useTransition();

  const vehiclesByClient = useMemo(() => {
    const map = new Map<string, WoVehicle[]>();
    for (const v of vehicles) if (v.client_id) map.set(v.client_id, [...(map.get(v.client_id) ?? []), v]);
    return map;
  }, [vehicles]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter(
      (c) =>
        (showInactive ? !c.is_active : c.is_active) &&
        (!type || c.customer_type_id === type) &&
        (!q ||
          [c.client_name, c.tax_id, c.phone, c.email, c.name]
            .filter(Boolean)
            .some((v) => v!.toLowerCase().includes(q)))
    );
  }, [clients, query, type, showInactive]);
  const inactiveCount = clients.filter((c) => !c.is_active).length;

  function toggleActive(c: WoClient) {
    startTransition(async () => {
      const res = await setClientActiveAction(c.name, !c.is_active);
      if (!res.ok) {
        toast.add({ title: "No se pudo actualizar", description: res.error, type: "error", priority: "high" });
        return;
      }
      toast.add({ title: c.is_active ? `${c.client_name} desactivado` : `${c.client_name} reactivado`, type: "success" });
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
            placeholder={canViewTaxId ? "Buscar por nombre, CUIT, teléfono o email…" : "Buscar por nombre, teléfono o email…"}
            className="pl-8"
            aria-label="Buscar clientes"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={cn(nativeSelectClassName, "w-auto min-w-44")}
          aria-label="Tipo de cliente"
        >
          <option value="">Todos los tipos</option>
          {customerTypes.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        {inactiveCount > 0 && (
          <Button type="button" variant="outline" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? "← Ver activos" : `Inactivos (${inactiveCount})`}
          </Button>
        )}
        <Button type="button" className="ml-auto" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Nuevo cliente
        </Button>
      </div>

      <Card className="gap-0 py-0">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {clients.length === 0
              ? "Todavía no hay clientes. Creá el primero acá o directamente al dar de alta una OT."
              : "No hay clientes con esos filtros."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                {canViewTaxId && <TableHead>CUIT / DNI</TableHead>}
                <TableHead>Contacto</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead className="text-right">OTs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((c) => (
                <TableRow key={c.name} onClick={() => setEditing(c)} className="cursor-pointer">
                  <TableCell>
                    <span className="font-medium">{c.client_name}</span>
                    <span className="block text-xs text-muted-foreground">{c.name}</span>
                  </TableCell>
                  <TableCell>{labelOf(customerTypes, c.customer_type_id) ?? "—"}</TableCell>
                  {canViewTaxId && <TableCell className="tabular-nums">{c.tax_id || "—"}</TableCell>}
                  <TableCell>
                    {c.phone || "—"}
                    {c.email && <span className="block text-xs text-muted-foreground">{c.email}</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{vehiclesByClient.get(c.name)?.length ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{ordersByClient[c.name]?.length ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {editing && (
        <SidePanel section="Clientes" title={current ? current.client_name : "Nuevo cliente"} onClose={() => setEditing(null)}>
          <div className="space-y-5 px-4 py-4 sm:px-6">
            <ClientForm
              key={current?.name ?? "new"}
              initial={current ?? undefined}
              customerTypes={customerTypes}
              canViewTaxId={canViewTaxId}
              onSaved={(c) => {
                toast.add({ title: current ? "Cliente actualizado" : `Cliente ${c.client_name} creado`, type: "success" });
                setEditing(null);
                router.refresh();
              }}
              onCancel={() => setEditing(null)}
            />
            {current && (
              <>
                <div className="space-y-2 border-t border-border pt-4">
                  <p className="text-sm font-medium">Unidades de este cliente</p>
                  {(vehiclesByClient.get(current.name) ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin unidades asociadas.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {(vehiclesByClient.get(current.name) ?? []).map((v) => (
                        <li key={v.name}>
                          <Link
                            href={`/unidades?u=${encodeURIComponent(v.name)}`}
                            className="block rounded-md border border-border px-2 py-1 text-sm hover:bg-muted/50"
                          >
                            <span className="font-mono text-xs">{v.license_plate}</span>{" "}
                            <span className="text-muted-foreground">{v.brand_model}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="space-y-2 border-t border-border pt-4">
                  <p className="text-sm font-medium">
                    Órdenes de trabajo ({ordersByClient[current.name]?.length ?? 0})
                  </p>
                  <OrderList orders={ordersByClient[current.name] ?? []} orderBase={orderBase} show="plate" />
                </div>
                <div className="flex justify-between border-t border-border pt-4">
                  <span className="text-sm text-muted-foreground">
                    {current.is_active ? "Activo" : "Inactivo: no aparece al buscar clientes en una OT."}
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
              </>
            )}
          </div>
        </SidePanel>
      )}
    </div>
  );
}
