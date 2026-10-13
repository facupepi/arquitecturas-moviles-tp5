// Vecinos de ejemplo con actividad cargada: cedulones pagos e impagos, pagos con distintos medios,
// reclamos en cada estado, estacionamientos terminados y uno en curso, y notificaciones. Sirven
// para que el panel municipal muestre movimiento y para las capturas del informe.
//
//   node scripts/vecinos-ejemplo.mjs --emulador            (FIRESTORE_EMULATOR_HOST y FIREBASE_AUTH_EMULATOR_HOST)
//   node scripts/vecinos-ejemplo.mjs --produccion          (GOOGLE_APPLICATION_CREDENTIALS fuera del repositorio)
//   node scripts/vecinos-ejemplo.mjs --produccion --borrar (quita los vecinos de ejemplo y sus datos)
//   node scripts/vecinos-ejemplo.mjs --produccion --cuenta <uid>     (carga los datos de ejemplo en una cuenta real)
//   node scripts/vecinos-ejemplo.mjs --produccion --reiniciar <uid>  (deja una cuenta como recién registrada)
//
// Los uid empiezan con "ejemplo-" y las cuentas no tienen proveedor de ingreso: nadie puede entrar
// con ellas desde la app. Volver a correrlo reescribe los mismos documentos.
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { catalogo, datosInicialesVecino } from '../shared/catalogo.mjs';
import { COLECCIONES as C, PREFERENCIAS_POR_DEFECTO } from '../shared/constantes.mjs';
import { codigoReclamo, comprobante, costoEstacionamiento } from '../shared/dominio.mjs';
import { aFirestore, documentosVecino } from './sembrar.mjs';

const MIN = 60 * 1000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

const argv = process.argv.slice(2);
const args = new Set(argv);
const valor = (bandera) => { const i = argv.indexOf(bandera); return i >= 0 ? argv[i + 1] ?? null : null; };
if (args.has('--emulador') === args.has('--produccion')) {
  console.error('Indicá --emulador o --produccion.');
  process.exit(1);
}
if (args.has('--produccion')) {
  if (process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST está definido: abrí otra consola para producción.');
  const cred = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!cred || !existsSync(cred)) throw new Error('Falta GOOGLE_APPLICATION_CREDENTIALS con la cuenta de servicio.');
  initializeApp({ credential: applicationDefault(), projectId: 'san-francisco-conecta-tp5' });
} else {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8085';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
  process.env.METADATA_SERVER_DETECTION ??= 'none';
  const proyecto = process.env.GCLOUD_PROJECT || 'demo-conecta-tp5';
  if (!proyecto.startsWith('demo-')) throw new Error('Con --emulador el proyecto tiene que ser demo-*.');
  initializeApp({ projectId: proyecto });
}
const db = getFirestore();
const auth = getAuth();

const ahora = Date.now();
const { zonasEstacionamiento } = catalogo(ahora);
const zona = (id) => zonasEstacionamiento.find((z) => z.id === id);

// ---------- Fábricas ----------
function pago(tipo, refId, importe, medio, creadoEn) {
  const id = randomUUID();
  const prefijo = { tributo: 'REC', estacionamiento: 'EST', extension: 'EXT' }[tipo];
  return { id, tipo, refId, importe, comprobante: comprobante(prefijo, id), medio, proveedor: 'pasarela-simulada', creadoEn };
}

function reclamo({ categoria, direccion, descripcion, estado, haceDias, nota = null, estacionId = null }) {
  const id = randomUUID();
  const recibido = ahora - haceDias * DIA;
  const cronologia = { recibido };
  if (estado !== 'recibido') cronologia.en_proceso = recibido + 5 * HORA;
  if (estado === 'resuelto') cronologia.resuelto = recibido + 2 * DIA;
  const actualizadoEn = Math.max(...Object.values(cronologia));
  return {
    id, codigo: codigoReclamo(id), categoria, direccion, descripcion, estacionId, adjuntos: [],
    estado, cronologia, notaMunicipal: nota, creadoEn: recibido, actualizadoEn, ultimoEventoId: null,
  };
}

