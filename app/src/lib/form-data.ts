// Helper compartido entre Server Actions de este proyecto para leer campos de texto de un
// FormData, tratando strings vacíos como ausentes (así el payload a Frappe no pisa un campo
// existente con "").
export function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}
