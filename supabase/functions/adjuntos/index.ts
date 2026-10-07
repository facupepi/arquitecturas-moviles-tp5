// POST /adjuntos/subir (un archivo por solicitud) y POST /adjuntos/url (sección 6.8, R2).
import { recortarNombreArchivo, tipoPorFirma } from "../../../shared/dominio.mjs";
import { EXTENSION_ARCHIVO, LIMITES } from "../../../shared/constantes.mjs";
import { accionDe, atender, leerJson, ok } from "../_shared/respuesta.ts";
import { ErrorHttp, exigirAdmin, verificarAppCheck, verificarUsuario } from "../_shared/firebase-auth.ts";
import { obtener } from "../_shared/firestore.ts";
import { almacen } from "../_shared/almacenamiento.ts";

const BYTES_MAX = Number((LIMITES as { bytesAdjunto?: number }).bytesAdjunto ?? 2 * 1024 * 1024);
const EXTENSIONES = EXTENSION_ARCHIVO as Record<string, string>;
const VIGENCIA_URL_S = 300;
// Ruta relativa al bucket, con el mismo patrón que exige la regla de reclamos.
const PATRON_RUTA = /^[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_-]{1,64}\/[0-2]-[a-f0-9]{12}\.(jpg|png|pdf)$/;

function adjuntoInvalido(estado: number, mensaje: string): ErrorHttp {
  return new ErrorHttp(estado, "adjunto-invalido", mensaje);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function subir(req: Request) {
  const id = await verificarUsuario(req);
  await verificarAppCheck(req);
  // Corte temprano por tamaño declarado: archivo de 2 MiB más el sobre multipart.
  const largo = Number(req.headers.get("content-length") ?? 0);
  if (largo > BYTES_MAX + 64 * 1024) throw adjuntoInvalido(413, "El archivo supera los 2 MB.");

  let formulario: FormData;
  try {
    formulario = await req.formData();
  } catch {
    throw adjuntoInvalido(400, "No pudimos leer el archivo enviado.");
  }
  const reclamoId = String(formulario.get("reclamoId") ?? "");
  const indice = Number(formulario.get("indice"));
  const archivo = formulario.get("archivo");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(reclamoId)) throw new ErrorHttp(400, "validacion", "El reclamo no es válido.");
  if (!Number.isInteger(indice) || indice < 0 || indice > 2) {
    throw new ErrorHttp(400, "validacion", "Se admiten hasta 3 archivos por reclamo.");
  }
  if (!(archivo instanceof File)) throw adjuntoInvalido(400, "Falta el archivo.");
  if (archivo.size > BYTES_MAX) throw adjuntoInvalido(413, "El archivo supera los 2 MB.");
  if (archivo.size === 0) throw adjuntoInvalido(400, "El archivo está vacío.");

  const bytes = new Uint8Array(await archivo.arrayBuffer());
  if (bytes.length > BYTES_MAX) throw adjuntoInvalido(413, "El archivo supera los 2 MB.");
  const tipo = tipoPorFirma(bytes) as string | null;
  if (!tipo || !EXTENSIONES[tipo]) throw adjuntoInvalido(400, "Solo se admiten imágenes JPG o PNG y archivos PDF.");
  // Si el navegador declaró uno de los tipos admitidos, tiene que coincidir con el contenido.
  if (archivo.type && archivo.type in EXTENSIONES && archivo.type !== tipo) {
    throw adjuntoInvalido(400, "El contenido del archivo no coincide con su tipo.");
  }

  const extension = EXTENSIONES[tipo];
  const nombre = recortarNombreArchivo(archivo.name || `adjunto.${extension}`) as string;
  const hash = (await sha256Hex(bytes)).slice(0, 12);
  const ruta = `${id.uid}/${reclamoId}/${indice}-${hash}.${extension}`;
  // upsert: un reintento sobrescribe el mismo archivo.
  const { error } = await almacen().upload(ruta, bytes, { contentType: tipo, upsert: true });
  if (error) {
    console.error("Storage upload:", error.message);
    throw new ErrorHttp(500, "servidor", "No pudimos guardar el archivo. Intentá nuevamente.");
  }
  return { adjunto: { ruta, nombre, tipo, tamano: bytes.length } };
}

async function url(req: Request) {
  const id = await verificarUsuario(req);
  const { ruta } = await leerJson(req);
  if (typeof ruta !== "string" || !PATRON_RUTA.test(ruta)) {
    throw new ErrorHttp(400, "validacion", "La ruta del adjunto no es válida.");
  }
  if (!ruta.startsWith(`${id.uid}/`)) await exigirAdmin(id, { obtener });
  const { data, error } = await almacen().createSignedUrl(ruta, VIGENCIA_URL_S);
  if (error || !data?.signedUrl) {
    const noExiste = /not.?found|does not exist/i.test(error?.message ?? "");
    if (noExiste) throw new ErrorHttp(404, "no-encontrado", "No encontramos el archivo.");
    console.error("Storage signedUrl:", error?.message);
    throw new ErrorHttp(500, "servidor", "No pudimos abrir el archivo. Intentá nuevamente.");
  }
  return { url: data.signedUrl, venceEn: Date.now() + VIGENCIA_URL_S * 1000 };
}

Deno.serve(atender(async (req) => {
  if (req.method !== "POST") throw new ErrorHttp(400, "validacion", "Método no admitido.");
  const accion = accionDe(req, "adjuntos");
  if (accion === "subir") return ok(req, await subir(req));
  if (accion === "url") return ok(req, await url(req));
  throw new ErrorHttp(404, "no-encontrado", "No existe esa acción.");
}));
