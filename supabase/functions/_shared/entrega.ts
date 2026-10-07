// Procesamiento de la bandeja de salida eventos/{id} (lógica de despachar, sección 6.8).
// Cada evento se reclama con una precondición updateTime: si otra ejecución lo tomó, se saltea.
import { decidirEntrega } from "../../../shared/notificaciones.mjs";
import { ETIQUETAS } from "../../../shared/constantes.mjs";
import {
  confirmar,
  consultar,
  consultarPaginado,
  type Doc,
  esPrecondicion,
  escribirLote,
  HORA_SERVIDOR,
  obtener,
  q,
} from "./firestore.ts";
import { type DatosPush, enviarAVecino } from "./fcm.ts";
import { enParalelo, notificacionPersonal, preferenciasDe, suma } from "./comun.ts";
import { ErrorHttp } from "./firebase-auth.ts";

const MAX_INTENTOS = 3;
// Un evento que quedó en "procesando" (la función se cortó a mitad) se retoma pasado este tiempo.
// procesadoEn guarda la hora del último intento mientras el evento está en curso.
const ATASCADO_MS = 5 * 60_000;

export type ResumenEntrega = { procesados: number; enviados: number; errores: number };

const VACIO: ResumenEntrega = { procesados: 0, enviados: 0, errores: 0 };

function elegible(ev: Record<string, unknown>, ahora: number): boolean {
  const intentos = Number(ev.intentos ?? 0);
  if (intentos >= MAX_INTENTOS) return false;
  if (ev.estado === "pendiente" || ev.estado === "error") return true;
  if (ev.estado === "procesando") return Number(ev.procesadoEn ?? 0) < ahora - ATASCADO_MS;
  return false;
}

// Recorre los vecinos con algún dispositivo y envía a los que `decide` acepta.
async function enviarAVecinosConPush(
  decide: (perfil: Record<string, unknown>) => boolean,
  datos: DatosPush,
  alEnviar: (uid: string) => void = () => {},
): Promise<number> {
  let enviados = 0;
  await consultarPaginado(
    { ...q.desde("usuarios"), where: q.campo("EQUAL", "preferencias.push", true) },
    async (docs) => {
      const elegidos = docs.filter((d) => decide(d.datos));
      const r = await enParalelo(elegidos, 10, (d) => {
        alEnviar(d.id);
        return enviarAVecino(d.id, datos);
      });
      enviados += suma(r);
    },
  );
  return enviados;
}

async function entregarAviso(eventoId: string, ev: Record<string, unknown>): Promise<number> {
  const aviso = await obtener(`avisos/${ev.refId}`);
  if (!aviso) throw new Error(`No existe avisos/${ev.refId}`);
  const a = aviso.datos;
  const notif = { tipo: a.tipo, zona: a.zona };
  return enviarAVecinosConPush(
    (perfil) => decidirEntrega(notif, preferenciasDe(perfil)).push,
    {
      id: eventoId,
      titulo: String(a.titulo ?? "Aviso municipal"),
      cuerpo: String(a.cuerpo ?? ""),
      destino: typeof a.destino === "string" && a.destino ? a.destino : "#/notificaciones",
      tipo: String(a.tipo ?? "servicios"),
    },
  );
}

async function entregarAlarma(eventoId: string, ev: Record<string, unknown>, ahora: number): Promise<number> {
  const alarma = await obtener(`alarmas/${ev.refId}`);
  if (!alarma) throw new Error(`No existe alarmas/${ev.refId}`);
  const a = alarma.datos;
  // Evento viejo: la alarma ya se desactivó o la activó otro evento. No se avisa de algo que no está pasando.
  if (a.activa !== true || (a.activacionId && a.activacionId !== eventoId)) return 0;

  const destino = `#/alarmas/${ev.refId}`;
  const nombre = String(a.nombre ?? "comunitaria");
  const titulo = `Alarma activada: ${nombre}`.slice(0, 100);
  const cuerpo = `Se activó la alarma ${nombre}${a.referencia ? ` (${a.referencia})` : ""}. ` +
    "Mantené la calma y seguí las indicaciones de las autoridades.";

  // Aviso público para el historial de quienes siguen la zona (idempotente por su id).
  await escribirLote([{
    tipo: "set",
    ruta: `avisos/alarma-${eventoId}`,
    soloSiNoExiste: true,
    datos: {
      titulo,
      cuerpo,
      detalle: "Aviso de demostración generado por la activación de una alarma comunitaria.",
      tipo: "alarmas",
      zona: a.zona ?? "todas",
      destino,
      enlace: null,
      creadoEn: HORA_SERVIDOR,
      autor: ev.origen === "simulador" ? "simulador" : "municipalidad",
      eventoId,
      vigenteHasta: null,
    },
  }]);

  const notif = { tipo: "alarmas", zona: a.zona };
  const datos: DatosPush = { id: eventoId, titulo, cuerpo, destino, tipo: "alarmas" };
  const yaEnviados = new Set<string>();

  // 1. Quienes siguen la zona.
  let enviados = await enviarAVecinosConPush(
    (perfil) => decidirEntrega(notif, preferenciasDe(perfil)).push,
    datos,
    (uid) => yaEnviados.add(uid),
  );

  // 2. Quienes pidieron avisos de cercanía para esta alarma (solo ids, nunca coordenadas).
  const cercanos = (await consultar({
    ...q.desde("usuarios"),
    where: q.campo("ARRAY_CONTAINS", "cercania.alarmas", ev.refId),
    limit: 1000,
  })).filter((d) => Number((d.datos.cercania as { vence?: number } | null)?.vence ?? 0) > ahora);

  const fueraDeZona = cercanos.filter((d) => !decidirEntrega(notif, preferenciasDe(d.datos)).historial);
  if (fueraDeZona.length) {
    await escribirLote(fueraDeZona.map((d) => ({
      tipo: "set" as const,
      ruta: `usuarios/${d.id}/notificaciones/alarma-${eventoId}`,
      soloSiNoExiste: true,
      datos: notificacionPersonal({ titulo, cuerpo, tipo: "alarmas", zona: (a.zona as string) ?? null, destino }),
    })));
  }
  const porEnviar = cercanos.filter((d) =>
    !yaEnviados.has(d.id) && decidirEntrega(notif, preferenciasDe(d.datos), { cercano: true }).push
  );
  enviados += suma(await enParalelo(porEnviar, 10, (d) => enviarAVecino(d.id, datos)));
  return enviados;
}

