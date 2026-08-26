import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readSessionFromCookieHeader, SESSION_COOKIE_NAME } from "@/lib/auth";

// Protege todo excepto: login y su API. Corre en runtime Node.js (default en Next 16 para
// proxy), así que puede verificar la firma HMAC de la sesión acá mismo, no solo chequear que
// exista la cookie.
//
// Al agregar una ruta pública nueva (página o API) para usuarios sin sesión, hay que sumarla acá
// o el proxy la redirige a /login — y un fetch(...).then(r => r.json()) del lado cliente que no
// chequea r.ok sigue el redirect a la página HTML de login y explota con
// "SyntaxError: Unexpected token '<'" (bug real ya rastreado en el proyecto de referencia).
export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = readSessionFromCookieHeader(token);

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (request.nextUrl.pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

// Cada alternativa del negative lookahead lleva `(?:/|$)` para que solo excluya el segmento
// exacto (o sus subrutas), no cualquier ruta que arranque con el mismo texto.
export const config = {
  matcher: [
    "/((?!api/auth(?:/|$)|login(?:/|$)|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
