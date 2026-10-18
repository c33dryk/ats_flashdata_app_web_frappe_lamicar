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
