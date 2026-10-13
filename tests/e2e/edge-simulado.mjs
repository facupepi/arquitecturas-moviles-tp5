// Doble de las Edge Functions de Supabase para las pruebas extremo a extremo (WP1, sección 10.3).
//
//   node tests/e2e/edge-simulado.mjs            (lo arranca scripts/emuladores.mjs; puerto PUERTO_EDGE o 8787)
//
// Implementa el contrato HTTP de 6.3 contra los emuladores de Auth y Firestore con firebase-admin:
//   POST vecino/alta     perfil + datosInicialesVecino + recordatorios inmediatos de T4 (idempotente)
//   POST vecino/baja     borra subcolecciones, eventos con su uid, bloqueos propios, adjuntos, perfil y el usuario de Auth
//   POST adjuntos/subir  un archivo por solicitud; valida con shared/dominio.mjs; tope por vecino (429);
//                        guarda en una carpeta temporal
//   POST adjuntos/url    { ruta } → { url, venceEn }; la URL la sirve este mismo servidor (GET /archivos/…)
//   POST despachar       admin; escribe en el historial lo mismo que entrega.ts (aviso de alarma,
//                        notificación de reclamo y de alarma cercana) y marca el evento enviado, sin push
//   GET  tareas          { ok: true, version }
//   POST tareas          admin; diaria y resumen devuelven conteos; simulador aplica planificarPaso
//
// No verifica la firma del token (el emulador de Auth no firma), pero decodifica el payload y aplica
// el mismo criterio que verificarUsuario de Supabase: una sesión que no es de Google (anónima, con
// contraseña o con token personalizado) recibe 403 en todas las funciones (aunque tenga documento en
// administradores), igual que en las reglas.
//
// Modo compartido (varios agentes contra los mismos emuladores): cada agente usa su propio proyecto
// demo-* de Firestore y llama con el prefijo /p/<proyecto>, por ejemplo
//   http://127.0.0.1:8787/p/demo-conecta-tp5-s3/functions/v1/vecino/alta
// Sin prefijo se usa GCLOUD_PROJECT (demo-conecta-tp5). Los usuarios de Auth viven todos en el proyecto
// por defecto del emulador (el SDK web no manda el proyecto al emulador de Auth).
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { documentosVecino } from '../../scripts/sembrar.mjs';
import { recordatoriosTributos } from '../../shared/recordatorios.mjs';
import { planificarPaso } from '../../shared/simulador.mjs';
import { recortarNombreArchivo, tipoPorFirma } from '../../shared/dominio.mjs';
import { COLECCIONES as C, ETIQUETAS, EXTENSION_ARCHIVO, LIMITES } from '../../shared/constantes.mjs';
import { decidirEntrega } from '../../shared/notificaciones.mjs';

export const VERSION = '2.0.0-e2e';
const PROYECTO_POR_DEFECTO = process.env.GCLOUD_PROJECT || 'demo-conecta-tp5';
const PUERTO = Number(process.env.PUERTO_EDGE) || 8787;
const HOST = '127.0.0.1';
const CARPETA = process.env.EDGE_SIMULADO_CARPETA || join(tmpdir(), 'conecta-edge-simulado');
const BYTES_MAX = LIMITES.bytesAdjunto;
const ARCHIVOS_POR_VECINO = LIMITES.adjuntosPorVecino;
const DIA_MS = 24 * 60 * 60 * 1000;
const MIN_MS = 60_000;
const PATRON_RUTA = /^[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_-]{1,64}\/[0-2]-[a-f0-9]{12}\.(jpg|png|pdf)$/;
const PATRON_PROYECTO = /^demo-[a-z0-9-]{1,40}$/;
const SUBCOLECCIONES = [C.tributos, C.pagos, C.reclamos, C.estacionamiento, C.notificaciones, C.avisosLeidos, C.dispositivos, C.tarjetas];

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8086';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9098';
process.env.METADATA_SERVER_DETECTION ??= 'none';
if (!PROYECTO_POR_DEFECTO.startsWith('demo-')) throw new Error('edge-simulado solo corre contra proyectos demo-*.');

class ErrorHttp extends Error {
  constructor(estado, codigo, mensaje) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
  }
}

// ---------- firebase-admin por proyecto ----------

