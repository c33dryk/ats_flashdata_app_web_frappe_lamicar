"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { saveEvidencePolicyAction, type CatalogRowState } from "@/app/admin/configuracion/actions";
import type { WoCustomerType, WoEvidencePolicy, WoEvidenceRequirement } from "@/lib/frappe/work-orders";

const selectClassName = nativeSelectClassName;

const STAGE_OPTIONS: { value: WoEvidenceRequirement["stage"]; label: string }[] = [
  { value: "before", label: "Antes" },
  { value: "during", label: "Durante" },
  { value: "after", label: "Después" },
  { value: "delivery", label: "Entrega" },
];

const initialState: CatalogRowState = { error: null };

export function EvidencePolicyForm({
  policy,
  customerTypes,
}: {
  policy?: WoEvidencePolicy;
  customerTypes: WoCustomerType[];
}) {
  const [state, formAction, pending] = useActionState(saveEvidencePolicyAction, initialState);
  const isEdit = !!policy;
  const [requirements, setRequirements] = useState<WoEvidenceRequirement[]>(
    policy?.requirements ?? []
  );

  function updateRequirement(index: number, patch: Partial<WoEvidenceRequirement>) {
    setRequirements((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRequirement() {
    setRequirements((prev) => [
      ...prev,
      { code: "", label: "", stage: "before", min_photos: 1, allow_exception: 0 },
    ]);
  }

  function removeRequirement(index: number) {
    setRequirements((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(formData: FormData) {
    formData.set("requirements_json", JSON.stringify(requirements));
    formAction(formData);
  }

  return (
    <form action={handleSubmit} className="w-full space-y-4">
      <input type="hidden" name="mode" value={isEdit ? "update" : "create"} />
      {isEdit && (
        <>
          <input type="hidden" name="original_name" value={policy.name} />
          <input type="hidden" name="expected_modified" value={policy.modified ?? ""} />
        </>
      )}

      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="code">Código *</Label>
          <Input
            id="code"
            name="code"
            required
            disabled={isEdit}
            defaultValue={policy?.code ?? ""}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="policy_name">Nombre *</Label>
          <Input id="policy_name" name="policy_name" required defaultValue={policy?.policy_name ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="customer_type_id">Tipo de Cliente</Label>
          <select
            id="customer_type_id"
            name="customer_type_id"
            defaultValue={policy?.customer_type_id ?? ""}
            className={selectClassName}
          >
            <option value="">Sin especificar</option>
            {customerTypes.map((ct) => (
              <option key={ct.name} value={ct.name}>
                {ct.customer_type_name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            defaultChecked={policy ? !!policy.is_active : true}
            className="h-4 w-4"
          />
          <Label htmlFor="is_active">Activo</Label>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Requisitos</Label>
        {requirements.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Etiqueta</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Mín. fotos</TableHead>
                <TableHead>Permite excepción</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requirements.map((req, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Input
                      value={req.code}
                      onChange={(e) => updateRequirement(i, { code: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={req.label}
                      onChange={(e) => updateRequirement(i, { label: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <select
                      value={req.stage}
                      onChange={(e) =>
                        updateRequirement(i, {
                          stage: e.target.value as WoEvidenceRequirement["stage"],
                        })
                      }
                      className={selectClassName}
                    >
                      {STAGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      className="w-20"
                      value={req.min_photos ?? 0}
                      onChange={(e) => updateRequirement(i, { min_photos: Number(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={!!req.allow_exception}
                      onChange={(e) =>
                        updateRequirement(i, { allow_exception: e.target.checked ? 1 : 0 })
                      }
                      className="h-4 w-4"
                    />
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeRequirement(i)}>
                      Quitar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Button type="button" variant="outline" size="sm" onClick={addRequirement}>
          Agregar requisito
        </Button>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
