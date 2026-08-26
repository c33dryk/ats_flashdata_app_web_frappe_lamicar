import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { loginToFrappe, getAppRoleForUser } from "@/lib/frappe/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email y contraseña son obligatorios" }, { status: 400 });
  }

  const result = await loginToFrappe(email, password);
  if (!result.ok) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  const role = await getAppRoleForUser(email);

  await createSession({
    userId: email,
    name: result.fullName ?? email,
    role,
  });

  return NextResponse.json({ ok: true, name: result.fullName, role });
}
