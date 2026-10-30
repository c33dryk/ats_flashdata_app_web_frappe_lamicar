import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

// El .env vive en la raíz del repo (junto a docker-compose.yml), un nivel arriba de app/ — Next
// por defecto solo busca .env/.env.local en su propio cwd. En Docker no hace falta esto porque
// docker-compose.yml ya inyecta las variables como `environment:`; esto es solo para
// `npm run dev`/`npm run build` corridos directo desde app/.
// forceReload (4to arg) es necesario: Next ya corrió loadEnvConfig una vez contra app/ (sin
// encontrar nada) antes de llegar acá, y @next/env cachea ese resultado — sin forceReload esta
// llamada devuelve el cache vacío en lugar de releer desde la raíz del repo.
loadEnvConfig(path.resolve(__dirname, ".."), process.env.NODE_ENV !== "production", console, true);

// Versión visible (ver src/lib/version.ts). El build de Docker no tiene .git (el contexto es
// app/), así que ahí el commit llega como build-arg GIT_COMMIT (ver Dockerfile / compose prod).
const { version } = JSON.parse(readFileSync(path.join(__dirname, "package.json"), "utf-8")) as { version: string };

function gitCommit(): string {
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_APP_COMMIT: gitCommit(),
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString().slice(0, 10),
  },
};

export default nextConfig;
