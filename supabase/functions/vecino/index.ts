// POST /vecino/alta y POST /vecino/baja (sección 6.8).
import { datosInicialesVecino } from "../../../shared/catalogo.mjs";
import { recordatoriosTributos } from "../../../shared/recordatorios.mjs";
import { accionDe, atender, ok } from "../_shared/respuesta.ts";
import { ErrorHttp, type Identidad, verificarAppCheck, verificarUsuario } from "../_shared/firebase-auth.ts";
import {
  conFechas,
  type Escritura,
  escribirLote,
  HORA_SERVIDOR,
  listar,
  obtener,
  obtenerVarios,
} from "../_shared/firestore.ts";
import { notificacionPersonal } from "../_shared/comun.ts";
import { almacen, listarArchivos } from "../_shared/almacenamiento.ts";
import { borrarUsuarioAuth } from "../_shared/identidad.ts";

const SUBCOLECCIONES = [
  "tributos", "pagos", "reclamos", "estacionamiento", "notificaciones", "avisosLeidos", "dispositivos",
];

type Item = Record<string, unknown> & { id?: string };

// datosInicialesVecino puede entregar listas con `id` o mapas id → datos: se aceptan las dos formas.
function comoLista(valor: unknown): Array<{ id: string; datos: Record<string, unknown> }> {
  if (!valor) return [];
  const entradas: Array<[string, Item]> = Array.isArray(valor)
    ? (valor as Item[]).map((x) => [String(x.id), x])
    : Object.entries(valor as Record<string, Item>).map(([k, x]) => [String(x?.id ?? k), x]);
  return entradas.map(([id, x]) => {
    const { id: _id, uid: _uid, ...datos } = x as Item;
    return { id, datos };
  });
}

async function alta(id: Identidad): Promise<{ creado: boolean; tributos: number; recordatorios: number }> {
  const ruta = `usuarios/${id.uid}`;
  const ahora = Date.now();
  const iniciales = datosInicialesVecino(ahora) as Record<string, unknown>;
  const nombre = (id.nombre ?? "").trim().slice(0, 80) || "Vecino";

  // Perfil: update si existe (sincroniza nombre y anonimo después de vincular), set si no.
  const perfil = await obtener(ruta);
  let creado = false;
  if (!perfil) {
    const [r] = await escribirLote([{
      tipo: "set",
      ruta,
      soloSiNoExiste: true,
      datos: {
        nombre,
        anonimo: id.anonimo,
        creadoEn: HORA_SERVIDOR,
        actualizadoEn: HORA_SERVIDOR,
        altaEn: HORA_SERVIDOR,
        preferencias: iniciales.preferencias,
        cercania: null,
        privacidadAceptadaEn: null,
      },
    }]);
    if (r === "error") throw new Error("No se pudo crear el perfil");
    creado = r === "ok";
  }
  if (!creado) {
    // Existía (o lo creó el cliente en paralelo): solo los campos que maneja el servidor.
    const actual = perfil ?? await obtener(ruta);
    const datos: Record<string, unknown> = { nombre, anonimo: id.anonimo, actualizadoEn: HORA_SERVIDOR };
    if (!actual?.datos.altaEn) datos.altaEn = HORA_SERVIDOR;
    const [r] = await escribirLote([{ tipo: "update", ruta, datos }]);
    if (r === "error") throw new Error("No se pudo actualizar el perfil");
  }

  // Datos tributarios simulados, reclamo de ejemplo, bienvenida y recordatorios T4 inmediatos.
  // batchWrite no es atómico: un documento que ya existía no impide crear los demás.
  const tributos = comoLista(iniciales.tributos);
  const recordatorios = recordatoriosTributos(
    tributos.map((t) => ({ ...t.datos, id: t.id })),
    ahora,
  ) as Array<{ id: string; titulo: string; cuerpo: string; tipo?: string; destino?: string | null }>;
  const crear = (col: string, lista: Array<{ id: string; datos: Record<string, unknown> }>): Escritura[] =>
    lista.map(({ id: docId, datos }) => ({
      tipo: "set" as const,
      ruta: `${ruta}/${col}/${docId}`,
      soloSiNoExiste: true,
      datos: conFechas(datos),
    }));
  const notificaciones = comoLista(iniciales.notificaciones).map(({ id: nid, datos }) => ({
    id: nid,
    datos: { leida: false, leidaEn: null, origen: "servidor", zona: null, destino: null, enlace: null, ...datos },
  }));
  const escrituras: Escritura[] = [
    ...crear("tributos", tributos),
    ...crear("pagos", comoLista(iniciales.pagos)),
    ...crear("reclamos", comoLista(iniciales.reclamos)),
    ...crear("notificaciones", notificaciones),
    ...recordatorios.map((rec) => ({
      tipo: "set" as const,
      ruta: `${ruta}/notificaciones/${rec.id}`,
      soloSiNoExiste: true,
      datos: notificacionPersonal({
        titulo: rec.titulo,
        cuerpo: rec.cuerpo,
        tipo: rec.tipo ?? "tributos",
        destino: rec.destino ?? null,
      }),
    })),
  ];
  const resultados = await escribirLote(escrituras);
  if (resultados.includes("error")) throw new Error("No se pudieron crear todos los datos iniciales");
  const nTributos = tributos.length;
  const desdeRecordatorios = escrituras.length - recordatorios.length;
  return {
    creado,
    tributos: resultados.slice(0, nTributos).filter((r) => r === "ok").length,
    recordatorios: resultados.slice(desdeRecordatorios).filter((r) => r === "ok").length,
  };
}

