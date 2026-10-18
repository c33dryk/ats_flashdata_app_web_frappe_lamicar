"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { saveCatalogRowAction, type CatalogRowState } from "@/app/admin/configuracion/actions";
import type { CatalogDef, CatalogFieldConfig } from "@/lib/frappe/catalogs";
import type { WoBranch, WoServiceSegment } from "@/lib/frappe/work-orders";

const selectClassName = nativeSelectClassName;

const initialState: CatalogRowState = { error: null };

type CatalogRow = Record<string, unknown>;

export function CatalogRowForm({
  def,
  segmentOptions,
  branchOptions = [],
  row,
}: {
  def: CatalogDef;
  segmentOptions: WoServiceSegment[];
  branchOptions?: WoBranch[];
  row?: CatalogRow;
}) {
  const [state, formAction, pending] = useActionState(saveCatalogRowAction, initialState);
  const isEdit = !!row;

  return (
    <form action={formAction} className="w-full space-y-4">
      <input type="hidden" name="catalog_key" value={def.key} />
      <input type="hidden" name="mode" value={isEdit ? "update" : "create"} />
      {isEdit && <input type="hidden" name="original_name" value={String(row![def.idField])} />}

      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {def.fields.map((field) => (
          <CatalogField
            key={field.name}
            field={field}
            def={def}
            segmentOptions={segmentOptions}
            branchOptions={branchOptions}
            defaultValue={row?.[field.name]}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  );
}

function CatalogField({
  field,
  def,
  segmentOptions,
  branchOptions,
  defaultValue,
}: {
  field: CatalogFieldConfig;
  def: CatalogDef;
  segmentOptions: WoServiceSegment[];
  branchOptions: WoBranch[];
  defaultValue: unknown;
}) {
  const isIdField = field.name === def.idField;
  const isEdit = defaultValue !== undefined && isIdField;

  if (field.type === "checkbox") {
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={field.name}
          name={field.name}
          defaultChecked={defaultValue === undefined ? field.name === "is_active" : !!defaultValue}
          className="h-4 w-4"
        />
        <Label htmlFor={field.name}>{field.label}</Label>
      </div>
    );
  }

  if (field.type === "branch-select") {
    return (
      <div className="space-y-1">
        <Label htmlFor={field.name}>
          {field.label}
          {field.required ? " *" : ""}
        </Label>
        <select
          id={field.name}
          name={field.name}
          required={field.required}
          defaultValue={(defaultValue as string) ?? ""}
          className={selectClassName}
        >
          <option value="">Sin sucursal</option>
          {branchOptions.map((b) => (
            <option key={b.name} value={b.name}>
              {b.branch_name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "segment-select") {
    return (
      <div className="space-y-1">
        <Label htmlFor={field.name}>
          {field.label}
          {field.required ? " *" : ""}
        </Label>
        <select
          id={field.name}
          name={field.name}
          required={field.required}
          defaultValue={(defaultValue as string) ?? ""}
          className={selectClassName}
        >
          <option value="">Sin especificar</option>
          {segmentOptions.map((s) => (
            <option key={s.name} value={s.name}>
              {s.segment_name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={field.name}>
        {field.label}
        {field.required ? " *" : ""}
      </Label>
      <Input
        id={field.name}
        name={field.name}
        type={field.type === "number" ? "number" : "text"}
        required={field.required}
        disabled={isEdit}
        defaultValue={defaultValue === undefined || defaultValue === null ? "" : String(defaultValue)}
      />
    </div>
  );
}
