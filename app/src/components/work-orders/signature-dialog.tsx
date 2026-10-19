"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

// Firma de conformidad al entregar: pantalla completa en celular, tablet y escritorio. El lienzo
// toma el tamaño real que ocupa en pantalla (× densidad de píxeles), así el trazo sale nítido y
// justo debajo del dedo. Pointer events: dedo, lápiz o mouse. Al rotar/redimensionar se limpia.

const EXPORT_MAX_SIDE = 1000; // la imagen se manda por Server Action (tope 1MB): se achica

export function SignatureDialog({
  open,
  defaultSignedBy,
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  defaultSignedBy: string;
  pending: boolean;
  onConfirm: (fields: { signedBy: string; signatureDataUrl: string }) => void;
  onCancel: () => void;
}) {
  const [signedBy, setSignedBy] = useState(defaultSignedBy);
  const [hasSignature, setHasSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);

  // Ajusta el lienzo al recuadro (y lo limpia) cada vez que cambia de tamaño.
  useEffect(() => {
    if (!open) return;
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(box.clientWidth * dpr);
      canvas.height = Math.round(box.clientHeight * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0f172a";
      setHasSignature(false);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [open]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasSignature) setHasSignature(true);
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  function confirm() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = Math.min(1, EXPORT_MAX_SIDE / Math.max(canvas.width, canvas.height));
    const out = document.createElement("canvas");
    out.width = Math.round(canvas.width * scale);
    out.height = Math.round(canvas.height * scale);
    out.getContext("2d")?.drawImage(canvas, 0, 0, out.width, out.height);
    onConfirm({ signedBy: signedBy.trim(), signatureDataUrl: out.toDataURL("image/png") });
  }

  return (
    <Modal open={open} onClose={onCancel} title="Entrega del vehículo" description="Firma de conformidad del remito" fullScreen>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="space-y-1">
          <Label htmlFor="signed_by">Recibe (aclaración) *</Label>
          <Input id="signed_by" value={signedBy} onChange={(e) => setSignedBy(e.target.value)} className="h-11 text-base" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <span className="text-sm font-medium">Firma *</span>
          <div ref={boxRef} className="relative min-h-48 flex-1 overflow-hidden rounded-lg border-2 border-dashed border-input bg-white">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 size-full touch-none"
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={() => (drawing.current = false)}
              onPointerCancel={() => (drawing.current = false)}
              aria-label="Recuadro para firmar"
            />
            {!hasSignature && (
              <span className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-sm text-neutral-400">
                Firme dentro del recuadro
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="h-11 px-4 text-base" onClick={clear} disabled={!hasSignature || pending}>
            <Eraser className="size-4" /> Borrar
          </Button>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="outline" className="h-11 px-4 text-base" onClick={onCancel} disabled={pending}>
              Cancelar
            </Button>
            <Button type="button" className="h-11 px-4 text-base" onClick={confirm} disabled={pending || !signedBy.trim() || !hasSignature}>
              Confirmar entrega
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
