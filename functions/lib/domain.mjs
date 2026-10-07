export class DomainError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export const zones = ["Centro", "Parque", "Norte", "Sur"];
export const categories = [
  "Alumbrado",
  "Bacheo",
  "Limpieza",
  "Bicicletas",
  "Otros",
];
export function required(value, label, min = 1, max = 500) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    throw new DomainError(
      `${label}: ingresá entre ${min} y ${max} caracteres.`,
    );
  return value.trim();
}
export function member(value, values, label) {
  if (!values.includes(value)) throw new DomainError(`${label} inválido.`);
  return value;
}
export function minutes(value) {
  if (!Number.isInteger(value) || value < 15 || value > 240 || value % 15)
    throw new DomainError("Elegí entre 15 y 240 minutos, en bloques de 15.");
  return value;
}
export function plate(value) {
  const s = required(value, "Patente", 6, 7).toUpperCase();
  if (!/^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/.test(s))
    throw new DomainError("Usá una patente como ABC123 o AB123CD.");
  return s;
}
export function parkingCost(rate, duration) {
  return Math.round((rate * minutes(duration)) / 60);
}
export function distanceKm(a, b) {
  const rad = (n) => (n * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat),
    dLon = rad(b.lng - a.lng);
  return (
    6371 *
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin(dLat / 2) ** 2 +
          Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2,
      ),
    )
  );
}
export function validateAttachments(files = []) {
  if (!Array.isArray(files) || files.length > 3)
    throw new DomainError("Máximo 3 adjuntos.");
  return files.map((f) => {
    const name = required(f.name, "Nombre del adjunto", 1, 100);
    const type = member(
      f.type,
      ["image/jpeg", "image/png", "application/pdf"],
      "Tipo de archivo",
    );
    if (
      typeof f.data !== "string" ||
      !f.data.startsWith(`data:${type};base64,`)
    )
      throw new DomainError("Adjunto inválido.");
    const bytes = Buffer.from(f.data.split(",")[1], "base64");
    if (bytes.length > 2 * 1024 * 1024 || bytes.length === 0)
      throw new DomainError("Cada adjunto debe pesar entre 1 byte y 2 MB.");
    const valid =
      type === "application/pdf"
        ? bytes.subarray(0, 5).toString() === "%PDF-"
        : type === "image/png"
          ? bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!valid)
      throw new DomainError("El contenido no coincide con el tipo de archivo.");
    return { name, type, data: f.data, size: bytes.length };
  });
}
