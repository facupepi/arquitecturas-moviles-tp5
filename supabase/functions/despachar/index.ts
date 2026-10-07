// POST /despachar { eventoId? } (sección 6.8). Admin del panel o la tarea programada.
import { atender, leerJson, ok } from "../_shared/respuesta.ts";
import { ErrorHttp, exigirAdmin, verificarAppCheck, verificarCron, verificarUsuario } from "../_shared/firebase-auth.ts";
import { obtener } from "../_shared/firestore.ts";
import { barrerBandeja, despacharEvento } from "../_shared/entrega.ts";
import { conRegistro } from "../_shared/registro.ts";

Deno.serve(atender(async (req) => {
  if (req.method !== "POST") throw new ErrorHttp(400, "validacion", "Método no admitido.");
  if (!verificarCron(req)) {
    const id = await verificarUsuario(req);
    await verificarAppCheck(req);
    await exigirAdmin(id, { obtener });
  }
  const { eventoId } = await leerJson(req);
  if (eventoId !== undefined && eventoId !== null && typeof eventoId !== "string") {
    throw new ErrorHttp(400, "validacion", "El evento no es válido.");
  }
  const resultado = await conRegistro("despachar", () =>
    eventoId ? despacharEvento(eventoId as string) : barrerBandeja()
  );
  return ok(req, { procesados: resultado.procesados, enviados: resultado.enviados });
}));
