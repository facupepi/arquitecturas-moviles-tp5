// Siembra del catálogo municipal y de un vecino de prueba (WP3, secciones 2.4 y 10.6).
//
//   node scripts/sembrar.mjs --emulador [--e2e] [--forzar] [--vecino <uid>] [--admin <uid>]
//   node scripts/sembrar.mjs --produccion [--forzar]
//
// --emulador    Usa FIRESTORE_EMULATOR_HOST (por defecto 127.0.0.1:8085, o 8086 con --e2e) y el
//               proyecto demo-conecta-tp5. Con --e2e reescribe todo y deja horarioEstricto en false.
// --produccion  Usa firebase-admin con GOOGLE_APPLICATION_CREDENTIALS (un archivo FUERA del
//               repositorio) sobre san-francisco-conecta-tp5. Crea solo lo que falta.
// --forzar      Reescribe los documentos que ya existen (incluido municipal/config).
// --vecino uid  (solo emulador) Carga los datos iniciales de un vecino como lo haría vecino/alta.
// --admin uid   (solo emulador) Crea administradores/{uid}. En producción se hace desde la consola.
//
// El contenido sale de shared/catalogo.mjs: este script no inventa datos.
import { existsSync, readFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { catalogo, datosInicialesVecino } from '../shared/catalogo.mjs';
import { recordatoriosTributos } from '../shared/recordatorios.mjs';
import { COLECCIONES as C, PREFERENCIAS_POR_DEFECTO } from '../shared/constantes.mjs';

export const PROYECTO_DEMO = 'demo-conecta-tp5';
export const PROYECTO_PRODUCCION = 'san-francisco-conecta-tp5';
const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));

// Campos que son fechas (ms en shared/, Timestamp en Firestore). Dentro de cronologia todo es fecha.
const FECHAS = new Set([
  'actualizadoEn', 'activadaEn', 'creadoEn', 'vigenteHasta', 'ultimaSimulacion', 'vence', 'pagadoEn',
  'inicio', 'fin', 'altaEn', 'leidaEn', 'leidoEn', 'procesadoEn', 'alta', 'privacidadAceptadaEn',
]);

export function aFirestore(valor, clave = null, enCronologia = false) {
  if (typeof valor === 'number' && (enCronologia || FECHAS.has(clave))) return Timestamp.fromMillis(valor);
  if (Array.isArray(valor)) return valor.map((v) => aFirestore(v));
  if (valor && typeof valor === 'object' && !(valor instanceof Timestamp)) {
    const salida = {};
    for (const [k, v] of Object.entries(valor)) {
      if (v === undefined) continue;
      salida[k] = aFirestore(v, k, clave === 'cronologia');
    }
    return salida;
  }
  return valor;
}

function listaConId(x) {
  if (Array.isArray(x)) return x;
  if (x && typeof x === 'object') return Object.entries(x).map(([id, v]) => ({ id, ...v }));
  return [];
}

const sinId = ({ id, ...resto }) => resto;

// Documentos del catálogo: [ruta, datos] con fechas en Timestamp.
export function documentosCatalogo({ ahora = Date.now(), e2e = false } = {}) {
  const base = catalogo(ahora);
  const docs = [];
  docs.push([`${C.municipal}/info`, aFirestore({ ...base.info })]);
  docs.push([`${C.municipal}/config`, aFirestore({
    simuladorActivo: false, simuladorCadaMin: 2, horarioEstricto: true, avisoEstacionamientoMin: 5, ultimaSimulacion: null,
    ...base.config,
    ...(e2e ? { horarioEstricto: false } : {}),
    actualizadoEn: base.config?.actualizadoEn ?? ahora,
  })]);
  for (const e of listaConId(base.estaciones)) {
    docs.push([`${C.estaciones}/${e.id}`, aFirestore({ estado: 'operativa', ...sinId(e), actualizadoEn: e.actualizadoEn ?? ahora })]);
  }
  for (const a of listaConId(base.alarmas)) {
    docs.push([`${C.alarmas}/${a.id}`, aFirestore({
      activa: false, activadaEn: null, activacionId: null, ...sinId(a), actualizadoEn: a.actualizadoEn ?? ahora,
    })]);
  }
  for (const z of listaConId(base.zonasEstacionamiento)) docs.push([`${C.zonas}/${z.id}`, aFirestore(sinId(z))]);
  for (const c of listaConId(base.contactos)) docs.push([`${C.contactos}/${c.id}`, aFirestore(sinId(c))]);
  for (const v of listaConId(base.avisos)) {
    docs.push([`${C.avisos}/${v.id}`, aFirestore({
      destino: null, enlace: null, vigenteHasta: null, autor: 'municipalidad', eventoId: `semilla-${v.id}`,
      ...sinId(v), creadoEn: v.creadoEn ?? ahora,
    })]);
  }
  return docs;
}

