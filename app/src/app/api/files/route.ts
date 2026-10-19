import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { FrappeApiError, frappeFetchFile } from "@/lib/frappe/client";

// Proxy autenticado para archivos de Frappe (ver frappeFetchFile). Solo reenvía rutas de archivo
// conocidas (/private/files/... o /files/...) para no convertir esto en un proxy HTTP abierto.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const path = new URL(req.url).searchParams.get("path");
  if (!path || !/^\/(private\/)?files\//.test(path)) {
    return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
  }

  try {
    const { buffer, contentType } = await frappeFetchFile(path);
    // Los archivos subidos no cambian (cada carga genera una URL nueva): el navegador puede
    // cachearlos, así las miniaturas del panel no se vuelven a bajar en cada apertura.
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=86400" },
    });
  } catch (err) {
    const status = err instanceof FrappeApiError ? err.status : 502;
    return NextResponse.json({ error: "No se pudo obtener el archivo" }, { status });
  }
}
