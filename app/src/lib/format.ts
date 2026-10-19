// Formatos de presentación compartidos (client-safe).

const moneyFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const moneyCompactFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  notation: "compact",
  maximumFractionDigits: 1,
});

const numberCompactFmt = new Intl.NumberFormat("es-AR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const fmtMoney = (value: number) => moneyFmt.format(value || 0);
export const fmtMoneyCompact = (value: number) => moneyCompactFmt.format(value || 0);
export const fmtNumberCompact = (value: number) => numberCompactFmt.format(value || 0);

/** Fecha de hoy "YYYY-MM-DD" en la zona horaria del taller (no la del server/contenedor). */
export function todayInShopTZ(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());
}

const MAX_MILEAGE = 2_000_000;

/**
 * Kilometraje ingresado → entero en texto ("14500"), o error. Acepta lo que la gente escribe
 * ("14.500", "14500 km") y lo limpia; vacío = sin dato. En Frappe el campo es Data, por eso se
 * guarda como texto pero siempre con solo dígitos.
 */
export function parseMileage(value?: string): { ok: true; value: string } | { ok: false; error: string } {
  const raw = (value ?? "").trim();
  if (!raw) return { ok: true, value: "" };
  const cleaned = raw.replace(/\s*km\s*$/i, "").replace(/[.\s]/g, "");
  if (!/^\d+$/.test(cleaned)) return { ok: false, error: "El kilometraje tiene que ser un número entero (ej. 14500)." };
  const n = Number(cleaned);
  if (n > MAX_MILEAGE) return { ok: false, error: "El kilometraje parece incorrecto (más de 2.000.000 km)." };
  return { ok: true, value: String(n) };
}

/** Año del vehículo → 4 dígitos entre 1950 y el año que viene, o error; vacío = sin dato. */
export function parseVehicleYear(value?: string): { ok: true; value: string } | { ok: false; error: string } {
  const raw = (value ?? "").trim();
  if (!raw) return { ok: true, value: "" };
  const max = new Date().getFullYear() + 1;
  if (!/^\d{4}$/.test(raw) || Number(raw) < 1950 || Number(raw) > max) {
    return { ok: false, error: `El año tiene que ser de 4 dígitos, entre 1950 y ${max}.` };
  }
  return { ok: true, value: raw };
}

/** Kilometraje para mostrar: "14.500 km". Valores viejos cargados como texto ("14.500 km") se respetan. */
export function fmtMileage(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const v = value.trim();
  if (/^\d+$/.test(v)) return `${Number(v).toLocaleString("es-AR")} km`;
  return /km/i.test(v) ? v : `${v} km`;
}
