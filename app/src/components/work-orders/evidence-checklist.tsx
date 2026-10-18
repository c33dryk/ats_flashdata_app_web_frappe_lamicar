"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Circle,
  FileText,
  Loader2,
  Paperclip,
  RotateCw,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { toast } from "@/components/ui/toast";
import { removeEvidenceAction } from "@/app/work-orders/[id]/actions";
import {
  EVIDENCE_TYPE_LABEL,
  MAX_UPLOAD_BYTES,
  OTHER_FILE_TYPES,
  STAGES,
  STAGE_EVIDENCE_TYPE,
  fileHref,
  isImage,
  matchesRequirement,
  requirementCount,
  visibleNotes,
} from "@/lib/evidence";
import { compressImage } from "@/lib/image-compress";
import { cn } from "@/lib/utils";
import type {
  WoEvidence,
  WoEvidencePolicy,
  WoEvidenceRequirement,
  WorkOrder,
} from "@/lib/frappe/work-orders";

// Pestaña "Fotos y archivos" del panel de OT. El checklist sale de la WO Evidence Policy (uno o
// varios requisitos por etapa) y abajo quedan los "Otros archivos" que no son de ningún requisito.
//
// Subida: cada archivo se comprime en el navegador (fotos) y se manda de a uno a
// POST /api/work-orders/:id/evidence. Van en cola (no en paralelo) porque cada carga actualiza la
// OT y la siguiente necesita el `modified` nuevo para el control de concurrencia.

interface Upload {
  id: number;
  slot: string; // code del requisito o "__other__"
  name: string;
  status: "pending" | "uploading" | "error";
  error?: string;
}

interface UploadMeta {
  slot: string;
  type: WoEvidence["type"];
  requirement?: string;
}

const OTHER_SLOT = "__other__";

