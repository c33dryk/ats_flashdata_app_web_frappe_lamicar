"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { nativeSelectClassName } from "@/components/ui/native-select";
import {
  addEvidenceAction,
  removeEvidenceAction,
  type AddEvidenceState,
} from "@/app/work-orders/[id]/actions";
import type { WoEvidencePolicy, WoEvidenceRequirement, WorkOrder } from "@/lib/frappe/work-orders";
import type { AppRole } from "@/lib/auth-shared";
import { can } from "@/lib/permissions";

const selectClassName = nativeSelectClassName;

const LOCKED_STATUSES = ["Facturada", "Anulada"] as const;

const PHOTO_TYPE_OPTIONS: { value: "photo_before" | "photo_during" | "photo_after"; label: string }[] = [
  { value: "photo_before", label: "Antes" },
  { value: "photo_during", label: "Durante" },
  { value: "photo_after", label: "Después" },
];

const STAGE_TO_PHOTO_TYPE: Record<WoEvidenceRequirement["stage"], string | null> = {
  before: "photo_before",
  during: "photo_during",
  after: "photo_after",
  delivery: null, // ya cubierto por la firma de entrega (delivery_signed_at), no por fotos
};

const STAGE_LABELS: Record<WoEvidenceRequirement["stage"], string> = {
  before: "Antes",
  during: "Durante",
  after: "Después",
  delivery: "Entrega",
};

const initialState: AddEvidenceState = { error: null, success: false };

function ChecklistCard({ policy, workOrder }: { policy: WoEvidencePolicy; workOrder: WorkOrder }) {
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Checklist — {policy.policy_name}
      </p>
      <div className="flex flex-wrap gap-2">
        {(policy.requirements ?? []).map((req, i) => {
          const photoType = STAGE_TO_PHOTO_TYPE[req.stage];
          const count = photoType
            ? (workOrder.evidence ?? []).filter((e) => e.type === photoType).length
            : req.stage === "delivery" && workOrder.delivery_signed_at
              ? 1
              : 0;
          const min = req.min_photos ?? 1;
          const met = count >= min;
          return (
            <Badge key={req.name ?? i} variant={met ? "brand" : "destructive"}>
              {STAGE_LABELS[req.stage]}: {req.label} ({count}/{min})
            </Badge>
          );
        })}
      </div>
    </div>
  );
}

function AddEvidencePanel({
  workOrder,
  onDone,
}: {
  workOrder: WorkOrder;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(addEvidenceAction, initialState);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error && state.success) {
      setPhotoDataUrl(null);
      setFilename("");
      setFileInputKey((k) => k + 1);
      toast.add({ description: "Foto agregada", type: "success" });
    }
    wasPending.current = pending;
  }, [pending, state]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setPhotoDataUrl(null);
      setFilename("");
      return;
    }
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  function handleSubmit(formData: FormData) {
    if (!photoDataUrl) return;
    formData.set("photo_data_url", photoDataUrl);
    formData.set("filename", filename);
    formAction(formData);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agregar Foto</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-3">
          <input type="hidden" name="order_id" value={workOrder.name} />
          <input type="hidden" name="expected_modified" value={workOrder.modified ?? ""} />

          {state.error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="evidence_type">Etapa *</Label>
              <select
                id="evidence_type"
                name="evidence_type"
                defaultValue="photo_before"
                className={selectClassName}
              >
                {PHOTO_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="zone">Zona</Label>
              <Input id="zone" name="zone" placeholder="Ej: parabrisas, paragolpes..." />
            </div>
            <div className="col-span-1 space-y-1 sm:col-span-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
            <div className="col-span-1 space-y-1 sm:col-span-2">
              <Label htmlFor="photo_file">Foto *</Label>
              <input
                key={fileInputKey}
                id="photo_file"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || !photoDataUrl}>
              {pending ? "Subiendo..." : "Subir foto"}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={onDone}>
              Cerrar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function RemoveEvidenceButton({
  orderId,
  evidenceName,
  expectedModified,
}: {
  orderId: string;
  evidenceName: string;
  expectedModified: string;
}) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const result = await removeEvidenceAction(orderId, evidenceName, expectedModified);
    setPending(false);
    if (result.error) {
      toast.add({ title: "Error", description: result.error, type: "error", priority: "high" });
      return;
    }
    toast.add({ description: "Foto eliminada", type: "success" });
  }

  return (
    <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={handleClick}>
      Quitar
    </Button>
  );
}

export function EvidenceSection({
  workOrder,
  role,
  policy,
}: {
  workOrder: WorkOrder;
  role: AppRole;
  policy: WoEvidencePolicy | null;
}) {
  const [showForm, setShowForm] = useState(false);
  const canEdit =
    can(role, "uploadEvidence") &&
    !LOCKED_STATUSES.includes(workOrder.status as (typeof LOCKED_STATUSES)[number]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidencia fotográfica ({workOrder.evidence?.length ?? 0})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {policy && <ChecklistCard policy={policy} workOrder={workOrder} />}

        {workOrder.evidence && workOrder.evidence.length > 0 ? (
          <ul className="space-y-2">
            {workOrder.evidence.map((ev, i) => (
              <li key={ev.name ?? i} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">{ev.type}</Badge>
                {ev.zone && <span className="text-muted-foreground">{ev.zone}</span>}
                <Link
                  href={`/api/files?path=${encodeURIComponent(ev.url)}`}
                  target="_blank"
                  className="text-primary hover:underline"
                >
                  {ev.filename || ev.url}
                </Link>
                {ev.notes && <span className="text-muted-foreground">— {ev.notes}</span>}
                {canEdit && ev.name && ev.type.startsWith("photo_") && (
                  <RemoveEvidenceButton
                    orderId={workOrder.name}
                    evidenceName={ev.name}
                    expectedModified={workOrder.modified ?? ""}
                  />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Sin evidencia cargada.</p>
        )}

        {canEdit &&
          (showForm ? (
            <AddEvidencePanel workOrder={workOrder} onDone={() => setShowForm(false)} />
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(true)}>
              Agregar foto
            </Button>
          ))}
      </CardContent>
    </Card>
  );
}
