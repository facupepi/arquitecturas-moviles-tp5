// Encabezados CORS de las Edge Functions (sección 6.3).
// Solo los orígenes de ORIGENES_PERMITIDOS reciben Access-Control-Allow-Origin.

const ORIGENES = (Deno.env.get("ORIGENES_PERMITIDOS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export function encabezadosCors(req: Request): Record<string, string> {
  const encabezados: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, x-firebase-appcheck",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "3600",
    "Vary": "Origin",
  };
  const origen = req.headers.get("origin");
  if (origen && ORIGENES.includes(origen)) encabezados["Access-Control-Allow-Origin"] = origen;
  return encabezados;
}

export function respuestaOpciones(req: Request): Response {
  return new Response(null, { status: 204, headers: encabezadosCors(req) });
}