async function baja(id: Identidad): Promise<{ borrados: number }> {
  const ruta = `usuarios/${id.uid}`;
  const ahora = Date.now();
  const porColeccion = await Promise.all(SUBCOLECCIONES.map((c) => listar(`${ruta}/${c}`)));
  const documentos = porColeccion.flat();

  // Bloqueos de patente de sus sesiones vigentes, solo si siguen apuntando a su sesión.
  const sesiones = porColeccion[SUBCOLECCIONES.indexOf("estacionamiento")]
    .filter((s) => Number(s.datos.fin) > ahora && typeof s.datos.patente === "string" && s.datos.patente);
  const bloqueos = sesiones.length
    ? await obtenerVarios([...new Set(sesiones.map((s) => `bloqueosPatente/${s.datos.patente}`))])
    : new Map();
  const bloqueosPropios = sesiones
    .filter((s) => bloqueos.get(`bloqueosPatente/${s.datos.patente}`)?.datos.sesionId === s.id)
    .map((s) => `bloqueosPatente/${s.datos.patente}`);

  // Adjuntos del bucket privado: adjuntos-reclamos/{uid}/…
  const archivos = await listarArchivos(id.uid);
  for (let i = 0; i < archivos.length; i += 100) {
    const { error } = await almacen().remove(archivos.slice(i, i + 100));
    if (error) throw new Error(`Storage remove: ${error.message}`);
  }

  const escrituras: Escritura[] = [
    ...documentos.map((d) => ({ tipo: "borrar" as const, ruta: d.ruta })),
    ...[...new Set(bloqueosPropios)].map((r) => ({ tipo: "borrar" as const, ruta: r })),
  ];
  const resultados = await escribirLote(escrituras);
  if (resultados.includes("error")) throw new Error("No se pudieron borrar todos los documentos");
  const [perfil] = await escribirLote([{ tipo: "borrar", ruta }]);
  if (perfil === "error") throw new Error("No se pudo borrar el perfil");

  // Al final, el usuario de Auth: así al recargar no se vuelve a sembrar nada.
  await borrarUsuarioAuth(id.uid);
  return { borrados: escrituras.length + 1 + archivos.length };
}

Deno.serve(atender(async (req) => {
  if (req.method !== "POST") throw new ErrorHttp(400, "validacion", "Método no admitido.");
  const accion = accionDe(req, "vecino");
  if (accion === "alta") {
    const id = await verificarUsuario(req);
    await verificarAppCheck(req);
    return ok(req, await alta(id));
  }
  if (accion === "baja") {
    const id = await verificarUsuario(req);
    return ok(req, await baja(id));
  }
  throw new ErrorHttp(404, "no-encontrado", "No existe esa acción.");
}));