function appDe(proyecto) {
  const nombre = `edge-${proyecto}`;
  return getApps().find((a) => a.name === nombre) ?? initializeApp({ projectId: proyecto }, nombre);
}
const dbDe = (proyecto) => getFirestore(appDe(proyecto));
const authUsuarios = () => getAuth(appDe(PROYECTO_POR_DEFECTO));

// ---------- HTTP ----------

function encabezadosCors(req) {
  const enc = {
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, x-firebase-appcheck',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '3600',
    Vary: 'Origin',
  };
  const origen = req.headers.origin;
  // Solo orígenes locales (los Vite de las pruebas), como ORIGENES_PERMITIDOS en Supabase.
  if (origen && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origen)) enc['Access-Control-Allow-Origin'] = origen;
  return enc;
}

function responder(req, res, estado, cuerpo) {
  res.writeHead(estado, { ...encabezadosCors(req), 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(cuerpo));
}

function leerCuerpo(req, limite = BYTES_MAX + 256 * 1024) {
  return new Promise((resolver, rechazar) => {
    const partes = [];
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > limite) {
        rechazar(new ErrorHttp(413, 'adjunto-invalido', 'El archivo supera los 2 MB.'));
        req.destroy();
        return;
      }
      partes.push(c);
    });
    req.on('end', () => resolver(Buffer.concat(partes)));
    req.on('error', rechazar);
  });
}

async function leerJson(req) {
  const texto = (await leerCuerpo(req, 64 * 1024)).toString('utf8');
  if (!texto.trim()) return {};
  try {
    const v = JSON.parse(texto);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  } catch { /* abajo */ }
  throw new ErrorHttp(400, 'validacion', 'El cuerpo de la solicitud no es válido.');
}

// ---------- Identidad (sin firma: el emulador no firma los tokens) ----------

export function decodificarToken(token) {
  const partes = String(token || '').split('.');
  if (partes.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function verificarUsuario(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '');
  const payload = m ? decodificarToken(m[1]) : null;
  const sub = payload?.sub ?? payload?.user_id;
  if (typeof sub !== 'string' || !sub || sub.length > 128) {
    throw new ErrorHttp(401, 'sin-sesion', 'La sesión no es válida o venció.');
  }
  if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000) - 30) {
    throw new ErrorHttp(401, 'sin-sesion', 'La sesión no es válida o venció.');
  }
  const proveedor = payload.firebase?.sign_in_provider ?? 'desconocido';
  if (proveedor !== 'google.com') {
    throw new ErrorHttp(403, 'permiso', 'Ingresá con tu cuenta de Google para usar Conecta.');
  }
  return { uid: sub, proveedor, nombre: typeof payload.name === 'string' ? payload.name : null };
}

// Mismo criterio que _shared/firebase-auth.ts: sin documento en administradores → 403.
async function exigirAdmin(db, id) {
  if (!(await db.doc(`${C.administradores}/${id.uid}`).get()).exists) {
    throw new ErrorHttp(403, 'permiso', 'Esta operación corresponde al personal municipal.');
  }
}

// ---------- vecino ----------

async function crearSiFalta(ref, datos) {
  try {
    await ref.create(datos);
    return true;
  } catch (e) {
    if (e?.code === 6 || /already exists/i.test(e?.message ?? '')) return false;
    throw e;
  }
}

async function alta(db, id) {
  const ahora = Date.now();
  const nombre = (id.nombre ?? '').trim().slice(0, 80) || 'Vecino';
  const [[rutaPerfil, perfilBase], ...resto] = documentosVecino(id.uid, { ahora, nombre });
  const refPerfil = db.doc(rutaPerfil);
  const actual = await refPerfil.get();
  let creado = false;
  if (!actual.exists) {
    creado = await crearSiFalta(refPerfil, {
      ...perfilBase,
      anonimo: false,
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
      altaEn: FieldValue.serverTimestamp(),
    });
  }
  if (!creado) {
    const datos = { nombre, anonimo: false, actualizadoEn: FieldValue.serverTimestamp() };
    const existente = actual.exists ? actual : await refPerfil.get();
    if (!existente.get('altaEn')) datos.altaEn = FieldValue.serverTimestamp();
    await refPerfil.update(datos);
  }

  let tributos = 0;
  let recordatorios = 0;
  await Promise.all(resto.map(async ([ruta, datos]) => {
    const esNotificacion = ruta.includes(`/${C.notificaciones}/`);
    const completos = esNotificacion
      ? { leida: false, leidaEn: null, origen: 'servidor', zona: null, destino: null, enlace: null, ...datos }
      : datos;
    const nuevo = await crearSiFalta(db.doc(ruta), completos);
    if (nuevo && ruta.includes(`/${C.tributos}/`)) tributos += 1;
    if (nuevo && /\/notificaciones\/tributo-/.test(ruta)) recordatorios += 1;
  }));
  return { creado, tributos, recordatorios };
}

