"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WoServiceSegment, WoServiceType, WorkOrderItem } from "@/lib/frappe/work-orders";

// Presupuesto de la OT (tabla hija `Work Order Item`): los ítems salen del catálogo
// segmento → tipo de trabajo (con su precio de lista, editable) o se cargan libres. Son lo que
// después se factura. El estado vive en el form (viaja como `items_json`) y el total lo
// recalcula también la Server Action — en Frappe no hay controller que lo sume.
// En el panel angosto cada ítem ocupa dos líneas (descripción arriba, números abajo); con ancho
// suficiente pasa a una fila tipo tabla.

const priceGrid =
  "grid grid-cols-[4.5rem_minmax(0,1fr)_auto_2rem] items-center gap-2 @xl:grid-cols-[minmax(0,1fr)_4.5rem_8rem_7rem_2rem]";
// Sin precios (técnico): descripción, cantidad y quitar, en una sola fila.
const plainGrid = "grid grid-cols-[minmax(0,1fr)_4.5rem_2rem] items-center gap-2";

export function ItemsEditor({
  items,
  onChange,
  showPrices = true,
  serviceSegments = [],
  serviceTypes = [],
  defaultSegment = "",
}: {
  items: WorkOrderItem[];
  onChange: (items: WorkOrderItem[]) => void;
  /** false = técnico: carga descripción y cantidad; el precio lo pone el server (catálogo) o recepción. */
  showPrices?: boolean;
  /** Catálogo para "Agregar del catálogo" (si viene vacío, solo ítems libres). */
  serviceSegments?: WoServiceSegment[];
  serviceTypes?: WoServiceType[];
  /** Segmento de la OT: el catálogo arranca filtrado por ese. */
  defaultSegment?: string;
}) {
  const total = items.reduce((acc, it) => acc + (it.quantity || 0) * (it.unit_price_net || 0), 0);
  const rowGrid = showPrices ? priceGrid : plainGrid;
  const serviceName = useMemo(() => new Map(serviceTypes.map((s) => [s.name, s.service_name])), [serviceTypes]);

  function update(index: number, patch: Partial<WorkOrderItem>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  return (
    <div className="@container space-y-3">
      {serviceTypes.length > 0 && (
        <CatalogAdder
          key={defaultSegment}
          serviceSegments={serviceSegments}
          serviceTypes={serviceTypes}
          defaultSegment={defaultSegment}
          showPrices={showPrices}
          onAdd={(svc) =>
            onChange([
              ...items,
              {
                description: svc.service_name,
                quantity: 1,
                unit_price_net: svc.suggested_price ?? 0,
                service_type_id: svc.name,
              },
            ])
          }
        />
      )}

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          {showPrices ? "Sin trabajos cargados. Agregalos del catálogo para valorizar la orden." : "Sin trabajos cargados."}
        </p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          <div className={`${rowGrid} hidden bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground @xl:grid`}>
            <span>Descripción</span>
            <span>Cant.</span>
            {showPrices && <span>Unitario</span>}
            {showPrices && <span className="text-right">Subtotal</span>}
            <span />
          </div>
          {items.map((item, i) => (
            <div key={item.name ?? `new-${i}`} className={`${rowGrid} px-3 py-2.5`}>
              <div className={cn("min-w-0 space-y-0.5", showPrices && "col-span-4 @xl:col-span-1")}>
                <Input
                  aria-label={`Descripción del ítem ${i + 1}`}
                  placeholder="Descripción del trabajo o repuesto"
                  value={item.description}
                  autoFocus={!item.name && !item.service_type_id && i === items.length - 1 && !item.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                />
                {item.service_type_id && (
                  <p className="truncate text-[11px] text-muted-foreground">
                    Catálogo: {serviceName.get(item.service_type_id) ?? item.service_type_id}
                  </p>
                )}
              </div>
              <Input
                aria-label={`Cantidad del ítem ${i + 1}`}
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={item.quantity}
                onChange={(e) => update(i, { quantity: Number(e.target.value) })}
              />
              {showPrices && (
                <>
                  <Input
                    aria-label={`Precio unitario neto del ítem ${i + 1}`}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="Precio unit."
                    value={item.unit_price_net}
                    onChange={(e) => update(i, { unit_price_net: Number(e.target.value) })}
                  />
                  <span className="text-right text-sm tabular-nums">
                    {fmtMoney((item.quantity || 0) * (item.unit_price_net || 0))}
                  </span>
                </>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Quitar ítem"
                aria-label={`Quitar ítem ${i + 1}`}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange([...items, { description: "", quantity: 1, unit_price_net: 0 }])}
        >
          <Plus className="size-4" /> Ítem libre
        </Button>
        {showPrices ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Total neto </span>
            <span className="font-semibold tabular-nums">{fmtMoney(total)}</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Los precios salen del catálogo o los carga recepción.</p>
        )}
      </div>
    </div>
  );
}

/** Segmento → tipo de trabajo (con precio de lista) → agrega el ítem. */
function CatalogAdder({
  serviceSegments,
  serviceTypes,
  defaultSegment,
  showPrices,
  onAdd,
}: {
  serviceSegments: WoServiceSegment[];
  serviceTypes: WoServiceType[];
  defaultSegment: string;
  showPrices: boolean;
  onAdd: (svc: WoServiceType) => void;
}) {
  const [segment, setSegment] = useState(defaultSegment);
  const [serviceId, setServiceId] = useState("");
  const options = segment ? serviceTypes.filter((s) => s.segment === segment) : serviceTypes;
  const selected = serviceTypes.find((s) => s.name === serviceId);

  return (
    <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3 @lg:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] @lg:items-end">
      <label className="space-y-1">
        <span className="text-xs text-muted-foreground">Segmento</span>
        <select
          value={segment}
          onChange={(e) => {
            setSegment(e.target.value);
            setServiceId("");
          }}
          className={nativeSelectClassName}
        >
          <option value="">Todos</option>
          {serviceSegments.map((s) => (
            <option key={s.name} value={s.name}>
              {s.segment_name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-xs text-muted-foreground">Tipo de trabajo</span>
        <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className={nativeSelectClassName}>
          <option value="">Elegí del catálogo…</option>
          {options.map((s) => (
            <option key={s.name} value={s.name}>
              {s.service_name}
              {showPrices && s.suggested_price ? ` (${fmtMoney(s.suggested_price)})` : ""}
            </option>
          ))}
        </select>
      </label>
      <Button
        type="button"
        variant="outline"
        disabled={!selected}
        onClick={() => {
          if (!selected) return;
          onAdd(selected);
          setServiceId("");
        }}
      >
        <Plus className="size-4" /> Agregar
      </Button>
    </div>
  );
}
