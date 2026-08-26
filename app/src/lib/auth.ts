import { cookies } from "next/headers";
import crypto from "node:crypto";
import { type SessionPayload } from "./auth-shared";

export { ROLE_LABELS, type AppRole, type SessionPayload } from "./auth-shared";

const COOKIE_NAME = "app_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12h

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET no configurado (ver .env en la raíz del repo)");
  }
  return secret;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function encode(payload: SessionPayload): string {
  const base64 = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  return `${base64}.${sign(base64)}`;
}

function decode(token: string): SessionPayload | null {
  const [base64, sig] = token.split(".");
  if (!base64 || !sig) return null;

  const expected = sign(base64);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(base64, "base64url").toString("utf-8")) as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload) {
  const store = await cookies();
  store.set(COOKIE_NAME, encode(payload), {
    httpOnly: true,
    sameSite: "lax",
    // "Secure" solo cuando de verdad hay HTTPS delante (reverse proxy). Atarlo a
    // NODE_ENV==="production" rompe el login detrás de Docker sin TLS: el navegador
    // descarta en silencio una cookie Secure servida por http:// plano.
    secure: process.env.SESSION_COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decode(token);
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export function readSessionFromCookieHeader(cookieValue: string | undefined): SessionPayload | null {
  if (!cookieValue) return null;
  return decode(cookieValue);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