async function baja(db, proyecto, id) {
  const raiz = db.doc(`${C.usuarios}/${id.uid}`);
  const ahora = Date.now();
  let borrados = 0;
  const sesiones = await raiz.collection(C.estacionamiento).get();
  for (const s of sesiones.docs) {
    const fin = s.get('fin');
    const patente = s.get('patente');
    const finMs = fin instanceof Timestamp ? fin.toMillis() : Number(fin);
    if (!patente || !(finMs > ahora)) continue;
    const bloqueo = db.doc(`${C.bloqueos}/${patente}`);
    const snap = await bloqueo.get();
    if (snap.exists && snap.get('sesionId') === s.id) {
      await bloqueo.delete();
      borrados += 1;
    }
  }
  for (const col of SUBCOLECCIONES) {
    const docs = await raiz.collection(col).listDocuments();
    for (let i = 0; i < docs.length; i += 400) {
      const lote = db.batch();
      for (const d of docs.slice(i, i + 400)) lote.delete(d);
      await lote.commit();
    }
    borrados += docs.length;
  }
  // Eventos de la bandeja que guardan su uid, en páginas como consultarPaginado de Supabase.
  for (;;) {
    const pagina = await db.collection(C.eventos).where('uid', '==', id.uid).limit(300).get();
    if (pagina.empty) break;
    const lote = db.batch();
    for (const d of pagina.docs) lote.delete(d.ref);
    await lote.commit();
    borrados += pagina.size;
    if (pagina.size < 300) break;
  }
  await rm(carpetaArchivos(proyecto, id.uid), { recursive: true, force: true });
  await raiz.delete();
  borrados += 1;
  try {
    await authUsuarios().deleteUser(id.uid);
  } catch (e) {
    if (e?.code !== 'auth/user-not-found') throw e;
  }
  return { borrados };
}

// ---------- adjuntos ----------

function carpetaArchivos(proyecto, ...partes) {
  const base = resolve(CARPETA, proyecto);
  const destino = resolve(base, ...partes);
  if (destino !== base && !destino.startsWith(base + sep)) throw new ErrorHttp(400, 'validacion', 'Ruta inválida.');
  return destino;
}

async function subir(req, proyecto) {
  const id = verificarUsuario(req);
  const largo = Number(req.headers['content-length'] ?? 0);
  if (largo > BYTES_MAX + 64 * 1024) throw new ErrorHttp(413, 'adjunto-invalido', 'El archivo supera los 2 MB.');
  const cuerpo = await leerCuerpo(req);
  let formulario;
  try {
    formulario = await new Request('http://edge.local/', {
      method: 'POST', headers: { 'content-type': req.headers['content-type'] ?? '' }, body: cuerpo,
    }).formData();
  } catch {
    throw new ErrorHttp(400, 'adjunto-invalido', 'No pudimos leer el archivo enviado.');
  }
  const reclamoId = String(formulario.get('reclamoId') ?? '');
  const indice = Number(formulario.get('indice'));
  const archivo = formulario.get('archivo');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(reclamoId)) throw new ErrorHttp(400, 'validacion', 'El reclamo no es válido.');
  if (!Number.isInteger(indice) || indice < 0 || indice > 2) throw new ErrorHttp(400, 'validacion', 'Se admiten hasta 3 archivos por reclamo.');
  if (!archivo || typeof archivo.arrayBuffer !== 'function') throw new ErrorHttp(400, 'adjunto-invalido', 'Falta el archivo.');
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  if (bytes.length > BYTES_MAX) throw new ErrorHttp(413, 'adjunto-invalido', 'El archivo supera los 2 MB.');
  if (bytes.length === 0) throw new ErrorHttp(400, 'adjunto-invalido', 'El archivo está vacío.');
  const tipo = tipoPorFirma(bytes);
  if (!tipo || !EXTENSION_ARCHIVO[tipo]) throw new ErrorHttp(400, 'adjunto-invalido', 'Solo se admiten imágenes JPG o PNG y archivos PDF.');
  if (archivo.type && archivo.type in EXTENSION_ARCHIVO && archivo.type !== tipo) {
    throw new ErrorHttp(400, 'adjunto-invalido', 'El contenido del archivo no coincide con su tipo.');
  }
  const extension = EXTENSION_ARCHIVO[tipo];
  const nombre = recortarNombreArchivo(archivo.name || `adjunto.${extension}`);
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  const ruta = `${id.uid}/${reclamoId}/${indice}-${hash}.${extension}`;
  const destino = carpetaArchivos(proyecto, ruta);
  // Tope por vecino, como adjuntos/index.ts; un reintento del mismo archivo no suma.
  const propios = await readdir(carpetaArchivos(proyecto, id.uid), { recursive: true, withFileTypes: true })
    .then((items) => items.filter((d) => d.isFile()).map((d) => resolve(d.parentPath ?? d.path, d.name)))
    .catch((e) => { if (e?.code === 'ENOENT') return []; throw e; });
  if (propios.length >= ARCHIVOS_POR_VECINO && !propios.includes(destino)) {
    throw new ErrorHttp(429, 'adjunto-invalido', `Llegaste al máximo de ${ARCHIVOS_POR_VECINO} archivos adjuntos en tus reclamos. `
      + 'Podés enviar el reclamo sin archivos o llamar al 147.');
  }
  await mkdir(resolve(destino, '..'), { recursive: true });
  await writeFile(destino, bytes);
  return { adjunto: { ruta, nombre, tipo, tamano: bytes.length } };
}