async function entregarReclamo(eventoId: string, ev: Record<string, unknown>): Promise<number> {
  const uid = ev.uid;
  if (typeof uid !== "string" || !uid) throw new Error("El evento de reclamo no tiene uid");
  const [reclamo, perfil] = await Promise.all([
    obtener(`usuarios/${uid}/reclamos/${ev.refId}`),
    obtener(`usuarios/${uid}`),
  ]);
  if (!reclamo) throw new Error(`No existe el reclamo ${ev.refId}`);
  const r = reclamo.datos;
  const etiquetas = (ETIQUETAS as { estadosReclamo?: Record<string, string> }).estadosReclamo ?? {};
  const estado = String(r.estado ?? "");
  const titulo = `Tu reclamo ${r.codigo ?? ""} pasó a ${etiquetas[estado] ?? estado}`.replace(/\s+/g, " ");
  const nota = typeof r.notaMunicipal === "string" && r.notaMunicipal.trim() ? r.notaMunicipal.trim() : "";
  const cuerpo = nota ? `Nota de la Municipalidad: ${nota}` : "Podés ver el detalle y la línea de tiempo en Reclamos.";
  const destino = `#/reclamos/${ev.refId}`;

  const [resultado] = await escribirLote([{
    tipo: "set",
    ruta: `usuarios/${uid}/notificaciones/reclamo-${eventoId}`,
    soloSiNoExiste: true,
    datos: notificacionPersonal({ titulo, cuerpo, tipo: "reclamos", destino }),
  }]);
  if (resultado !== "ok" || !perfil) return 0;
  if (!decidirEntrega({ tipo: "reclamos", zona: null }, preferenciasDe(perfil.datos)).push) return 0;
  return enviarAVecino(uid, { id: eventoId, titulo, cuerpo, destino, tipo: "reclamos" });
}

// Reclama y procesa un evento ya leído. Nunca lanza por un fallo de la entrega: lo deja en "error".
export async function procesarEvento(doc: Doc, ahora = Date.now()): Promise<ResumenEntrega> {
  const ev = doc.datos;
  const eventoId = doc.id;
  const atascado = ev.estado === "procesando";
  const intentos = Number(ev.intentos ?? 0) + (atascado ? 1 : 0);
  try {
    await confirmar([{
      tipo: "update",
      ruta: doc.ruta,
      datos: { estado: "procesando", procesadoEn: HORA_SERVIDOR, ...(atascado ? { intentos } : {}) },
      siActualizado: doc.actualizado,
    }]);
  } catch (e) {
    if (esPrecondicion(e)) return VACIO; // otra ejecución lo tomó
    throw e;
  }
  try {
    let enviados: number;
    if (ev.tipo === "aviso") enviados = await entregarAviso(eventoId, ev);
    else if (ev.tipo === "alarma") enviados = await entregarAlarma(eventoId, ev, ahora);
    else if (ev.tipo === "reclamo") enviados = await entregarReclamo(eventoId, ev);
    else throw new Error(`Tipo de evento desconocido: ${ev.tipo}`);
    await escribirLote([{
      tipo: "update",
      ruta: doc.ruta,
      datos: { estado: "enviado", procesadoEn: HORA_SERVIDOR, enviados },
    }]);
    return { procesados: 1, enviados, errores: 0 };
  } catch (e) {
    const mensaje = String((e as Error)?.message ?? e).slice(0, 200);
    console.error("Evento", eventoId, mensaje);
    await escribirLote([{
      tipo: "update",
      ruta: doc.ruta,
      datos: { estado: "error", intentos: intentos + 1, error: mensaje, procesadoEn: HORA_SERVIDOR },
    }]);
    return { procesados: 1, enviados: 0, errores: 1 };
  }
}

export async function despacharEvento(eventoId: string, ahora = Date.now()): Promise<ResumenEntrega> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(eventoId)) throw new ErrorHttp(400, "validacion", "El evento no es válido.");
  const doc = await obtener(`eventos/${eventoId}`);
  if (!doc) throw new ErrorHttp(404, "no-encontrado", "No encontramos el evento.");
  if (!elegible(doc.datos, ahora)) return VACIO;
  return procesarEvento(doc, ahora);
}

// Barrido de la bandeja: estado in [...] por creadoEn, limit 50 (índice de 2.5); en el código,
// intentos < 3 y como máximo 20 eventos por corrida.
export async function barrerBandeja(ahora = Date.now()): Promise<ResumenEntrega> {
  const docs = await consultar({
    ...q.desde("eventos"),
    where: q.campo("IN", "estado", ["pendiente", "error", "procesando"]),
    orderBy: [q.orden("creadoEn")],
    limit: 50,
  });
  const lote = docs.filter((d) => elegible(d.datos, ahora)).slice(0, 20);
  const resultados = await enParalelo(lote, 4, (d) => procesarEvento(d, ahora));
  return {
    procesados: suma(resultados.map((r) => r.procesados)),
    enviados: suma(resultados.map((r) => r.enviados)),
    errores: suma(resultados.map((r) => r.errores)),
  };
}
