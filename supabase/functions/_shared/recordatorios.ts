// Recordatorios programados: tributos (T4, tarea diaria), estacionamiento (E3, tarea minuto)
// y resumen diario (N2). Las claves deterministas de shared/recordatorios.mjs son el id de la
// notificación y el data.id del push, así que repetir una tarea no duplica nada.
import { recordatoriosEstacionamiento, recordatoriosTributos } from "../../../shared/recordatorios.mjs";
import { avisoVisible, decidirEntrega } from "../../../shared/notificaciones.mjs";
import {
  consultar,
  consultarPaginado,
  type Doc,
  type Escritura,
  escribirLote,
  obtenerVarios,
  q,
  uidDe,
} from "./firestore.ts";
import { enviarAVecino } from "./fcm.ts";
import { diaCordoba, enParalelo, notificacionPersonal, preferenciasDe, suma } from "./comun.ts";

const DIA_MS = 86_400_000;
const MIN_MS = 60_000;

type Recordatorio = {
  id: string;
  titulo: string;
  cuerpo: string;
  tipo?: string;
  destino?: string | null;
  sesionId?: string;
  etapa?: string;
};
type Pendiente = { uid: string; rec: Recordatorio; tipo: string };

function agruparPorUid(docs: Doc[]): Map<string, Array<Record<string, unknown>>> {
  const grupos = new Map<string, Array<Record<string, unknown>>>();
  for (const d of docs) {
    const uid = uidDe(d.ruta);
    if (!uid) continue;
    if (!grupos.has(uid)) grupos.set(uid, []);
    grupos.get(uid)!.push({ ...d.datos, id: d.id, uid });
  }
  return grupos;
}

// Crea las notificaciones (soloSiNoExiste) y envía push solo por las recién creadas, si las
// preferencias del vecino lo permiten. Las escrituras extra (flags de sesión) van en el mismo lote.
async function crearYAvisar(pendientes: Pendiente[], extra: Escritura[] = []): Promise<{ notificaciones: number; push: number }> {
  if (!pendientes.length && !extra.length) return { notificaciones: 0, push: 0 };
  const resultados = await escribirLote([
    ...pendientes.map(({ uid, rec, tipo }) => ({
      tipo: "set" as const,
      ruta: `usuarios/${uid}/notificaciones/${rec.id}`,
      soloSiNoExiste: true,
      datos: notificacionPersonal({ titulo: rec.titulo, cuerpo: rec.cuerpo, tipo, destino: rec.destino ?? null }),
    })),
    ...extra,
  ]);
  const creadas = pendientes.filter((_, i) => resultados[i] === "ok");
  if (!creadas.length) return { notificaciones: 0, push: 0 };
  const perfiles = await obtenerVarios([...new Set(creadas.map((c) => `usuarios/${c.uid}`))]);
  const envios = await enParalelo(creadas, 10, async ({ uid, rec, tipo }) => {
    const perfil = perfiles.get(`usuarios/${uid}`);
    if (!perfil || !decidirEntrega({ tipo, zona: null }, preferenciasDe(perfil.datos)).push) return 0;
    return enviarAVecino(uid, {
      id: rec.id,
      titulo: rec.titulo,
      cuerpo: rec.cuerpo,
      destino: rec.destino ?? "#/notificaciones",
      tipo,
    });
  });
  return { notificaciones: creadas.length, push: suma(envios) };
}

// T4: tributos impagos que vencen dentro de 3 días o ya vencieron (índice pagadoEn + vence de 2.5).
export async function recordatoriosDiarios(ahora: number, dias = 3): Promise<{ notificaciones: number; push: number }> {
  const docs = await consultar({
    ...q.desde("tributos", true),
    where: q.y(q.esNulo("pagadoEn"), q.campo("LESS_THAN_OR_EQUAL", "vence", { ms: ahora + dias * DIA_MS })),
    limit: 2000,
  });
  const pendientes: Pendiente[] = [];
  for (const [uid, tributos] of agruparPorUid(docs)) {
    for (const rec of recordatoriosTributos(tributos, ahora, dias) as Recordatorio[]) {
      pendientes.push({ uid, rec, tipo: rec.tipo ?? "tributos" });
    }
  }
  return crearYAvisar(pendientes);
}