async function urlAdjunto(req, proyecto, db) {
  const id = verificarUsuario(req);
  const { ruta } = await leerJson(req);
  if (typeof ruta !== 'string' || !PATRON_RUTA.test(ruta)) throw new ErrorHttp(400, 'validacion', 'La ruta del adjunto no es válida.');
  if (!ruta.startsWith(`${id.uid}/`)) await exigirAdmin(db, id);
  try {
    await stat(carpetaArchivos(proyecto, ruta));
  } catch {
    throw new ErrorHttp(404, 'no-encontrado', 'No encontramos el archivo.');
  }
  const venceEn = Date.now() + 300_000;
  const prefijo = proyecto === PROYECTO_POR_DEFECTO ? '' : `/p/${proyecto}`;
  return { url: `http://${HOST}:${PUERTO}${prefijo}/archivos/${ruta}?vence=${venceEn}`, venceEn };
}

async function servirArchivo(req, res, proyecto, ruta) {
  const vence = Number(new URL(req.url, 'http://x').searchParams.get('vence'));
  if (!PATRON_RUTA.test(ruta) || !(vence > Date.now())) return responder(req, res, 404, { ok: false, error: { codigo: 'no-encontrado', mensaje: 'No encontramos el archivo.' } });
  try {
    const bytes = await readFile(carpetaArchivos(proyecto, ruta));
    const tipo = Object.entries(EXTENSION_ARCHIVO).find(([, ext]) => ruta.endsWith(`.${ext}`))?.[0] ?? 'application/octet-stream';
    res.writeHead(200, { ...encabezadosCors(req), 'Content-Type': tipo, 'Content-Length': bytes.length });
    res.end(bytes);
  } catch {
    responder(req, res, 404, { ok: false, error: { codigo: 'no-encontrado', mensaje: 'No encontramos el archivo.' } });
  }
}

// ---------- despachar y tareas ----------

async function marcarEnviado(ref) {
  await ref.update({ estado: 'enviado', procesadoEn: FieldValue.serverTimestamp(), enviados: 0 });
}

// Lo mismo que supabase/functions/_shared/entrega.ts escribe en Firestore, sin el push: así, con
// emuladores, las alarmas y los avances de reclamos también quedan en el historial de Notificaciones.
function notificacionPersonal({ titulo, cuerpo, tipo, zona = null, destino = null }) {
  return {
    titulo: String(titulo).slice(0, 100),
    cuerpo: String(cuerpo).slice(0, 500),
    tipo,
    zona,
    destino,
    enlace: null,
    creadoEn: FieldValue.serverTimestamp(),
    leida: false,
    leidaEn: null,
    origen: 'servidor',
  };
}

async function crearSiNoExiste(ref, datos) {
  try {
    await ref.create(datos);
  } catch (e) {
    if (e?.code !== 6) throw e; // 6 = ALREADY_EXISTS: idempotente, como soloSiNoExiste
  }
}

