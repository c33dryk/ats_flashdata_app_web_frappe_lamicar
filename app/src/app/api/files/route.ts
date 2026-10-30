import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { FrappeApiError, frappeFetchFile, isFrappeFilePath } from "@/lib/frappe/client";

// Tipos que el navegador puede mostrar inline en el origen de la app. Cualquier otro (HTML, SVG,
// XML, ...) se fuerza a descarga: si no, un archivo subido como evidencia correría JS con la
// sesión de quien lo abre (XSS almacenado).
const INLINE_IMAGE = /^image\/(jpeg|png|webp|gif|heic|heif)$/;
const INLINE_PDF = "application/pdf";

// Proxy autenticado para archivos de Frappe (ver frappeFetchFile). Solo reenvía rutas de archivo
// conocidas (/private/files/... o /files/...) para no convertir esto en un proxy HTTP abierto.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const path = new URL(req.url).searchParams.get("path");
  if (!path || !isFrappeFilePath(path)) {
    return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
  }

  try {
    const { buffer, contentType } = await frappeFetchFile(path);
    const mime = contentType.split(";")[0].trim().toLowerCase();
    const headers: Record<string, string> = {
      // Los archivos subidos no cambian (cada carga genera una URL nueva): el navegador puede
      // cachearlos, así las miniaturas del panel no se vuelven a bajar en cada apertura.
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    };
    if (INLINE_IMAGE.test(mime)) {
      headers["Content-Type"] = mime;
      headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox";
    } else if (mime === INLINE_PDF) {
      // Sin CSP sandbox: el visor de PDF del navegador no carga en un contexto sandboxeado.
      headers["Content-Type"] = mime;
    } else {
      const filename = path.split("/").pop() ?? "archivo";
      headers["Content-Type"] = "application/octet-stream";
      headers["Content-Disposition"] = `attachment; filename="${filename.replace(/[^\w.\-]+/g, "_")}"`;
    }
    return new NextResponse(new Uint8Array(buffer), { headers });
  } catch (err) {
    const status = err instanceof FrappeApiError ? err.status : 502;
    return NextResponse.json({ error: "No se pudo obtener el archivo" }, { status });
  }
}
