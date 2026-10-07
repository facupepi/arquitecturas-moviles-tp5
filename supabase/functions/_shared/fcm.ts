// Push por FCM HTTP v1 (sección 6.7). Mensajes solo de datos, con todos los valores string.
import { tokenGoogle } from "./google-token.ts";
import { escribirLote, listar } from "./firestore.ts";

const PROYECTO = Deno.env.get("FIREBASE_PROJECT_ID") ?? "san-francisco-conecta-tp5";

export type DatosPush = {
  id: string; // claveEntrega: data.id del push y tag de la notificación
  titulo: string;
  cuerpo: string;
  destino: string;
  tipo: string;
};

export async function enviarPush(token: string, datos: DatosPush): Promise<"ok" | "invalido" | "error"> {
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${PROYECTO}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${await tokenGoogle()}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        data: {
          id: String(datos.id),
          titulo: String(datos.titulo),
          cuerpo: String(datos.cuerpo),
          destino: String(datos.destino),
          tipo: String(datos.tipo),
        },
        webpush: { headers: { TTL: "3600", Urgency: "high" } },
      },
    }),
  });
  if (r.ok) return "ok";
  const e = await r.json().catch(() => ({})) as {
    error?: { status?: string; details?: Array<Record<string, unknown>> };
  };
  const detalles = (e?.error?.details ?? []) as Array<Record<string, unknown>>;
  const codigo = (detalles.find((d) => d.errorCode)?.errorCode as string | undefined) ?? e?.error?.status;
  const culpaDelToken = detalles.some((d) =>
    (d.fieldViolations as Array<{ field?: string }> | undefined)?.some((f) => f.field === "message.token")
  );
  // INVALID_ARGUMENT también cubre errores del contenido del mensaje: solo se borra el token
  // si el error apunta a message.token. Un error de programación no debe vaciar los dispositivos.
  if (r.status === 404 || codigo === "UNREGISTERED" || (codigo === "INVALID_ARGUMENT" && culpaDelToken)) {
    return "invalido";
  }
  console.error("FCM", r.status, codigo);
  return "error";
}

// Envía a todos los dispositivos del vecino, de a 20 en paralelo, y borra los tokens inválidos
// (como heredado:service.mjs:881-890). Si no queda ninguno, preferencias.push = false.
export async function enviarAVecino(uid: string, datos: DatosPush): Promise<number> {
  const dispositivos = await listar(`usuarios/${uid}/dispositivos`);
  let enviados = 0;
  const invalidos: string[] = [];
  for (let i = 0; i < dispositivos.length; i += 20) {
    const parte = dispositivos.slice(i, i + 20);
    const resultados = await Promise.all(parte.map((d) => {
      const token = d.datos.token;
      return typeof token === "string" && token ? enviarPush(token, datos) : Promise.resolve("invalido" as const);
    }));
    resultados.forEach((r, j) => {
      if (r === "ok") enviados++;
      else if (r === "invalido") invalidos.push(parte[j].ruta);
    });
  }
  if (invalidos.length) {
    await escribirLote(invalidos.map((ruta) => ({ tipo: "borrar" as const, ruta })));
    if (invalidos.length === dispositivos.length) {
      await escribirLote([{
        tipo: "update",
        ruta: `usuarios/${uid}`,
        datos: { "preferencias.push": false },
      }]);
    }
  }
  return enviados;
}