async function historialAlarma(db, eventoId, ev) {
  const snap = await db.doc(`${C.alarmas}/${ev.refId}`).get();
  const a = snap.data();
  if (!a || a.activa !== true || (a.activacionId && a.activacionId !== eventoId)) return;
  const destino = `#/alarmas/${ev.refId}`;
  const nombre = String(a.nombre ?? 'comunitaria');
  const titulo = `Alarma activada: ${nombre}`.slice(0, 100);
  const cuerpo = `Se activó la alarma ${nombre}${a.referencia ? ` (${a.referencia})` : ''}. `
    + 'Mantené la calma y seguí las indicaciones de las autoridades.';
  await crearSiNoExiste(db.doc(`${C.avisos}/alarma-${eventoId}`), {
    titulo,
    cuerpo,
    detalle: 'Se activó una alarma comunitaria. Ante una emergencia, llamá al 911.',
    tipo: 'alarmas',
    zona: a.zona ?? 'todas',
    destino,
    enlace: null,
    creadoEn: FieldValue.serverTimestamp(),
    autor: ev.origen === 'simulador' ? 'simulador' : 'municipalidad',
    eventoId,
    vigenteHasta: null,
  });
  const ahora = Date.now();
  const cercanos = await db.collection('usuarios').where('cercania.alarmas', 'array-contains', ev.refId).limit(1000).get();
  const notif = { tipo: 'alarmas', zona: a.zona };
  for (const d of cercanos.docs) {
    const vence = aMs(d.get('cercania.vence')) ?? 0;
    if (vence <= ahora) continue;
    if (decidirEntrega(notif, d.get('preferencias') ?? {}).historial) continue; // ya lo ve por su zona
    await crearSiNoExiste(
      db.doc(`usuarios/${d.id}/${C.notificaciones}/alarma-${eventoId}`),
      notificacionPersonal({ titulo, cuerpo, tipo: 'alarmas', zona: a.zona ?? null, destino }),
    );
  }
}

async function historialReclamo(db, eventoId, ev) {
  if (typeof ev.uid !== 'string' || !ev.uid) return;
  const r = (await db.doc(`usuarios/${ev.uid}/${C.reclamos}/${ev.refId}`).get()).data();
  if (!r) return;
  const estado = String(r.estado ?? '');
  const titulo = `Tu reclamo ${r.codigo ?? ''} pasó a ${ETIQUETAS.estadosReclamo?.[estado] ?? estado}`.replace(/\s+/g, ' ');
  const nota = typeof r.notaMunicipal === 'string' && r.notaMunicipal.trim() ? r.notaMunicipal.trim() : '';
  const cuerpo = nota ? `Nota de la Municipalidad: ${nota}` : 'Podés ver el detalle y la línea de tiempo en Reclamos.';
  await crearSiNoExiste(
    db.doc(`usuarios/${ev.uid}/${C.notificaciones}/reclamo-${eventoId}`),
    notificacionPersonal({ titulo, cuerpo, tipo: 'reclamos', destino: `#/reclamos/${ev.refId}` }),
  );
}

async function procesarEvento(db, ref) {
  const ev = (await ref.get()).data() ?? {};
  try {
    if (ev.tipo === 'alarma') await historialAlarma(db, ref.id, ev);
    else if (ev.tipo === 'reclamo') await historialReclamo(db, ref.id, ev);
  } catch (e) {
    console.warn(`[edge-simulado] No se pudo escribir el historial del evento ${ref.id}:`, e?.message ?? e);
  }
  await marcarEnviado(ref);
}

export async function despachar(db, { eventoId } = {}) {
  if (eventoId !== undefined && eventoId !== null && typeof eventoId !== 'string') {
    throw new ErrorHttp(400, 'validacion', 'El evento no es válido.');
  }
  let refs;
  if (eventoId) {
    const ref = db.doc(`${C.eventos}/${eventoId}`);
    refs = (await ref.get()).exists ? [ref] : [];
  } else {
    const snap = await db.collection(C.eventos).where('estado', 'in', ['pendiente', 'error']).limit(50).get();
    refs = snap.docs.filter((d) => Number(d.get('intentos') ?? 0) < 3).slice(0, 20).map((d) => d.ref);
  }
  for (const ref of refs) await procesarEvento(db, ref);
  return { procesados: refs.length, enviados: 0 };
}