// Datos de un vecino como los deja vecino/alta (2.4): perfil, tributos, pagos, reclamo,
// bienvenida y los recordatorios inmediatos de T4.
export function documentosVecino(uid, { ahora = Date.now(), nombre = 'Vecino de prueba' } = {}) {
  const base = datosInicialesVecino(ahora);
  const raiz = `${C.usuarios}/${uid}`;
  const docs = [[raiz, aFirestore({
    nombre, anonimo: true, creadoEn: ahora, actualizadoEn: ahora, altaEn: ahora,
    preferencias: base.preferencias ?? PREFERENCIAS_POR_DEFECTO, cercania: null, privacidadAceptadaEn: null,
  })]];
  const tributos = listaConId(base.tributos);
  for (const t of tributos) docs.push([`${raiz}/${C.tributos}/${t.id}`, aFirestore(sinId(t))]);
  for (const p of listaConId(base.pagos)) docs.push([`${raiz}/${C.pagos}/${p.id}`, aFirestore(sinId(p))]);
  for (const r of listaConId(base.reclamos)) docs.push([`${raiz}/${C.reclamos}/${r.id}`, aFirestore(sinId(r))]);
  for (const n of listaConId(base.notificaciones)) docs.push([`${raiz}/${C.notificaciones}/${n.id}`, aFirestore(sinId(n))]);
  for (const r of recordatoriosTributos(tributos, ahora)) {
    docs.push([`${raiz}/${C.notificaciones}/${r.id}`, aFirestore({
      titulo: r.titulo, cuerpo: r.cuerpo, tipo: r.tipo ?? 'tributos', zona: null, destino: r.destino ?? null, enlace: null,
      creadoEn: ahora, leida: false, leidaEn: null, origen: 'servidor',
    })]);
  }
  return docs;
}

// Escribe los documentos. Sin forzar usa create(): lo que ya existe no se toca.
export async function escribir(db, docs, { forzar = false } = {}) {
  const resumen = { escritos: 0, existentes: 0 };
  if (forzar) {
    for (let i = 0; i < docs.length; i += 400) {
      const lote = db.batch();
      for (const [ruta, datos] of docs.slice(i, i + 400)) lote.set(db.doc(ruta), datos);
      await lote.commit();
    }
    resumen.escritos = docs.length;
    return resumen;
  }
  const resultados = await Promise.allSettled(docs.map(([ruta, datos]) => db.doc(ruta).create(datos)));
  resultados.forEach((r, i) => {
    if (r.status === 'fulfilled') resumen.escritos += 1;
    else if (r.reason?.code === 6 || /already exists/i.test(r.reason?.message ?? '')) resumen.existentes += 1;
    else throw new Error(`No se pudo escribir ${docs[i][0]}: ${r.reason?.message ?? r.reason}`);
  });
  return resumen;
}

export async function sembrarCatalogo(db, opciones = {}) {
  return escribir(db, documentosCatalogo(opciones), opciones);
}

export async function sembrarVecino(db, uid, opciones = {}) {
  return escribir(db, documentosVecino(uid, opciones), { forzar: true });
}

// ===================== Línea de comandos =====================

