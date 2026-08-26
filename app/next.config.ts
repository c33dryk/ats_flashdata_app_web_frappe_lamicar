import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

// El .env vive en la raíz del repo (junto a docker-compose.yml), un nivel arriba de app/ — Next
// por defecto solo busca .env/.env.local en su propio cwd. En Docker no hace falta esto porque
// docker-compose.yml ya inyecta las variables como `environment:`; esto es solo para
// `npm run dev`/`npm run build` corridos directo desde app/.
// forceReload (4to arg) es necesario: Next ya corrió loadEnvConfig una vez contra app/ (sin
// encontrar nada) antes de llegar acá, y @next/env cachea ese resultado — sin forceReload esta
// llamada devuelve el cache vacío en lugar de releer desde la raíz del repo.
loadEnvConfig(path.resolve(__dirname, ".."), process.env.NODE_ENV !== "production", console, true);

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
