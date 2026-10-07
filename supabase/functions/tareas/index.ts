// GET /tareas (pública, prueba de humo) y POST /tareas { tarea } (sección 6.8).
// pg_cron la llama con x-cron-secret; el panel puede pedir diaria, resumen y simulador como admin.
import { atender, leerJson, ok } from "../_shared/respuesta.ts";
import { encabezadosCors } from "../_shared/cors.ts";
import { ErrorHttp, exigirAdmin, verificarAppCheck, verificarCron, verificarUsuario } from "../_shared/firebase-auth.ts";
import { obtener } from "../_shared/firestore.ts";
import { barrerBandeja } from "../_shared/entrega.ts";
import { recordatoriosDiarios, recordatoriosMinuto, resumenDiario } from "../_shared/recordatorios.ts";
import { pasoSimulador } from "../_shared/simulacion.ts";
import { conRegistro } from "../_shared/registro.ts";

const VERSION = "2.0.0";
const TAREAS = ["minuto", "diaria", "resumen", "simulador"] as const;
type Tarea = typeof TAREAS[number];

function entre(n: unknown, min: number, max: number, respaldo: number): number {
  const v = Number(n);
  return Number.isInteger(v) && v >= min && v <= max ? v : respaldo;
}

// minuto: (1) avisos E3, (2) barrido de la bandeja, (3) simulador si toca. Corre los tres pasos
// aunque uno falle, y si alguno falló la ejecución queda con ok = false.
async function minuto(ahora: number) {
  const config = (await obtener("municipal/config"))?.datos ?? {};
  const avisoMin = entre(config.avisoEstacionamientoMin, 1, 14, 5);
  const errores: string[] = [];
  const resultado: Record<string, unknown> = { avisoEstacionamientoMin: avisoMin };
  try {
    resultado.estacionamiento = await recordatoriosMinuto(ahora, avisoMin);
  } catch (e) {
    errores.push(`estacionamiento: ${(e as Error).message}`);
  }
  try {
    resultado.bandeja = await barrerBandeja(ahora);
  } catch (e) {
    errores.push(`bandeja: ${(e as Error).message}`);
  }
  const cadaMin = entre(config.simuladorCadaMin, 1, 30, 2);
  const ultima = Number(config.ultimaSimulacion ?? 0);
  if (config.simuladorActivo === true && ahora - ultima >= cadaMin * 60_000 - 5_000) {
    try {
      resultado.simulador = await pasoSimulador(ahora);
    } catch (e) {
      errores.push(`simulador: ${(e as Error).message}`);
    }
  }
  if (errores.length) throw new Error(errores.join(" | ").slice(0, 480));
  return resultado;
}

function ejecutar(tarea: Tarea, ahora: number): Promise<unknown> {
  switch (tarea) {
    case "minuto":
      return minuto(ahora);
    case "diaria":
      return recordatoriosDiarios(ahora);
    case "resumen":
      return resumenDiario(ahora);
    case "simulador":
      return pasoSimulador(ahora);
  }
}

Deno.serve(atender(async (req) => {
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, version: VERSION, datos: { version: VERSION } }), {
      headers: { ...encabezadosCors(req), "Content-Type": "application/json; charset=utf-8" },
    });
  }
  if (req.method !== "POST") throw new ErrorHttp(400, "validacion", "Método no admitido.");
  const desdeCron = verificarCron(req);
  // Sin secreto del cron: hace falta un admin (y la tarea de cada minuto no se admite).
  let cuerpo: Record<string, unknown>;
  if (desdeCron) {
    cuerpo = await leerJson(req);
  } else {
    const id = await verificarUsuario(req);
    await verificarAppCheck(req);
    cuerpo = await leerJson(req);
    if (cuerpo.tarea === "minuto") throw new ErrorHttp(403, "permiso", "Esta tarea solo la ejecuta el servidor.");
    await exigirAdmin(id, { obtener });
  }
  const tarea = cuerpo.tarea as Tarea;
  if (!TAREAS.includes(tarea)) throw new ErrorHttp(400, "validacion", "La tarea no es válida.");
  const ahora = Date.now();
  const resultado = await conRegistro(tarea, () => ejecutar(tarea, ahora));
  return ok(req, resultado);
}));