function sesion({ zonaId, patente, minutos, inicio, medio, finalizadaAntes = 0 }) {
  const z = zona(zonaId);
  const p = pago('estacionamiento', null, costoEstacionamiento(z.tarifaHora, minutos), medio, inicio);
  p.refId = p.id;
  const fin = inicio + minutos * MIN - finalizadaAntes;
  return {
    sesion: {
      id: p.id, patente, zonaId, zonaNombre: z.nombre, zona: z.zona, minutos, importe: p.importe,
      inicio, fin, extensiones: 0, ultimoPagoId: p.id, avisoPorVencer: false, avisoFinalizado: fin < ahora,
      actualizadoEn: fin < ahora ? fin : inicio,
    },
    pago: p,
  };
}

function notificacion(titulo, cuerpo, tipo, destino, haceHoras, leida) {
  return {
    id: randomUUID(), titulo, cuerpo, tipo, zona: null, destino, enlace: null,
    creadoEn: ahora - haceHoras * HORA, leida, leidaEn: leida ? ahora - (haceHoras - 1) * HORA : null, origen: 'servidor',
  };
}

// Paga un cedulón de los datos iniciales: marca el tributo y devuelve el pago.
function pagarTributo(tributos, tributoId, medio, haceDias) {
  const t = tributos.find((x) => x.id === tributoId);
  const p = pago('tributo', tributoId, t.importe, medio, ahora - haceDias * DIA);
  Object.assign(t, { pagadoEn: p.creadoEn, comprobante: p.comprobante, pagoId: p.id, medio });
  return p;
}

// Cedulón ya pago de los datos iniciales (T-1000): pago propio de cada vecino, con su comprobante.
function semilla(medio) {
  const base = datosInicialesVecino(ahora);
  base.tributos.push({ id: 'T-1000', concepto: 'Tasa de servicios municipales', periodo: '09/2026', cuenta: 'Cuenta municipal',
    importe: 18500, vence: ahora - 20 * DIA, pagadoEn: null, comprobante: null, pagoId: null, medio: null });
  base.pagos = [pagarTributo(base.tributos, 'T-1000', medio, 22)];
  return base;
}