// E3: sesiones por vencer (umbral municipal/config.avisoEstacionamientoMin) y recién finalizadas.
export async function recordatoriosMinuto(ahora: number, minutos: number): Promise<{ notificaciones: number; push: number }> {
  const grupo = q.desde("estacionamiento", true);
  const [porVencer, finalizadas] = await Promise.all([
    consultar({
      ...grupo,
      where: q.y(q.campo("GREATER_THAN", "fin", { ms: ahora }), q.campo("LESS_THAN_OR_EQUAL", "fin", { ms: ahora + 14 * MIN_MS })),
      limit: 500,
    }),
    consultar({
      ...grupo,
      where: q.y(q.campo("GREATER_THAN", "fin", { ms: ahora - 3 * MIN_MS }), q.campo("LESS_THAN_OR_EQUAL", "fin", { ms: ahora })),
      limit: 500,
    }),
  ]);
  const candidatos = [
    ...porVencer.filter((d) => Number(d.datos.fin) <= ahora + minutos * MIN_MS && d.datos.avisoPorVencer !== true),
    ...finalizadas.filter((d) => d.datos.avisoFinalizado !== true),
  ];
  if (!candidatos.length) return { notificaciones: 0, push: 0 };

  const porSesion = new Map(candidatos.map((d) => [d.id, d]));
  const sesiones = candidatos.map((d) => ({ ...d.datos, id: d.id, uid: uidDe(d.ruta) }));
  const pendientes: Pendiente[] = [];
  const marcas: Escritura[] = [];
  for (const rec of recordatoriosEstacionamiento(sesiones, ahora, minutos) as Recordatorio[]) {
    const doc = porSesion.get(rec.sesionId ?? "");
    const uid = doc && uidDe(doc.ruta);
    if (!doc || !uid) continue;
    pendientes.push({ uid, rec, tipo: "estacionamiento" });
    // Marca la sesión con la precondición updateTime: si el vecino extendió mientras tanto,
    // la marca no se aplica y el aviso de la nueva hora de fin sigue pendiente.
    marcas.push({
      tipo: "update",
      ruta: doc.ruta,
      datos: rec.etapa === "finalizado" ? { avisoFinalizado: true } : { avisoPorVencer: true },
      siActualizado: doc.actualizado,
    });
  }
  return crearYAvisar(pendientes, marcas);
}

// N2: push "Tenés N novedades hoy" a quienes eligieron el resumen diario y tienen dispositivo.
export async function resumenDiario(ahora: number): Promise<{ notificaciones: number; push: number }> {
  const desde = ahora - DIA_MS;
  const avisos = await consultar({
    ...q.desde("avisos"),
    where: q.campo("GREATER_THAN_OR_EQUAL", "creadoEn", { ms: desde }),
    limit: 200,
  });
  const dia = diaCordoba(ahora);
  let push = 0;
  await consultarPaginado(
    { ...q.desde("usuarios"), where: q.campo("EQUAL", "preferencias.frecuencia", "resumen_diario") },
    async (docs) => {
      const elegidos = docs.filter((d) => preferenciasDe(d.datos).push);
      const envios = await enParalelo(elegidos, 5, async (d) => {
        const prefs = preferenciasDe(d.datos);
        const visibles = avisos.filter((a) => avisoVisible({ ...a.datos, id: a.id }, prefs));
        const rutasLeidos = visibles.map((a) => `usuarios/${d.id}/avisosLeidos/${a.id}`);
        const leidos = rutasLeidos.length ? await obtenerVarios(rutasLeidos) : new Map();
        const avisosSinLeer = rutasLeidos.filter((r) => !leidos.get(r)).length;
        const personales = await consultar({
          ...q.desde("notificaciones"),
          where: q.campo("GREATER_THAN_OR_EQUAL", "creadoEn", { ms: desde }),
          limit: 100,
        }, `usuarios/${d.id}`);
        const n = avisosSinLeer + personales.filter((x) => x.datos.leida !== true).length;
        if (!n) return 0;
        return enviarAVecino(d.id, {
          id: `resumen-${d.id}-${dia}`,
          titulo: n === 1 ? "Tenés 1 novedad hoy" : `Tenés ${n} novedades hoy`,
          cuerpo: "Tocá para ver tus avisos y notificaciones de Conecta.",
          destino: "#/notificaciones",
          tipo: "resumen",
        });
      });
      push += suma(envios);
    },
  );
  return { notificaciones: 0, push };
}
