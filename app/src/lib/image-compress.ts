// Compresión de fotos en el navegador antes de subirlas. Una foto de celular pesa 3–8 MB; a
// 1920px de lado mayor y JPEG 0.82 queda en ~300–600 KB, de sobra para un peritaje, y sube rápido
// con datos móviles. Respeta la orientación EXIF (fotos "acostadas" de iPhone/Android).
//
// Si el navegador no puede decodificar el archivo (ej. HEIC en Chrome/Windows) o no es imagen
// (PDF), se devuelve el original sin tocar.

const MAX_SIDE = 1920;
const QUALITY = 0.82;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob || blob.size >= file.size) return file;

  const base = file.name.replace(/\.[^.]+$/, "") || "foto";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
}