// ---------- Vecinos ----------
function vecinos() {
  const lista = [];

  {
    const base = semilla('debito');
    const pagos = [...base.pagos, pagarTributo(base.tributos, 'T-1001', 'credito', 1)];
    const reclamos = [
      reclamo({ categoria: 'bacheo', direccion: 'Bv. 25 de Mayo 1850', descripcion: 'Pozo grande en la calzada, frente al número 1850.',
        estado: 'en_proceso', haceDias: 3, nota: 'La cuadrilla de bacheo pasa esta semana.' }),
      reclamo({ categoria: 'alumbrado', direccion: 'Iturraspe 1200', descripcion: 'Dos luminarias apagadas en la cuadra desde hace una semana.',
        estado: 'resuelto', haceDias: 9, nota: 'Se reemplazaron las lámparas.' }),
    ];
    const s1 = sesion({ zonaId: 'p1', patente: 'AE482KD', minutos: 60, inicio: ahora - 2 * DIA - 4 * HORA, medio: 'billetera' });
    const s2 = sesion({ zonaId: 'p3', patente: 'AE482KD', minutos: 90, inicio: ahora - 5 * DIA - 6 * HORA, medio: 'credito', finalizadaAntes: 20 * MIN });
    lista.push({
      uid: 'ejemplo-lucia', nombre: 'Lucía Fernández', base, pagos: [...pagos, s1.pago, s2.pago], reclamos,
      estacionamiento: [s1.sesion, s2.sesion],
      notificaciones: [
        notificacion(`Tu reclamo ${reclamos[0].codigo} pasó a En proceso`, 'Nota de la Municipalidad: La cuadrilla de bacheo pasa esta semana.', 'reclamos', `#/reclamos/${reclamos[0].id}`, 50, false),
        notificacion(`Tu reclamo ${reclamos[1].codigo} pasó a Resuelto`, 'Nota de la Municipalidad: Se reemplazaron las lámparas.', 'reclamos', `#/reclamos/${reclamos[1].id}`, 170, true),
      ],
      preferencias: { zonas: ['centro', 'parque', 'norte'] },
    });
  }

  {
    const base = semilla('credito');
    const pagos = [...base.pagos, pagarTributo(base.tributos, 'T-1002', 'billetera', 2), pagarTributo(base.tributos, 'T-1001', 'debito', 2)];
    const reclamos = [
      reclamo({ categoria: 'limpieza', direccion: 'Plaza Vélez Sarsfield', descripcion: 'Contenedor desbordado en la esquina de la plaza.',
        estado: 'recibido', haceDias: 0.2 }),
    ];
    // Sesión en curso: termina dentro de 45 minutos y bloquea la patente.
    const activa = sesion({ zonaId: 'p2', patente: 'AC345BD', minutos: 120, inicio: ahora - 75 * MIN, medio: 'debito' });
    const vieja = sesion({ zonaId: 'p1', patente: 'AC345BD', minutos: 30, inicio: ahora - 3 * DIA - 2 * HORA, medio: 'transferencia' });
    lista.push({
      uid: 'ejemplo-martin', nombre: 'Martín Gómez', base, pagos: [...pagos, activa.pago, vieja.pago], reclamos,
      estacionamiento: [activa.sesion, vieja.sesion], bloqueo: { patente: 'AC345BD', sesionId: activa.sesion.id, fin: activa.sesion.fin },
      notificaciones: [],
      preferencias: { zonas: ['centro'] },
    });
  }

  {
    const base = semilla('transferencia');
    const pagos = [...base.pagos, pagarTributo(base.tributos, 'T-0999', 'transferencia', 6)];
    const reclamos = [
      reclamo({ categoria: 'bicicletas', direccion: 'Parque Cincuentenario', descripcion: 'La estación tiene un anclaje roto que no traba la bicicleta.',
        estado: 'resuelto', haceDias: 6, nota: 'Se reparó el anclaje.', estacionId: 'b3' }),
      reclamo({ categoria: 'otros', direccion: 'Belgrano 2100', descripcion: 'Ramas de un árbol tapan el cartel de la parada de colectivo.',
        estado: 'en_proceso', haceDias: 1.5, nota: 'Espacios verdes programó la poda.' }),
    ];
    lista.push({
      uid: 'ejemplo-sofia', nombre: 'Sofía Romero', base, pagos, reclamos, estacionamiento: [],
      notificaciones: [
        notificacion(`Tu reclamo ${reclamos[0].codigo} pasó a Resuelto`, 'Nota de la Municipalidad: Se reparó el anclaje.', 'reclamos', `#/reclamos/${reclamos[0].id}`, 90, true),
      ],
      preferencias: { zonas: ['parque', 'norte'], frecuencia: 'resumen_diario' },
    });
  }

  {
    const base = semilla('billetera');
    const reclamos = [
      reclamo({ categoria: 'alumbrado', direccion: 'Libertador Sur 450', descripcion: 'El semáforo peatonal no enciende la luz verde.',
        estado: 'recibido', haceDias: 0.6 }),
    ];
    const s = sesion({ zonaId: 'p3', patente: 'AB123CD', minutos: 45, inicio: ahora - 1 * DIA - 3 * HORA, medio: 'credito' });
    lista.push({
      uid: 'ejemplo-javier', nombre: 'Javier Ortiz', base, pagos: [...base.pagos, s.pago], reclamos, estacionamiento: [s.sesion],
      notificaciones: [], preferencias: { zonas: ['sur'] },
    });
  }

  return lista;
}

// ---------- Escritura ----------
const sinId = ({ id, ...resto }) => resto;
const DATOS = [C.tributos, C.pagos, C.reclamos, C.estacionamiento, C.notificaciones, C.avisosLeidos];

