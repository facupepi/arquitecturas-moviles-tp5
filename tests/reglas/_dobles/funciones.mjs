// Doble de src/supabase/funciones.js: registra las llamadas y responde lo configurado.
export const llamadas = [];
let responder = async () => ({});
export function fijarRespuesta(fn) { responder = fn; }
export async function llamarFuncion(ruta, opciones = {}) {
  llamadas.push({ ruta, opciones });
  return responder(ruta, opciones);
}
