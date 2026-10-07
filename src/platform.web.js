export function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation)
      return reject(
        new Error("Este navegador no permite obtener tu ubicación."),
      );
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () =>
        reject(
          new Error(
            "No se pudo obtener tu ubicación. Permití el acceso o seleccioná una estación en el mapa.",
          ),
        ),
      { timeout: 10000, maximumAge: 60000 },
    );
  });
}
export async function readAttachments(list) {
  const files = Array.from(list);
  if (files.length > 3) throw new Error("Podés adjuntar hasta 3 archivos.");
  return Promise.all(
    files.map(
      (f) =>
        new Promise((resolve, reject) => {
          if (
            f.size > 2 * 1024 * 1024 ||
            !["image/png", "image/jpeg", "application/pdf"].includes(f.type)
          )
            return reject(
              new Error("Adjuntá imágenes JPG/PNG o PDF de hasta 2 MB."),
            );
          const reader = new FileReader();
          reader.onload = () =>
            resolve({ name: f.name, type: f.type, data: reader.result });
          reader.onerror = () =>
            reject(new Error("No se pudo leer el archivo."));
          reader.readAsDataURL(f);
        }),
    ),
  );
}
export const money = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
export const date = (s) => new Date(s).toLocaleDateString("es-AR");
export function emitBill(tax) {
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Cedulón ${esc(tax.id)}</title><style>body{font:16px Arial;max-width:720px;margin:60px auto;color:#20352c}h1{font-size:28px}table{width:100%;border-collapse:collapse}td{padding:16px;border-bottom:1px solid #ddd}@media print{button{display:none}}</style><h1>San Francisco Conecta</h1><h2>Cedulón ${esc(tax.id)}</h2><table>${Object.entries(
    {
      Concepto: tax.concept,
      Cuenta: tax.account,
      Período: tax.period,
      Vencimiento: date(tax.due),
      Importe: money(tax.amount),
      Estado: tax.paidAt ? "Pago registrado" : "Pendiente",
      Comprobante: tax.receipt || "Sin comprobante",
    },
  )
    .map(([k, v]) => `<tr><td>${k}</td><td>${esc(v)}</td></tr>`)
    .join(
      "",
    )}</table><button onclick="window.print()">Imprimir o guardar como PDF</button></html>`;
  const url = URL.createObjectURL(
    new Blob([html], { type: "text/html;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `cedulon-${tax.id}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