// Borra los datos de una cuenta (y los bloqueos de patente de sus sesiones), sin tocar el perfil ni
// los dispositivos registrados para las notificaciones.
async function limpiarDatos(uid) {
  const ref = db.doc(`${C.usuarios}/${uid}`);
  const sesiones = new Set((await ref.collection(C.estacionamiento).get()).docs.map((d) => d.id));
  for (const b of (await db.collection(C.bloqueos).get()).docs) {
    if (sesiones.has(b.get('sesionId'))) await b.ref.delete();
  }
  for (const col of DATOS) await db.recursiveDelete(ref.collection(col));
}

async function borrarVecino(uid) {
  await limpiarDatos(uid);
  await db.recursiveDelete(db.doc(`${C.usuarios}/${uid}`));
  try { await auth.deleteUser(uid); } catch { /* no existía */ }
}

// Escribe los datos de ejemplo de v. Con conPerfil, también el perfil (vecinos ficticios); en una
// cuenta real se conserva su perfil y solo se actualizan nombre y preferencias.
async function cargarVecino(v, { conPerfil = true } = {}) {
  const ref = db.doc(`${C.usuarios}/${v.uid}`);
  await limpiarDatos(v.uid);
  const lote = db.batch();
  const alta = ahora - 30 * DIA;
  const preferencias = { ...PREFERENCIAS_POR_DEFECTO, tipos: [...PREFERENCIAS_POR_DEFECTO.tipos], ...v.preferencias };
  if (conPerfil) {
    lote.set(ref, aFirestore({
      nombre: v.nombre, anonimo: false, creadoEn: alta, actualizadoEn: ahora, altaEn: alta, privacidadAceptadaEn: alta, cercania: null, preferencias,
    }));
  } else {
    lote.set(ref, aFirestore({ nombre: v.nombre, preferencias, actualizadoEn: ahora }), { merge: true });
  }
  const escribir = (col, docs) => docs.forEach((d) => lote.set(ref.collection(col).doc(d.id), aFirestore(sinId(d))));
  escribir(C.tributos, v.base.tributos);
  escribir(C.pagos, v.pagos);
  escribir(C.reclamos, v.reclamos);
  escribir(C.estacionamiento, v.estacionamiento);
  escribir(C.notificaciones, [...v.base.notificaciones.map((n) => ({ ...n, creadoEn: alta, leida: true, leidaEn: alta })), ...v.notificaciones]);
  if (v.bloqueo) lote.set(db.doc(`${C.bloqueos}/${v.bloqueo.patente}`), { sesionId: v.bloqueo.sesionId, fin: Timestamp.fromMillis(v.bloqueo.fin) });
  await lote.commit();
}

const lista = vecinos();
const resumen = (v) => `${v.pagos.length} pagos, ${v.reclamos.length} reclamos, ${v.estacionamiento.length} estacionamientos`;
if (valor('--cuenta')) {
  // Los datos de Lucía, en una cuenta real con su propio nombre.
  const usuario = await auth.getUser(valor('--cuenta'));
  const v = { ...lista[0], uid: usuario.uid, nombre: usuario.displayName || 'Vecino' };
  await cargarVecino(v, { conPerfil: false });
  console.log(`${usuario.email}: ${resumen(v)}`);
} else if (valor('--reiniciar')) {
  // Como recién registrada: los mismos documentos que crea vecino/alta, sin tocar el perfil.
  const usuario = await auth.getUser(valor('--reiniciar'));
  await limpiarDatos(usuario.uid);
  const docs = documentosVecino(usuario.uid, { ahora }).slice(1);
  const lote = db.batch();
  for (const [ruta, datos] of docs) lote.set(db.doc(ruta), datos);
  await lote.commit();
  console.log(`${usuario.email}: reiniciada con ${docs.length} documentos (cedulones, recordatorios y bienvenida).`);
} else if (args.has('--borrar')) {
  for (const v of lista) await borrarVecino(v.uid);
  console.log(`Borrados ${lista.length} vecinos de ejemplo.`);
} else {
  for (const v of lista) {
    try { await auth.getUser(v.uid); } catch { await auth.createUser({ uid: v.uid, displayName: v.nombre }); }
    await cargarVecino(v);
    console.log(`${v.uid}: ${resumen(v)}`);
  }
}