const aMs = (v) => (v instanceof Timestamp ? v.toMillis() : (typeof v === 'number' ? v : null));

function aCliente(datos) {
  const salida = {};
  for (const [k, v] of Object.entries(datos)) salida[k] = v instanceof Timestamp ? v.toMillis() : v;
  return salida;
}

async function tareaDiaria(db, ahora) {
  const snap = await db.collectionGroup(C.tributos).where('pagadoEn', '==', null).get();
  const porUid = new Map();
  for (const d of snap.docs) {
    const uid = d.ref.parent.parent?.id;
    const vence = aMs(d.get('vence'));
    if (!uid || vence === null || vence > ahora + 3 * DIA_MS) continue;
    if (!porUid.has(uid)) porUid.set(uid, []);
    porUid.get(uid).push({ ...aCliente(d.data()), id: d.id });
  }
  let notificaciones = 0;
  for (const [uid, tributos] of porUid) {
    for (const r of recordatoriosTributos(tributos, ahora)) {
      const nueva = await crearSiFalta(db.doc(`${C.usuarios}/${uid}/${C.notificaciones}/${r.id}`), {
        titulo: r.titulo, cuerpo: r.cuerpo, tipo: r.tipo ?? 'tributos', zona: null, destino: r.destino ?? null,
        enlace: null, creadoEn: FieldValue.serverTimestamp(), leida: false, leidaEn: null, origen: 'servidor',
      });
      if (nueva) notificaciones += 1;
    }
  }
  return { notificaciones, push: 0 };
}

async function tareaResumen(db) {
  // Sin dispositivos reales: cuenta destinatarios, no envía push.
  await db.collection(C.usuarios).where('preferencias.frecuencia', '==', 'resumen_diario').get();
  return { notificaciones: 0, push: 0 };
}

async function tareaSimulador(db, ahora) {
  const estaciones = await db.collection(C.estaciones).get();
  const candidatos = async (estado, antesDe) => (await db.collectionGroup(C.reclamos)
    .where('estado', '==', estado).where('actualizadoEn', '<=', Timestamp.fromMillis(antesDe)).limit(3).get()).docs;
  const reclamos = [...await candidatos('recibido', ahora - 2 * MIN_MS), ...await candidatos('en_proceso', ahora - 5 * MIN_MS)];
  const plan = planificarPaso({
    estaciones: estaciones.docs.map((d) => ({ ...aCliente(d.data()), id: d.id })),
    reclamos: reclamos.map((d) => ({ ...aCliente(d.data()), id: d.id, uid: d.ref.parent.parent?.id })),
    ahora,
  });
  const cambios = [];
  for (const e of plan.estaciones ?? []) {
    const doc = estaciones.docs.find((d) => d.id === e.id);
    if (!doc) continue;
    await doc.ref.update({ bicicletas: e.bicicletas, actualizadoEn: FieldValue.serverTimestamp() });
    cambios.push({ tipo: 'bicicletas', id: e.id, antes: doc.get('bicicletas'), despues: e.bicicletas });
  }
  for (const r of plan.reclamos ?? []) {
    const doc = reclamos.find((d) => d.id === r.id && d.ref.parent.parent?.id === r.uid);
    if (!doc) continue;
    const eventoId = `ev-${randomUUID()}`;
    const lote = db.batch();
    lote.update(doc.ref, {
      estado: r.estado, [`cronologia.${r.estado}`]: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(), ultimoEventoId: eventoId,
    });
    lote.set(db.doc(`${C.eventos}/${eventoId}`), {
      tipo: 'reclamo', refId: r.id, uid: r.uid, origen: 'simulador', estado: 'enviado', intentos: 0,
      creadoEn: FieldValue.serverTimestamp(), procesadoEn: FieldValue.serverTimestamp(), enviados: 0,
    });
    await lote.commit();
    cambios.push({ tipo: 'reclamo', id: r.id, uid: r.uid, antes: doc.get('estado'), despues: r.estado });
  }
  await db.doc(`${C.municipal}/config`).set({ ultimaSimulacion: FieldValue.serverTimestamp() }, { merge: true });
  return { cambios };
}

