// Un paso del simulador municipal (sección 6.8): aplica el plan de shared/simulador.mjs.
// Mueve bicicletas y avanza reclamos con su evento. No toca alarmas: se activan solo desde el panel.
import { planificarPaso } from "../../../shared/simulador.mjs";
import {
  confirmar,
  consultar,
  type Doc,
  esPrecondicion,
  escribirLote,
  HORA_SERVIDOR,
  listar,
  q,
  uidDe,
} from "./firestore.ts";
import { despacharEvento } from "./entrega.ts";

const MIN_MS = 60_000;

// Sin el uid del vecino: el resultado queda guardado en public.ejecuciones y el panel identifica el
// reclamo por su id, que es único.
export type Cambio = {
  tipo: "bicicletas" | "reclamo";
  id: string;
  antes: number | string;
  despues: number | string;
};
export type Cambios = { cambios: Cambio[] };

type Plan = {
  estaciones?: Array<{ id: string; bicicletas: number }>;
  reclamos?: Array<{ uid: string; id: string; estado: string }>;
};
// planificarPaso está en JavaScript y sus listas por defecto ([]) se infieren como never[]: la firma
// que usa esta tarea se declara acá.
const planificar = planificarPaso as unknown as (
  entrada: { estaciones: Array<Record<string, unknown>>; reclamos: Array<Record<string, unknown>>; ahora: number },
) => Plan;

function candidatos(estado: string, antesDe: number): Promise<Doc[]> {
  // Índice compuesto de grupo reclamos (estado, actualizadoEn) de 2.5.
  return consultar({
    ...q.desde("reclamos", true),
    where: q.y(q.campo("EQUAL", "estado", estado), q.campo("LESS_THAN_OR_EQUAL", "actualizadoEn", { ms: antesDe })),
    limit: 3,
  });
}

export async function pasoSimulador(ahora: number): Promise<Cambios> {
  const [estaciones, recibidos, enProceso] = await Promise.all([
    listar("estaciones"),
    candidatos("recibido", ahora - 2 * MIN_MS),
    candidatos("en_proceso", ahora - 5 * MIN_MS),
  ]);
  const docsReclamos = [...recibidos, ...enProceso];
  const plan = planificar({
    estaciones: estaciones.map((d) => ({ ...d.datos, id: d.id })),
    reclamos: docsReclamos.map((d) => ({ ...d.datos, id: d.id, uid: uidDe(d.ruta) })),
    ahora,
  });

  const cambios: Cambio[] = [];

  // Bicicletas: un update por estación, sin precondición (el panel y el simulador escriben el valor final).
  const movimientos = (plan.estaciones ?? []).flatMap((e) => {
    const doc = estaciones.find((d) => d.id === e.id);
    const antes = Number(doc?.datos.bicicletas);
    if (!doc || !Number.isInteger(e.bicicletas) || antes === e.bicicletas) return [];
    return [{ doc, antes, despues: e.bicicletas }];
  });
  if (movimientos.length) {
    const r = await escribirLote(movimientos.map((m) => ({
      tipo: "update" as const,
      ruta: m.doc.ruta,
      datos: { bicicletas: m.despues, actualizadoEn: HORA_SERVIDOR },
    })));
    movimientos.forEach((m, i) => {
      if (r[i] === "ok") cambios.push({ tipo: "bicicletas", id: m.doc.id, antes: m.antes, despues: m.despues });
    });
  }

  // Reclamos: el avance y su evento van juntos (commit atómico), con la precondición updateTime
  // para no pisar un avance que el panel hizo mientras tanto.
  const eventos: string[] = [];
  for (const r of plan.reclamos ?? []) {
    const doc = docsReclamos.find((d) => d.id === r.id && uidDe(d.ruta) === r.uid);
    if (!doc) continue;
    const eventoId = `ev-${crypto.randomUUID()}`;
    try {
      await confirmar([
        {
          tipo: "update",
          ruta: doc.ruta,
          datos: {
            estado: r.estado,
            [`cronologia.${r.estado}`]: HORA_SERVIDOR,
            actualizadoEn: HORA_SERVIDOR,
            ultimoEventoId: eventoId,
          },
          siActualizado: doc.actualizado,
        },
        {
          tipo: "set",
          ruta: `eventos/${eventoId}`,
          soloSiNoExiste: true,
          datos: {
            tipo: "reclamo",
            refId: r.id,
            uid: r.uid,
            origen: "simulador",
            estado: "pendiente",
            intentos: 0,
            creadoEn: HORA_SERVIDOR,
          },
        },
      ]);
      cambios.push({ tipo: "reclamo", id: r.id, antes: String(doc.datos.estado), despues: r.estado });
      eventos.push(eventoId);
    } catch (e) {
      if (!esPrecondicion(e)) throw e;
    }
  }

  // Si municipal/config todavía no existe (catálogo sin sembrar), el update falla sin consecuencias.
  await escribirLote([{ tipo: "update", ruta: "municipal/config", datos: { ultimaSimulacion: HORA_SERVIDOR } }]);

  // Procesa en el momento los eventos que creó (push del avance del reclamo).
  for (const id of eventos) {
    try {
      await despacharEvento(id, ahora);
    } catch (e) {
      console.error("Simulador: no se pudo despachar", id, (e as Error).message);
    }
  }
  return { cambios };
}