function leerArgumentos(argv) {
  const args = { emulador: false, produccion: false, e2e: false, forzar: false, vecino: null, admin: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--emulador') args.emulador = true;
    else if (a === '--produccion') args.produccion = true;
    else if (a === '--e2e') args.e2e = true;
    else if (a === '--forzar') args.forzar = true;
    else if (a === '--vecino') args.vecino = argv[++i] ?? null;
    else if (a === '--admin') args.admin = argv[++i] ?? null;
    else throw new Error(`Opción desconocida: ${a}`);
  }
  if (args.emulador === args.produccion) throw new Error('Indicá --emulador o --produccion (uno solo).');
  if (args.produccion && (args.vecino || args.admin || args.e2e)) {
    throw new Error('--vecino, --admin y --e2e son solo para el emulador. En producción, los administradores se crean desde la consola.');
  }
  for (const uid of [args.vecino, args.admin]) {
    if (uid !== null && !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error(`uid inválido: ${uid}`);
  }
  return args;
}

function proyectoDeFirebaserc() {
  try {
    return JSON.parse(readFileSync(resolve(RAIZ, '.firebaserc'), 'utf8'))?.projects?.default ?? PROYECTO_PRODUCCION;
  } catch {
    return PROYECTO_PRODUCCION;
  }
}

function prepararEntorno(args) {
  if (args.emulador) {
    if (!process.env.FIRESTORE_EMULATOR_HOST) process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${args.e2e ? 8086 : 8085}`;
    // Sin credenciales, google-auth-library busca el servidor de metadatos de GCE y avisa por consola.
    process.env.METADATA_SERVER_DETECTION ??= 'none';
    const proyecto = process.env.GCLOUD_PROJECT || PROYECTO_DEMO;
    if (!proyecto.startsWith('demo-')) {
      throw new Error(`Con --emulador el proyecto tiene que ser demo-* (llegó "${proyecto}"), para no escribir en producción por error.`);
    }
    return { projectId: proyecto, destino: `emulador ${process.env.FIRESTORE_EMULATOR_HOST} (${proyecto})` };
  }
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST está definido: no se siembra producción con el emulador configurado. Abrí otra consola.');
  }
  const credenciales = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credenciales || !existsSync(credenciales)) {
    throw new Error('Falta GOOGLE_APPLICATION_CREDENTIALS con la ruta a la cuenta de servicio (fuera del repositorio).');
  }
  const rel = relative(RAIZ, resolve(credenciales));
  if (!rel.startsWith('..') && !isAbsolute(rel)) {
    throw new Error('La cuenta de servicio está dentro del repositorio. Movela fuera (por ejemplo a C:\\Users\\<usuario>\\.tp5-secretos\\).');
  }
  const proyecto = proyectoDeFirebaserc();
  return { projectId: proyecto, credential: applicationDefault(), destino: `PRODUCCIÓN (${proyecto})` };
}

async function principal() {
  const args = leerArgumentos(process.argv.slice(2));
  const { destino, ...config } = prepararEntorno(args);
  const app = initializeApp(config, `sembrar-${Date.now()}`);
  const db = getFirestore(app);
  const ahora = Date.now();
  const forzar = args.forzar || args.e2e;
  try {
    console.log(`Sembrando en ${destino}${forzar ? ' (reescribe lo existente)' : ' (solo lo que falta)'}…`);
    const cat = await sembrarCatalogo(db, { ahora, e2e: args.e2e, forzar });
    console.log(`Catálogo: ${cat.escritos} documentos escritos, ${cat.existentes} ya existían.`);
    if (args.vecino) {
      const v = await sembrarVecino(db, args.vecino, { ahora });
      console.log(`Vecino ${args.vecino}: ${v.escritos} documentos.`);
    }
    if (args.admin) {
      await db.doc(`${C.administradores}/${args.admin}`).set({ nombre: 'Administrador de prueba', alta: Timestamp.fromMillis(ahora) });
      console.log(`Administrador ${args.admin} creado (en el emulador).`);
    }
  } finally {
    await deleteApp(app);
  }
}

const ejecutadoDirecto = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (ejecutadoDirecto) {
  principal().catch((e) => {
    console.error(`No se pudo sembrar: ${e.message}`);
    process.exit(1);
  });
}