async function tareas(req, db) {
  const id = verificarUsuario(req);
  const cuerpo = await leerJson(req);
  if (cuerpo.tarea === 'minuto') throw new ErrorHttp(403, 'permiso', 'Esta tarea solo la ejecuta el servidor.');
  await exigirAdmin(db, id);
  const ahora = Date.now();
  if (cuerpo.tarea === 'diaria') return tareaDiaria(db, ahora);
  if (cuerpo.tarea === 'resumen') return tareaResumen(db);
  if (cuerpo.tarea === 'simulador') return tareaSimulador(db, ahora);
  throw new ErrorHttp(400, 'validacion', 'La tarea no es válida.');
}

// ---------- Enrutado ----------

// /p/<proyecto>/functions/v1/<funcion>/<accion> o /functions/v1/<funcion>/<accion>
export function interpretarRuta(pathname) {
  const partes = pathname.split('/').filter(Boolean);
  let proyecto = PROYECTO_POR_DEFECTO;
  if (partes[0] === 'p') {
    if (!PATRON_PROYECTO.test(partes[1] ?? '')) return null;
    proyecto = partes[1];
    partes.splice(0, 2);
  }
  if (partes[0] === 'archivos') return { proyecto, archivo: partes.slice(1).join('/') };
  if (partes[0] !== 'functions' || partes[1] !== 'v1') return null;
  return { proyecto, funcion: partes[2] ?? '', accion: partes[3] ?? '' };
}

async function atender(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, encabezadosCors(req));
    res.end();
    return;
  }
  const ruta = interpretarRuta(new URL(req.url, 'http://x').pathname);
  if (!ruta) throw new ErrorHttp(404, 'no-encontrado', 'No existe esa función.');
  if (ruta.archivo !== undefined) {
    if (req.method !== 'GET') throw new ErrorHttp(400, 'validacion', 'Método no admitido.');
    await servirArchivo(req, res, ruta.proyecto, ruta.archivo);
    return;
  }
  const { proyecto, funcion, accion } = ruta;
  const db = dbDe(proyecto);
  if (funcion === 'tareas' && req.method === 'GET') {
    responder(req, res, 200, { ok: true, version: VERSION, datos: { version: VERSION, proyecto } });
    return;
  }
  if (req.method !== 'POST') throw new ErrorHttp(400, 'validacion', 'Método no admitido.');
  let datos;
  if (funcion === 'vecino' && accion === 'alta') datos = await alta(db, verificarUsuario(req));
  else if (funcion === 'vecino' && accion === 'baja') datos = await baja(db, proyecto, verificarUsuario(req));
  else if (funcion === 'adjuntos' && accion === 'subir') datos = await subir(req, proyecto);
  else if (funcion === 'adjuntos' && accion === 'url') datos = await urlAdjunto(req, proyecto, db);
  else if (funcion === 'despachar') {
    const id = verificarUsuario(req);
    await exigirAdmin(db, id);
    datos = await despachar(db, await leerJson(req));
  } else if (funcion === 'tareas') datos = await tareas(req, db);
  else throw new ErrorHttp(404, 'no-encontrado', 'No existe esa acción.');
  responder(req, res, 200, { ok: true, datos });
}

const servidor = createServer((req, res) => {
  atender(req, res).catch((e) => {
    if (res.headersSent) { res.end(); return; }
    if (e instanceof ErrorHttp) {
      responder(req, res, e.estado, { ok: false, error: { codigo: e.codigo, mensaje: e.message } });
    } else if (e?.name === 'ErrorDominio') {
      responder(req, res, 400, { ok: false, error: { codigo: 'validacion', mensaje: e.message } });
    } else {
      console.error('[edge-simulado] Error no controlado:', e);
      responder(req, res, 500, { ok: false, error: { codigo: 'servidor', mensaje: 'El servicio no respondió. Intentá nuevamente.' } });
    }
  });
});

servidor.on('error', (e) => {
  console.error(`[edge-simulado] No se pudo escuchar en ${HOST}:${PUERTO}: ${e.message}`);
  process.exit(1);
});

// Solo escucha si se ejecuta directo (importarlo desde una prueba no abre el puerto).
const ejecutadoDirecto = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (ejecutadoDirecto) {
  servidor.listen(PUERTO, HOST, () => {
    console.log(`[edge-simulado] Escuchando en http://${HOST}:${PUERTO} (proyecto por defecto ${PROYECTO_POR_DEFECTO}, archivos en ${CARPETA}).`);
  });
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => servidor.close(() => process.exit(0)));
}
