// Versión visible de la app (login y menú de usuario del sidebar). Client-safe: los valores los
// inyecta next.config.ts en tiempo de build (`env`), no se leen en runtime.
//
// - APP_VERSION: `version` de app/package.json (SemVer, se sube con `npm version` al hacer release).
// - APP_COMMIT: hash corto del commit buildeado (git local, o GIT_COMMIT como build-arg en Docker).
// - BUILD_DATE: fecha del build (AAAA-MM-DD).
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
export const APP_COMMIT = process.env.NEXT_PUBLIC_APP_COMMIT ?? "";
export const BUILD_DATE = process.env.NEXT_PUBLIC_BUILD_DATE ?? "";

/** "v0.2.0" o "v0.2.0 · d563453" si se conoce el commit. */
export const VERSION_LABEL = APP_COMMIT ? `v${APP_VERSION} · ${APP_COMMIT}` : `v${APP_VERSION}`;