export function EvidenceChecklist({
  workOrder,
  policies,
  canEdit,
  onChange,
  onReload,
}: {
  workOrder: WorkOrder;
  policies: WoEvidencePolicy[];
  canEdit: boolean;
  /** OT actualizada que devolvió el server tras una carga. */
  onChange: (wo: WorkOrder) => void;
  /** Volver a leer la OT (tras borrar, o si hubo conflicto de concurrencia). */
  onReload: () => void;
}) {
  const [policyName, setPolicyName] = useState(policies[0]?.name ?? "");
  const policy = policies.find((p) => p.name === policyName) ?? policies[0];
  const requirements = policy?.requirements ?? [];

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [viewing, setViewing] = useState<WoEvidence | null>(null);
  const [otherType, setOtherType] = useState<WoEvidence["type"]>(OTHER_FILE_TYPES[0].value);

  // `modified` vigente para la próxima carga (lo actualiza cada respuesta del server y cada
  // recarga de la OT).
  const modifiedRef = useRef(workOrder.modified ?? "");
  useEffect(() => {
    if (workOrder.modified) modifiedRef.current = workOrder.modified;
  }, [workOrder.modified]);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const files = useRef(new Map<number, { file: File; meta: UploadMeta }>());
  const nextId = useRef(1);

  const patchUpload = (id: number, patch: Partial<Upload> | null) =>
    setUploads((list) =>
      patch === null ? list.filter((u) => u.id !== id) : list.map((u) => (u.id === id ? { ...u, ...patch } : u))
    );

  async function uploadOne(id: number) {
    const entry = files.current.get(id);
    if (!entry) return;
    patchUpload(id, { status: "uploading", error: undefined });
    try {
      const file = await compressImage(entry.file);
      if (file.size > MAX_UPLOAD_BYTES) throw new Error("El archivo supera los 8 MB.");
      const fd = new FormData();
      fd.set("file", file);
      fd.set("type", entry.meta.type);
      if (entry.meta.requirement) fd.set("requirement", entry.meta.requirement);
      fd.set("expected_modified", modifiedRef.current);
      const res = await fetch(`/api/work-orders/${encodeURIComponent(workOrder.name)}/evidence`, {
        method: "POST",
        body: fd,
      });
      const json = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
      if (!res.ok || !json?.workOrder) {
        if (res.status === 409) onReload();
        throw new Error(json?.error ?? (res.redirected ? "Tu sesión expiró. Volvé a entrar." : "No se pudo subir."));
      }
      modifiedRef.current = json.workOrder.modified;
      onChange(json.workOrder);
      files.current.delete(id);
      patchUpload(id, null);
    } catch (err) {
      patchUpload(id, { status: "error", error: err instanceof Error ? err.message : "No se pudo subir." });
    }
  }

  function enqueue(list: FileList | null, meta: UploadMeta) {
    if (!list?.length) return;
    for (const file of Array.from(list)) {
      const id = nextId.current++;
      files.current.set(id, { file, meta });
      setUploads((u) => [...u, { id, slot: meta.slot, name: file.name, status: "pending" }]);
      queue.current = queue.current.then(() => uploadOne(id));
    }
  }

  const retry = (id: number) => {
    patchUpload(id, { status: "pending", error: undefined });
    queue.current = queue.current.then(() => uploadOne(id));
  };
  const discard = (id: number) => {
    files.current.delete(id);
    patchUpload(id, null);
  };

  async function remove(ev: WoEvidence) {
    if (!ev.name) return;
    const res = await removeEvidenceAction(workOrder.name, ev.name, modifiedRef.current);
    if (res.error) {
      toast.add({ title: "No se pudo eliminar", description: res.error, type: "error", priority: "high" });
    } else {
      toast.add({ title: "Archivo eliminado", type: "success" });
      setViewing(null);
    }
    onReload();
  }

  const evidence = workOrder.evidence ?? [];
  const metCount = requirements.filter((r) => requirementCount(workOrder, r) >= (r.min_photos ?? 1)).length;
  const others = evidence.filter((e) => !requirements.some((r) => matchesRequirement(e, r.code)));

  return (
    <div className="space-y-5">
      {policies.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
          No hay una política de evidencia para este tipo de cliente. Podés cargar archivos en
          &quot;Otros archivos&quot;.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <span className="font-semibold">
                {metCount} de {requirements.length}
              </span>{" "}
              <span className="text-muted-foreground">requisitos cumplidos</span>
            </div>
            {policies.length > 1 && (
              <select
                value={policy?.name}
                onChange={(e) => setPolicyName(e.target.value)}
                className={cn(nativeSelectClassName, "w-auto")}
                aria-label="Política de evidencia"
                title="La OT todavía no guarda qué política aplica: elegila acá"
              >
                {policies.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.policy_name || p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${requirements.length ? (metCount / requirements.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {STAGES.map((stage) => {
        const reqs = requirements.filter((r) => r.stage === stage.key);
        if (!reqs.length) return null;
        return (
          <section key={stage.key} className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {stage.label}
            </h3>
            {reqs.map((req) => (
              <RequirementRow
                key={req.code}
                req={req}
                workOrder={workOrder}
                canEdit={canEdit}
                uploads={uploads.filter((u) => u.slot === req.code)}
                onFiles={(list) =>
                  enqueue(list, { slot: req.code, type: STAGE_EVIDENCE_TYPE[req.stage], requirement: req.code })
                }
                onView={setViewing}
                onRetry={retry}
                onDiscard={discard}
              />
            ))}
          </section>
        );
      })}

      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Otros archivos
        </h3>
        <div className="rounded-lg border border-border p-3">
          <Thumbs
            items={others}
            uploads={uploads.filter((u) => u.slot === OTHER_SLOT)}
            onView={setViewing}
            onRetry={retry}
            onDiscard={discard}
            showType
          />
          {others.length === 0 && !uploads.some((u) => u.slot === OTHER_SLOT) && (
            <p className="text-sm text-muted-foreground">Sin archivos adicionales.</p>
          )}
          {canEdit && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={otherType}
                onChange={(e) => setOtherType(e.target.value as WoEvidence["type"])}
                className={cn(nativeSelectClassName, "w-auto")}
                aria-label="Tipo de archivo"
              >
                {OTHER_FILE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <UploadButtons onFiles={(list) => enqueue(list, { slot: OTHER_SLOT, type: otherType })} />
            </div>
          )}
        </div>
      </section>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? EVIDENCE_TYPE_LABEL[viewing.type] ?? "Archivo" : ""}
        description={viewing ? visibleNotes(viewing) ?? viewing.filename : undefined}
        className="max-w-4xl"
      >
        {viewing && (
          <div className="space-y-3">
            {isImage(viewing) ? (
              // eslint-disable-next-line @next/next/no-img-element -- archivo privado servido por /api/files
              <img
                src={fileHref(viewing.url)}
                alt={viewing.filename ?? "Evidencia"}
                className="mx-auto max-h-[70dvh] rounded-md object-contain"
              />
            ) : (
              <iframe
                src={fileHref(viewing.url)}
                title={viewing.filename ?? "Archivo"}
                className="h-[70dvh] w-full rounded-md border border-border"
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <a
                href={fileHref(viewing.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium underline-offset-4 hover:underline"
              >
                Abrir original
              </a>
              {canEdit && viewing.type !== "signature" && <DeleteButton onConfirm={() => remove(viewing)} />}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function RequirementRow({
  req,
  workOrder,
  canEdit,
  uploads,
  onFiles,
  onView,
  onRetry,
  onDiscard,
}: {
  req: WoEvidenceRequirement;
  workOrder: WorkOrder;
  canEdit: boolean;
  uploads: Upload[];
  onFiles: (list: FileList | null) => void;
  onView: (e: WoEvidence) => void;
  onRetry: (id: number) => void;
  onDiscard: (id: number) => void;
}) {
  const items = (workOrder.evidence ?? []).filter((e) => matchesRequirement(e, req.code));
  const count = requirementCount(workOrder, req);
  const min = req.min_photos ?? 1;
  const met = count >= min;
  const signedDelivery = req.stage === "delivery" && !!workOrder.delivery_signed_at;

  return (
    <div className={cn("rounded-lg border p-3", met ? "border-border" : "border-amber-300 dark:border-amber-500/40")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {met ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Cumplido" />
          ) : (
            <Circle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-label="Pendiente" />
          )}
          <div>
            <p className="text-sm font-medium">{req.label}</p>
            {signedDelivery && <p className="text-xs text-muted-foreground">Incluye la firma de entrega</p>}
          </div>
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
          {count}/{min}
        </span>
      </div>
      {(items.length > 0 || uploads.length > 0) && (
        <div className="mt-2.5">
          <Thumbs items={items} uploads={uploads} onView={onView} onRetry={onRetry} onDiscard={onDiscard} />
        </div>
      )}
      {canEdit && (
        <div className="mt-2.5">
          <UploadButtons onFiles={onFiles} />
        </div>
      )}
    </div>
  );
}

function UploadButtons({ onFiles }: { onFiles: (list: FileList | null) => void }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiles(e.target.files);
    e.target.value = ""; // permite volver a elegir el mismo archivo
  };
  return (
    <div className="flex gap-2">
      {/* capture="environment": en el celular abre directo la cámara trasera */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={handle} />
      <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={handle} />
      <Button type="button" size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => cameraRef.current?.click()}>
        <Camera className="size-4" /> Sacar foto
      </Button>
      <Button type="button" size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => fileRef.current?.click()}>
        <Paperclip className="size-4" /> Subir archivo
      </Button>
    </div>
  );
}

function Thumbs({
  items,
  uploads,
  onView,
  onRetry,
  onDiscard,
  showType,
}: {
  items: WoEvidence[];
  uploads: Upload[];
  onView: (e: WoEvidence) => void;
  onRetry: (id: number) => void;
  onDiscard: (id: number) => void;
  showType?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((ev, i) => (
        <button
          key={ev.name ?? `${ev.url}-${i}`}
          type="button"
          onClick={() => onView(ev)}
          title={visibleNotes(ev) ?? ev.filename}
          className="group relative size-20 overflow-hidden rounded-md bg-muted ring-1 ring-foreground/10 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {isImage(ev) ? (
            // eslint-disable-next-line @next/next/no-img-element -- archivo privado servido por /api/files
            <img
              src={fileHref(ev.url)}
              alt={ev.filename ?? "Evidencia"}
              loading="lazy"
              className="size-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <span className="flex size-full flex-col items-center justify-center gap-1 p-1 text-[10px] text-muted-foreground">
              <FileText className="size-6" />
              <span className="line-clamp-2 break-all">{ev.filename?.split("_").pop()}</span>
            </span>
          )}
          {showType && (
            <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[10px] text-white">
              {EVIDENCE_TYPE_LABEL[ev.type] ?? ev.type}
            </span>
          )}
        </button>
      ))}
      {uploads.map((u) => (
        <div
          key={u.id}
          className={cn(
            "relative flex size-20 flex-col items-center justify-center gap-1 rounded-md p-1 text-center text-[10px] ring-1",
            u.status === "error"
              ? "bg-destructive/10 text-destructive ring-destructive/30"
              : "bg-muted text-muted-foreground ring-foreground/10"
          )}
          title={u.error ?? u.name}
        >
          {u.status === "error" ? (
            <>
              <span className="line-clamp-2">{u.error}</span>
              <span className="flex gap-1">
                <button type="button" onClick={() => onRetry(u.id)} aria-label={`Reintentar ${u.name}`} className="rounded p-0.5 hover:bg-destructive/10">
                  <RotateCw className="size-3.5" />
                </button>
                <button type="button" onClick={() => onDiscard(u.id)} aria-label={`Descartar ${u.name}`} className="rounded p-0.5 hover:bg-destructive/10">
                  <X className="size-3.5" />
                </button>
              </span>
            </>
          ) : (
            <>
              <Loader2 className="size-5 animate-spin" />
              <span>{u.status === "uploading" ? "Subiendo…" : "En cola"}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return confirming ? (
    <span className="flex items-center gap-2 text-sm">
      ¿Eliminar este archivo?
      <Button type="button" size="sm" variant="destructive" onClick={onConfirm}>
        Sí, eliminar
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(false)}>
        No
      </Button>
    </span>
  ) : (
    <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(true)}>
      <Trash2 className="size-4" /> Eliminar
    </Button>
  );
}
