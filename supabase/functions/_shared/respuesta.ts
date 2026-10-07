// Respuestas JSON comunes (sección 6.3): { ok: true, datos } o { ok: false, error: { codigo, mensaje } }.
import { encabezadosCors, respuestaOpciones } from "./cors.ts";
import { ErrorHttp } from "./firebase-auth.ts";

function json(req: Request, cuerpo: unknown, estado: number): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...encabezadosCors(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

export function ok(req: Request, datos: unknown, estado = 200): Response {
  return json(req, { ok: true, datos }, estado);
}

// Traduce cualquier error a la respuesta del contrato. Nunca expone trazas ni mensajes internos.
export function falla(req: Request, e: unknown): Response {
  if (e instanceof ErrorHttp) {
    return json(req, { ok: false, error: { codigo: e.codigo, mensaje: e.message } }, e.estado);
  }
  const nombre = (e as { name?: string })?.name;
  if (nombre === "ErrorDominio") {
    // Error de validación del dominio compartido (shared/dominio.mjs).
    return json(req, { ok: false, error: { codigo: "validacion", mensaje: (e as Error).message } }, 400);
  }
  console.error("Error no controlado:", e);
  return json(req, {
    ok: false,
    error: { codigo: "servidor", mensaje: "El servicio no respondió. Intentá nuevamente." },
  }, 500);
}

// Separa la acción de la ruta: /vecino/alta → "alta"; /tareas → "".
export function accionDe(req: Request, funcion: string): string {
  const partes = new URL(req.url).pathname.split("/").filter(Boolean);
  const i = partes.lastIndexOf(funcion);
  return i >= 0 ? (partes[i + 1] ?? "") : "";
}

export async function leerJson(req: Request): Promise<Record<string, unknown>> {
  const texto = await req.text();
  if (!texto.trim()) return {};
  try {
    const valor = JSON.parse(texto);
    if (valor && typeof valor === "object" && !Array.isArray(valor)) return valor as Record<string, unknown>;
  } catch { /* cae al error de abajo */ }
  throw new ErrorHttp(400, "validacion", "El cuerpo de la solicitud no es válido.");
}

// Punto de entrada común: OPTIONS, captura de errores y CORS en todas las respuestas.
export function atender(manejador: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return respuestaOpciones(req);
    try {
      return await manejador(req);
    } catch (e) {
      return falla(req, e);
    }
  };
}
