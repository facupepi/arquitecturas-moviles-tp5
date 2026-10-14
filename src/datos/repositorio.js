// Repositorio de datos (WP3, secciones 4.3 y 4.4). Único módulo fuera de src/firebase que
// importa firebase/firestore. Las suscripciones devuelven la función para cancelar; los
// comandos validan primero con shared/dominio.mjs y después tocan la red.
import {
  collection, collectionGroup, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query,
  runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, deleteDoc, writeBatch,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../firebase/firestore';
import { auth } from '../firebase/auth';
import { llamarFuncion } from '../supabase/funciones';
import { estaEnLinea } from '../plataforma/red';
import { ErrorApp, desdeFirebase } from './errores';
import {
  alarmaDesdeDoc, avisoDesdeDoc, configDesdeDoc, contactoDesdeDoc, estacionDesdeDoc, eventoDesdeDoc,
  infoDesdeDoc, metaDe, notificacionDesdeDoc, pagoDesdeDoc, perfilDesdeDoc, reclamoDeGrupoDesdeDoc,
  reclamoDesdeDoc, sesionDesdeDoc, tarjetaDesdeDoc, tributoDesdeDoc, zonaDesdeDoc,
} from './mapeadores';
import {
  codigoReclamo, comprobante, costoEstacionamiento, enHorario, minutosValidos,
  normalizarPatente, pagoConTarjeta, siguienteEstadoReclamo, validarPreferencias, validarReclamo,
} from '../../shared/dominio.mjs';
import {
  COLECCIONES as C, LIMITES, PREFERENCIAS_POR_DEFECTO, TIPOS_AVISO, ZONAS,
} from '../../shared/constantes.mjs';
import { dinero, textoMedioPago } from '../../shared/formato.mjs';
import { ETAPAS_TRIBUTO, idRecordatorioTributo } from '../../shared/recordatorios.mjs';

const MIN = 60_000;
const ESPERA_COMMIT_MS = 2500;
const PROVEEDOR_PAGO = 'pasarela-simulada';

// ===================== Utilidades =====================

function uidActual() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new ErrorApp('sin-sesion');
  return uid;
}

// Corre una validación de shared/dominio.mjs y convierte ErrorDominio en ErrorApp('validacion').
function validar(fn) {
  try {
    return fn();
  } catch (e) {
    throw desdeFirebase(e);
  }
}

// "Tarjeta de crédito Visa" → "tarjeta de crédito Visa" (para usarlo en medio de una oración).
const conMinuscula = (texto) => (texto ? texto.charAt(0).toLowerCase() + texto.slice(1) : '');

function errorCampo(campo, mensaje) {
  return new ErrorApp('validacion', mensaje, { campo });
}

function validarIdSolicitud(requestId) {
  if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(requestId)) {
    throw new ErrorApp('validacion', 'Falta el identificador de la operación. Volvé a abrir el diálogo.', { campo: 'requestId' });
  }
}

// Tarjeta guardada elegida en la pasarela → lo que registra el pago: { medio, tarjeta: { red, ultimos4 } }.
// El número completo nunca llega acá (no se guarda en ningún lado).
function medioDePago(tarjeta) {
  return validar(() => pagoConTarjeta(tarjeta));
}

// Lo que muestra el comprobante del pago registrado en pagos/{requestId}: { medio, tarjeta, importe,
// creadoEn }, o null si no está. En un reintento ya confirmado sale de ahí y no de la tarjeta elegida
// ahora: el vecino pudo haber elegido otra antes de reintentar, pero se pagó con la primera.
function pagoRegistrado(snap) {
  const p = pagoDesdeDoc(snap);
  return p ? { medio: p.medio, tarjeta: p.tarjeta, importe: p.importe, creadoEn: p.creadoEn } : null;
}

function exigirConexion(mensaje) {
  if (!estaEnLinea()) throw new ErrorApp('sin-conexion', mensaje);
}

const refUsuario = (uid) => doc(db, C.usuarios, uid);
const refDe = (uid, coleccion, id) => doc(db, C.usuarios, uid, coleccion, id);
const coleccionDe = (uid, coleccion) => collection(db, C.usuarios, uid, coleccion);

// Escritura que no debe dejar la interfaz esperando sin red: con red se espera la
// confirmación; sin red (o si tarda más de 2,5 s) se devuelve enseguida y la escritura
// queda en la cola persistente del SDK. Devuelve true si el servidor ya confirmó.
async function escribirSinBloquear(promesa, descripcion) {
  const registrarFalla = (e) => console.warn(`No se pudo ${descripcion}:`, desdeFirebase(e).message);
  if (!estaEnLinea()) {
    promesa.catch(registrarFalla);
    return false;
  }
  let temporizador;
  const espera = new Promise((resolver) => { temporizador = setTimeout(() => resolver('espera'), ESPERA_COMMIT_MS); });
  try {
    const resultado = await Promise.race([promesa.then(() => 'listo'), espera]);
    if (resultado === 'espera') promesa.catch(registrarFalla);
    return resultado === 'listo';
  } finally {
    clearTimeout(temporizador);
  }
}

async function conErrores(fn, traducir) {
  try {
    return await fn();
  } catch (e) {
    const error = desdeFirebase(e);
    throw traducir ? traducir(error) : error;
  }
}

function listaConId(x) {
  if (Array.isArray(x)) return x;
  if (x && typeof x === 'object') return Object.entries(x).map(([id, v]) => ({ id, ...v }));
  return [];
}

// ===================== Suscripciones (4.3) =====================

function escucharColeccion(consulta, mapear, alCambiar, alFallar, { metadatos = false } = {}) {
  return onSnapshot(
    consulta,
    { includeMetadataChanges: metadatos },
    (snap) => alCambiar(snap.docs.map((d) => mapear(d)).filter(Boolean), metaDe(snap)),
    (e) => alFallar?.(desdeFirebase(e)),
  );
}

function escucharDoc(ref, mapear, alCambiar, alFallar, { metadatos = false } = {}) {
  return onSnapshot(
    ref,
    { includeMetadataChanges: metadatos },
    (snap) => alCambiar(snap.exists() ? mapear(snap) : null, metaDe(snap)),
    (e) => alFallar?.(desdeFirebase(e)),
  );
}

export function suscribirMunicipal(alCambiar, alFallar) {
  let info;
  let config;
  let recibidos = 0;
  let ultimaMeta = { desdeCache: false, pendientes: false };
  const emitir = () => { if (recibidos === 2) alCambiar({ info, config }, ultimaMeta); };
  const marcas = { info: false, config: false };
  const cancelarInfo = escucharDoc(doc(db, C.municipal, 'info'), infoDesdeDoc, (valor, meta) => {
    info = valor; ultimaMeta = meta;
    if (!marcas.info) { marcas.info = true; recibidos += 1; }
    emitir();
  }, alFallar);
  const cancelarConfig = escucharDoc(doc(db, C.municipal, 'config'), configDesdeDoc, (valor, meta) => {
    config = valor; ultimaMeta = meta;
    if (!marcas.config) { marcas.config = true; recibidos += 1; }
    emitir();
  }, alFallar);
  return () => { cancelarInfo(); cancelarConfig(); };
}

export function suscribirEstaciones(alCambiar, alFallar) {
  return escucharColeccion(collection(db, C.estaciones), estacionDesdeDoc, (items, meta) => {
    alCambiar([...items].sort((a, b) => String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), 'es')), meta);
  }, alFallar);
}

export function suscribirAlarmas(alCambiar, alFallar) {
  return escucharColeccion(collection(db, C.alarmas), alarmaDesdeDoc, (items, meta) => {
    alCambiar([...items].sort((a, b) => a.id.localeCompare(b.id, 'es', { numeric: true })), meta);
  }, alFallar);
}

export function suscribirZonasEstacionamiento(alCambiar, alFallar) {
  return escucharColeccion(collection(db, C.zonas), zonaDesdeDoc, (items, meta) => {
    alCambiar([...items].sort((a, b) => a.id.localeCompare(b.id, 'es', { numeric: true })), meta);
  }, alFallar);
}

export function suscribirContactos(alCambiar, alFallar) {
  return escucharColeccion(collection(db, C.contactos), contactoDesdeDoc, (items, meta) => {
    alCambiar([...items].sort((a, b) => a.orden - b.orden), meta);
  }, alFallar);
}

export function suscribirAvisos(limite = 50, alCambiar, alFallar) {
  if (typeof limite === 'function') return suscribirAvisos(50, limite, alCambiar);
  return escucharColeccion(query(collection(db, C.avisos), orderBy('creadoEn', 'desc'), limit(limite)), avisoDesdeDoc, alCambiar, alFallar);
}

export function suscribirPerfil(uid, alCambiar, alFallar) {
  return escucharDoc(refUsuario(uid), perfilDesdeDoc, alCambiar, alFallar, { metadatos: true });
}

export function suscribirEsAdmin(uid, alCambiar, alFallar) {
  return onSnapshot(
    doc(db, C.administradores, uid),
    (snap) => alCambiar(snap.exists(), metaDe(snap)),
    (e) => alFallar?.(desdeFirebase(e)),
  );
}

export function suscribirTributos(uid, alCambiar, alFallar) {
  return escucharColeccion(query(coleccionDe(uid, C.tributos), orderBy('vence', 'asc')), tributoDesdeDoc, alCambiar, alFallar, { metadatos: true });
}

export function suscribirPagos(uid, limite = 20, alCambiar, alFallar) {
  if (typeof limite === 'function') return suscribirPagos(uid, 20, limite, alCambiar);
  return escucharColeccion(query(coleccionDe(uid, C.pagos), orderBy('creadoEn', 'desc'), limit(limite)), pagoDesdeDoc, alCambiar, alFallar, { metadatos: true });
}

export function suscribirReclamos(uid, limite = 20, alCambiar, alFallar) {
  if (typeof limite === 'function') return suscribirReclamos(uid, 20, limite, alCambiar);
  return escucharColeccion(query(coleccionDe(uid, C.reclamos), orderBy('creadoEn', 'desc'), limit(limite)), reclamoDesdeDoc, alCambiar, alFallar, { metadatos: true });
}

export function suscribirEstacionamiento(uid, limite = 20, alCambiar, alFallar) {
  if (typeof limite === 'function') return suscribirEstacionamiento(uid, 20, limite, alCambiar);
  return escucharColeccion(query(coleccionDe(uid, C.estacionamiento), orderBy('inicio', 'desc'), limit(limite)), sesionDesdeDoc, alCambiar, alFallar, { metadatos: true });
}

export function suscribirNotificaciones(uid, limite = 50, alCambiar, alFallar) {
  if (typeof limite === 'function') return suscribirNotificaciones(uid, 50, limite, alCambiar);
  return escucharColeccion(query(coleccionDe(uid, C.notificaciones), orderBy('creadoEn', 'desc'), limit(limite)), notificacionDesdeDoc, alCambiar, alFallar, { metadatos: true });
}

export function suscribirAvisosLeidos(uid, alCambiar, alFallar) {
  return onSnapshot(
    query(coleccionDe(uid, C.avisosLeidos), limit(300)),
    { includeMetadataChanges: true },
    (snap) => alCambiar(new Set(snap.docs.map((d) => d.id)), metaDe(snap)),
    (e) => alFallar?.(desdeFirebase(e)),
  );
}

export function suscribirReclamosAdmin(limite = 50, alCambiar, alFallar) {
  if (typeof limite === 'function') return suscribirReclamosAdmin(50, limite, alCambiar);
  return escucharColeccion(query(collectionGroup(db, C.reclamos), orderBy('creadoEn', 'desc'), limit(limite)), reclamoDeGrupoDesdeDoc, alCambiar, alFallar);
}

export function suscribirEventos(limite = 20, alCambiar, alFallar) {
  if (typeof limite === 'function') return suscribirEventos(20, limite, alCambiar);
  return escucharColeccion(query(collection(db, C.eventos), orderBy('creadoEn', 'desc'), limit(limite)), eventoDesdeDoc, alCambiar, alFallar);
}

// ===================== Alta del vecino =====================

// Promesas memorizadas por uid (C8): los comandos del perfil esperan altaLista(uid).
const altas = new Map();          // uid → { promesa, fallo }
const ultimaAlta = new Map();     // uid → promesa
const REINTENTO_ALTA_MS = 60_000;

export function altaLista(uid) {
  return ultimaAlta.get(uid) ?? Promise.resolve({ creado: false });
}

// Para cuando se borra la cuenta o se sale: la próxima sesión vuelve a evaluar el alta.
export function olvidarAlta(uid) {
  altas.delete(uid);
  ultimaAlta.delete(uid);
}

function perfilPorDefecto(usuario) {
  return {
    nombre: String(usuario.nombre ?? '').slice(0, 80),
    anonimo: false,               // campo del perfil (reglas y vecino/alta); ya no hay invitados
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
    preferencias: { ...PREFERENCIAS_POR_DEFECTO, tipos: [...PREFERENCIAS_POR_DEFECTO.tipos], zonas: [...PREFERENCIAS_POR_DEFECTO.zonas] },
    cercania: null,
    privacidadAceptadaEn: null,
  };
}

/**
 * true si hay que llamar a vecino/alta: falta altaEn, o el perfil quedó marcado como anónimo (lo
 * escribió una versión anterior que tenía invitados) y el alta lo corrige.
 */
export function necesitaAlta(perfil) {
  return !perfil?.altaEn || perfil.anonimo === true;
}

// Llama vecino/alta solo si necesitaAlta(perfil). Si falla y el perfil no existe, lo crea con
// preferencias por defecto. La promesa se resuelve igual.
export function asegurarAlta(usuario, perfil) {
  if (!usuario?.uid) return Promise.resolve({ creado: false });
  const clave = usuario.uid;
  const previa = altas.get(clave);
  if (previa && !(previa.fallo && Date.now() - previa.fallo > REINTENTO_ALTA_MS)) return previa.promesa;

  const hacerAlta = necesitaAlta(perfil);
  const entrada = { promesa: null, fallo: 0 };
  entrada.promesa = (async () => {
    if (!hacerAlta) return { creado: false };
    try {
      const datos = await llamarFuncion('vecino/alta');
      return { creado: Boolean(datos?.creado) };
    } catch (e) {
      entrada.fallo = Date.now();
      console.warn('No se pudo completar el alta del vecino:', desdeFirebase(e).message);
      if (!perfil) {
        try {
          const ref = refUsuario(usuario.uid);
          const existente = await getDoc(ref).catch(() => null);
          if (!existente?.exists()) {
            await escribirSinBloquear(setDoc(ref, perfilPorDefecto(usuario)), 'crear tu perfil');
            return { creado: true };
          }
        } catch (e2) {
          console.warn('No se pudo crear el perfil:', desdeFirebase(e2).message);
        }
      }
      return { creado: false };
    }
  })();
  altas.set(clave, entrada);
  ultimaAlta.set(usuario.uid, entrada.promesa);
  return entrada.promesa;
}

// ===================== Perfil =====================

// Guarda tipos, zonas y frecuencia. preferencias.push no se toca acá: lo manejan
// registrarDispositivo y eliminarDispositivo ("tiene al menos un dispositivo", C5).
export async function guardarPreferencias(preferencias) {
  const uid = uidActual();
  const p = preferencias ?? {};
  const normalizadas = validar(() => validarPreferencias({ ...p, push: Boolean(p.push) }));
  await altaLista(uid);
  await conErrores(() => escribirSinBloquear(
    updateDoc(refUsuario(uid), {
      'preferencias.tipos': normalizadas.tipos,
      'preferencias.zonas': normalizadas.zonas,
      'preferencias.frecuencia': normalizadas.frecuencia,
      actualizadoEn: serverTimestamp(),
    }),
    'guardar tus preferencias',
  ));
}

export async function actualizarCercania(alarmaIds, minutos = LIMITES.cercaniaMin) {
  const uid = uidActual();
  let cercania = null;
  if (alarmaIds != null) {
    if (!Array.isArray(alarmaIds) || alarmaIds.length > 20 || alarmaIds.some((id) => typeof id !== 'string' || !id)) {
      throw errorCampo('cercania', 'La lista de alarmas cercanas no es válida.');
    }
    const duracion = Math.max(1, Math.min(Number(minutos) || LIMITES.cercaniaMin, LIMITES.cercaniaMaxMin));
    cercania = { alarmas: [...new Set(alarmaIds)], vence: Timestamp.fromMillis(Date.now() + duracion * MIN) };
  }
  await altaLista(uid);
  await conErrores(() => escribirSinBloquear(
    updateDoc(refUsuario(uid), { cercania, actualizadoEn: serverTimestamp() }),
    'actualizar la cercanía',
  ));
}

export async function aceptarPrivacidad() {
  const uid = uidActual();
  await altaLista(uid);
  await conErrores(() => escribirSinBloquear(
    updateDoc(refUsuario(uid), { privacidadAceptadaEn: serverTimestamp(), actualizadoEn: serverTimestamp() }),
    'registrar la aceptación de privacidad',
  ));
}

// ===================== Tarjetas guardadas (alta y baja en repositorioTarjetas.js) =====================

// Tarjetas guardadas, de la más vieja a la más nueva (son 5 como máximo).
export function suscribirTarjetas(uid, alCambiar, alFallar) {
  return escucharColeccion(query(coleccionDe(uid, C.tarjetas), limit(LIMITES.tarjetas)), tarjetaDesdeDoc, (items, meta) => {
    alCambiar([...items].sort((a, b) => (a.creadoEn - b.creadoEn) || a.id.localeCompare(b.id)), meta);
  }, alFallar, { metadatos: true });
}

// ===================== Reclamos =====================

export async function crearReclamo({ categoria, direccion, descripcion, estacionId = null, archivos = [] } = {}, requestId, { alProgreso } = {}) {
  const uid = uidActual();
  validarIdSolicitud(requestId);
  const normalizado = validar(() => validarReclamo({ categoria, direccion, descripcion, estacionId }));
  const lista = Array.isArray(archivos) ? archivos : [];
  if (lista.length > LIMITES.adjuntos) throw errorCampo('adjuntos', `Podés adjuntar hasta ${LIMITES.adjuntos} archivos.`);

  const adjuntos = [];
  if (lista.length) {
    exigirConexion('Para enviar archivos necesitás conexión. Podés quitar los adjuntos y enviar el reclamo igual.');
    for (let i = 0; i < lista.length; i += 1) {
      alProgreso?.(i + 1, lista.length);
      const archivo = lista[i];
      const formulario = new FormData();
      formulario.append('reclamoId', requestId);
      formulario.append('indice', String(i));
      formulario.append('archivo', archivo.blob ?? archivo, archivo.nombre ?? `adjunto-${i + 1}`);
      const respuesta = await conErrores(() => llamarFuncion('adjuntos/subir', { formulario, esperaMs: 60_000 }));
      if (!respuesta?.adjunto) throw new ErrorApp('adjunto-invalido');
      adjuntos.push(respuesta.adjunto);
    }
  }

  const codigo = codigoReclamo(requestId);
  const ref = refDe(uid, C.reclamos, requestId);
  const lote = writeBatch(db);
  lote.set(ref, {
    codigo,
    categoria: normalizado.categoria,
    direccion: normalizado.direccion,
    descripcion: normalizado.descripcion,
    estacionId: normalizado.estacionId ?? null,
    adjuntos,
    estado: 'recibido',
    cronologia: { recibido: serverTimestamp() },
    notaMunicipal: null,
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
    ultimoEventoId: null,
  });
  lote.set(refDe(uid, C.notificaciones, `recibido-${requestId}`), {
    titulo: 'Reclamo recibido',
    cuerpo: `Registramos tu reclamo ${codigo}. Te avisamos cuando cambie de estado.`,
    tipo: 'reclamos', zona: null, destino: `#/reclamos/${requestId}`, enlace: null,
    creadoEn: serverTimestamp(), leida: false, leidaEn: null, origen: 'vecino',
  });

  try {
    const confirmado = await escribirSinBloquear(lote.commit(), `enviar el reclamo ${codigo}`);
    return { id: requestId, codigo, enCola: !confirmado };
  } catch (e) {
    const error = desdeFirebase(e);
    if (error.codigo === 'permiso') {
      // Un reintento del mismo requestId: el reclamo ya existe y se devuelve.
      const existente = await getDoc(ref).catch(() => null);
      if (existente?.exists()) return { id: requestId, codigo: existente.get('codigo') ?? codigo, enCola: false };
    }
    throw error;
  }
}

export async function urlAdjunto(uid, ruta) {
  if (typeof ruta !== 'string' || !ruta) throw new ErrorApp('no-encontrado');
  if (uid && !ruta.startsWith(`${uid}/`)) throw new ErrorApp('permiso');
  return conErrores(() => llamarFuncion('adjuntos/url', { cuerpo: { ruta } }));
}

// ===================== Tributos =====================

// `tarjeta`: la tarjeta guardada elegida en la pasarela ({ tipo, red, ultimos4, vence? }).
export async function pagarTributo(tributoId, requestId, tarjeta) {
  const uid = uidActual();
  validarIdSolicitud(requestId);
  const { medio, tarjeta: enmascarada } = medioDePago(tarjeta);
  if (typeof tributoId !== 'string' || !tributoId) throw new ErrorApp('no-encontrado');
  exigirConexion('Para pagar necesitás conexión. Revisá tu red e intentá de nuevo.');
  return conErrores(() => runTransaction(db, async (tx) => {
    const refTributo = refDe(uid, C.tributos, tributoId);
    const refPago = refDe(uid, C.pagos, requestId);
    const snapTributo = await tx.get(refTributo);
    const snapPago = await tx.get(refPago);
    if (snapPago.exists()) return pagoDesdeDoc(snapPago);   // reintento: el pago ya se registró
    if (!snapTributo.exists()) throw new ErrorApp('no-encontrado');
    const tributo = snapTributo.data();
    if (tributo.pagadoEn != null) throw new ErrorApp('ya-pagado');
    // Sus recordatorios ("vence en N días", "vencido") dejan de tener sentido: se marcan leídos en la
    // misma transacción (update permitido: solo leida y leidaEn). Los ids son deterministas.
    const venceMs = tributo.vence?.toMillis?.();
    const refsRecordatorios = Number.isFinite(venceMs)
      ? ETAPAS_TRIBUTO.map((etapa) => refDe(uid, C.notificaciones, idRecordatorioTributo(tributoId, venceMs, etapa)))
      : [];
    const recordatorios = await Promise.all(refsRecordatorios.map((ref) => tx.get(ref)));
    const importe = tributo.importe;
    const codigoComprobante = comprobante('REC', requestId);
    tx.set(refPago, {
      tipo: 'tributo', refId: tributoId, importe, comprobante: codigoComprobante, medio, tarjeta: enmascarada,
      proveedor: PROVEEDOR_PAGO, creadoEn: serverTimestamp(),
    });
    tx.update(refTributo, { pagadoEn: serverTimestamp(), comprobante: codigoComprobante, pagoId: requestId, medio });
    for (const r of recordatorios) {
      if (r.exists() && r.get('leida') !== true) tx.update(r.ref, { leida: true, leidaEn: serverTimestamp() });
    }
    // Se juntan los espacios repetidos sin tocar los duros de dinero() y enmascarada(): "$ 24.750" y
    // "•••• 4242" no se parten entre renglones (\s también incluye el espacio duro).
    tx.set(refDe(uid, C.notificaciones, `pago-${requestId}`), {
      titulo: 'Pago registrado',
      cuerpo: `${tributo.concepto ?? 'Tributo'} ${tributo.periodo ?? ''}: ${dinero(importe)} con ${conMinuscula(textoMedioPago(medio, enmascarada))}. Comprobante ${codigoComprobante}.`.replace(/[^\S\u00a0]+/g, ' ').slice(0, 500),
      tipo: 'tributos', zona: null, destino: `#/tributos/${tributoId}`, enlace: null,
      creadoEn: serverTimestamp(), leida: false, leidaEn: null, origen: 'vecino',
    });
    return {
      id: requestId, tipo: 'tributo', refId: tributoId, importe, comprobante: codigoComprobante, medio, tarjeta: enmascarada,
      proveedor: PROVEEDOR_PAGO, creadoEn: Date.now(), pendiente: false,
    };
  }));
}

// ===================== Estacionamiento =====================

const MENSAJE_RELOJ = 'No se pudo validar la operación. Revisá que la fecha y la hora de tu teléfono sean correctas.';

function permisoConReloj(error) {
  return error.codigo === 'permiso' ? new ErrorApp('permiso', MENSAJE_RELOJ, { causa: error.causa }) : error;
}

function sesionLocal(id, datos, inicioMs) {
  return {
    id, ...datos, inicio: inicioMs, fin: datos.fin.toMillis(), actualizadoEn: inicioMs, pendiente: false,
  };
}

export async function iniciarEstacionamiento({ zonaId, patente, minutos, tarjeta } = {}, requestId) {
  const uid = uidActual();
  validarIdSolicitud(requestId);
  const { medio, tarjeta: enmascarada } = medioDePago(tarjeta);
  const pat = validar(() => normalizarPatente(patente));
  const min = validar(() => minutosValidos(Number(minutos)));
  if (typeof zonaId !== 'string' || !zonaId) throw errorCampo('zonaId', 'Elegí una zona.');
  exigirConexion('Para estacionar necesitás conexión. Revisá tu red e intentá de nuevo.');

  return conErrores(() => runTransaction(db, async (tx) => {
    const refSesion = refDe(uid, C.estacionamiento, requestId);
    const refBloqueo = doc(db, C.bloqueos, pat);
    const snapSesion = await tx.get(refSesion);
    if (snapSesion.exists()) {   // reintento ya confirmado: el comprobante, con el pago registrado
      return { ...sesionDesdeDoc(snapSesion), pago: pagoRegistrado(await tx.get(refDe(uid, C.pagos, requestId))) };
    }
    const refVecino = refDe(uid, C.bloqueoVecino, 'actual');
    const snapBloqueo = await tx.get(refBloqueo);
    const snapVecino = await tx.get(refVecino);
    const snapZona = await tx.get(doc(db, C.zonas, zonaId));
    const snapConfig = await tx.get(doc(db, C.municipal, 'config'));
    if (!snapZona.exists()) throw new ErrorApp('no-encontrado', 'No encontramos esa zona de estacionamiento.');
    const zona = snapZona.data();
    const config = snapConfig.exists() ? snapConfig.data() : {};
    const ahora = Date.now();
    if (config.horarioEstricto !== false && !enHorario(zona.horario, ahora)) throw new ErrorApp('fuera-de-horario');
    // Una sola sesión vigente por vecino: para sumar tiempo se extiende la que está en curso.
    if (snapVecino.exists() && (snapVecino.get('fin')?.toMillis?.() ?? 0) > ahora) throw new ErrorApp('sesion-en-curso');
    if (snapBloqueo.exists()) {
      const finBloqueo = snapBloqueo.get('fin')?.toMillis?.() ?? 0;
      if (finBloqueo > ahora) throw new ErrorApp('patente-ocupada', undefined, { campo: 'patente', datos: { fin: finBloqueo } });
    }
    const importe = costoEstacionamiento(zona.tarifaHora, min);
    const fin = Timestamp.fromMillis(ahora + min * MIN);
    const datos = {
      patente: pat, zonaId, zonaNombre: zona.nombre, zona: zona.zona, minutos: min, importe,
      inicio: serverTimestamp(), fin, extensiones: 0, ultimoPagoId: requestId,
      avisoPorVencer: false, avisoFinalizado: false, actualizadoEn: serverTimestamp(),
    };
    tx.set(refSesion, datos);
    tx.set(refBloqueo, { sesionId: requestId, fin });
    tx.set(refVecino, { sesionId: requestId, fin });
    tx.set(refDe(uid, C.pagos, requestId), {
      tipo: 'estacionamiento', refId: requestId, importe, comprobante: comprobante('EST', requestId), medio,
      tarjeta: enmascarada, proveedor: PROVEEDOR_PAGO, creadoEn: serverTimestamp(),
    });
    return { ...sesionLocal(requestId, datos, ahora), pago: { medio, tarjeta: enmascarada, importe, creadoEn: ahora } };
  }), permisoConReloj);
}

export async function extenderEstacionamiento(sesionId, minutosExtra, requestId, tarjeta) {
  const uid = uidActual();
  validarIdSolicitud(requestId);
  const { medio, tarjeta: enmascarada } = medioDePago(tarjeta);
  const extra = validar(() => minutosValidos(Number(minutosExtra)));
  if (typeof sesionId !== 'string' || !sesionId) throw new ErrorApp('no-encontrado');
  exigirConexion('Para extender necesitás conexión. Revisá tu red e intentá de nuevo.');

  return conErrores(() => runTransaction(db, async (tx) => {
    const refSesion = refDe(uid, C.estacionamiento, sesionId);
    const refPago = refDe(uid, C.pagos, requestId);
    const snapSesion = await tx.get(refSesion);
    if (!snapSesion.exists()) throw new ErrorApp('no-encontrado');
    const actual = snapSesion.data();
    if (actual.ultimoPagoId === requestId) {   // reintento ya confirmado: el comprobante, con el pago registrado
      return { ...sesionDesdeDoc(snapSesion), pago: pagoRegistrado(await tx.get(refPago)) };
    }
    const finActual = actual.fin;   // Timestamp: se suma exacto, sin pasar por ms
    if (!finActual || finActual.toMillis() <= Date.now()) throw new ErrorApp('sesion-vencida');
    const total = actual.minutos + extra;
    if (total > LIMITES.minutosMax) {
      throw new ErrorApp('maximo-alcanzado', undefined, { campo: 'minutos', datos: { disponibles: LIMITES.minutosMax - actual.minutos } });
    }
    const snapZona = await tx.get(doc(db, C.zonas, actual.zonaId));
    if (!snapZona.exists()) throw new ErrorApp('no-encontrado', 'No encontramos esa zona de estacionamiento.');
    const importeExtra = costoEstacionamiento(snapZona.data().tarifaHora, extra);
    const fin = new Timestamp(finActual.seconds + extra * 60, finActual.nanoseconds);
    const cambios = {
      minutos: total, importe: actual.importe + importeExtra, fin, extensiones: (actual.extensiones ?? 0) + 1,
      ultimoPagoId: requestId, avisoPorVencer: false, actualizadoEn: serverTimestamp(),
    };
    tx.update(refSesion, cambios);
    tx.set(doc(db, C.bloqueos, actual.patente), { sesionId, fin });
    tx.set(refDe(uid, C.bloqueoVecino, 'actual'), { sesionId, fin });
    tx.set(refPago, {
      tipo: 'extension', refId: sesionId, importe: importeExtra, comprobante: comprobante('EXT', requestId), medio,
      tarjeta: enmascarada, proveedor: PROVEEDOR_PAGO, creadoEn: serverTimestamp(),
    });
    const ahora = Date.now();
    return {
      id: sesionId, ...actual, ...cambios, inicio: actual.inicio?.toMillis?.() ?? null, fin: fin.toMillis(),
      actualizadoEn: ahora, pendiente: false, pago: { medio, tarjeta: enmascarada, importe: importeExtra, creadoEn: ahora },
    };
  }), permisoConReloj);
}

export async function finalizarEstacionamiento(sesionId) {
  const uid = uidActual();
  if (typeof sesionId !== 'string' || !sesionId) throw new ErrorApp('no-encontrado');
  exigirConexion('Para terminar la sesión necesitás conexión. Revisá tu red e intentá de nuevo.');
  await conErrores(() => runTransaction(db, async (tx) => {
    const refSesion = refDe(uid, C.estacionamiento, sesionId);
    const snapSesion = await tx.get(refSesion);
    if (!snapSesion.exists()) throw new ErrorApp('no-encontrado');
    const sesion = snapSesion.data();
    if (!sesion.fin || sesion.fin.toMillis() <= Date.now()) throw new ErrorApp('sesion-vencida');
    tx.update(refSesion, { fin: serverTimestamp(), actualizadoEn: serverTimestamp() });
    tx.set(doc(db, C.bloqueos, sesion.patente), { sesionId, fin: serverTimestamp() });
    tx.set(refDe(uid, C.bloqueoVecino, 'actual'), { sesionId, fin: serverTimestamp() });
  }), permisoConReloj);
}

// ===================== Notificaciones =====================

export async function marcarLeida(notificacion) {
  if (!notificacion || notificacion.leida) return;
  const uid = uidActual();
  const escritura = notificacion.fuente === 'aviso'
    ? setDoc(refDe(uid, C.avisosLeidos, notificacion.id), { leidoEn: serverTimestamp() })
    : updateDoc(refDe(uid, C.notificaciones, notificacion.id), { leida: true, leidaEn: serverTimestamp() });
  await conErrores(() => escribirSinBloquear(escritura, 'marcar la notificación como leída'));
}

export async function marcarTodasLeidas(notificaciones = []) {
  const uid = uidActual();
  const pendientes = notificaciones.filter((n) => n && !n.leida);
  const lotes = [];
  for (let i = 0; i < pendientes.length; i += 400) {
    const lote = writeBatch(db);
    for (const n of pendientes.slice(i, i + 400)) {
      if (n.fuente === 'aviso') lote.set(refDe(uid, C.avisosLeidos, n.id), { leidoEn: serverTimestamp() });
      else lote.update(refDe(uid, C.notificaciones, n.id), { leida: true, leidaEn: serverTimestamp() });
    }
    lotes.push(lote.commit());
  }
  if (!lotes.length) return;
  await conErrores(() => escribirSinBloquear(Promise.all(lotes), 'marcar las notificaciones como leídas'));
}

// ===================== Dispositivos (push) =====================

async function idDispositivo(token) {
  const bytes = new TextEncoder().encode(token);
  const resumen = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(resumen), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export async function registrarDispositivo(token, tokenAnterior = null) {
  const uid = uidActual();
  if (typeof token !== 'string' || token.length < 20) throw new ErrorApp('validacion', 'El token de notificaciones no es válido.');
  await altaLista(uid);
  const id = await idDispositivo(token);
  await conErrores(async () => {
    await setDoc(refDe(uid, C.dispositivos, id), {
      token, plataforma: String(Platform.OS || 'web').slice(0, 40), actualizadoEn: serverTimestamp(),
    });
    if (tokenAnterior && tokenAnterior !== token) {
      const anterior = await idDispositivo(tokenAnterior);
      if (anterior !== id) await deleteDoc(refDe(uid, C.dispositivos, anterior));
    }
    await updateDoc(refUsuario(uid), { 'preferencias.push': true, actualizadoEn: serverTimestamp() });
  });
}

export async function eliminarDispositivo(token) {
  const uid = uidActual();
  await altaLista(uid);
  await conErrores(async () => {
    if (typeof token === 'string' && token) await deleteDoc(refDe(uid, C.dispositivos, await idDispositivo(token)));
    const restantes = await getDocs(query(coleccionDe(uid, C.dispositivos), limit(1)));
    if (restantes.empty) {
      await updateDoc(refUsuario(uid), { 'preferencias.push': false, actualizadoEn: serverTimestamp() });
    }
  });
}

// ===================== Supabase =====================

export async function borrarDatosEnServidor() {
  const uid = uidActual();
  await conErrores(() => llamarFuncion('vecino/baja'));
  olvidarAlta(uid);
}

export function despacharEvento(eventoId) {
  return llamarFuncion('despachar', { cuerpo: { eventoId } }).then(
    () => undefined,
    (e) => { console.warn(`No se pudo despachar el evento ${eventoId}; la tarea programada lo reintenta:`, desdeFirebase(e).message); },
  );
}

export async function ejecutarTarea(tarea) {
  if (!['simulador', 'diaria', 'resumen'].includes(tarea)) throw errorCampo('tarea', 'Tarea desconocida.');
  return conErrores(() => llamarFuncion('tareas', { cuerpo: { tarea } }));
}

// ===================== Administración =====================

function nuevoEvento(tipo, refId, uid = null) {
  return { tipo, refId, uid, origen: 'panel', estado: 'pendiente', intentos: 0, creadoEn: serverTimestamp() };
}

export async function avanzarReclamo({ uid, reclamoId, estadoActual, nota = null } = {}, requestId) {
  uidActual();
  validarIdSolicitud(requestId);
  if (!uid || !reclamoId) throw new ErrorApp('no-encontrado');
  const siguiente = siguienteEstadoReclamo(estadoActual);
  if (!siguiente) throw errorCampo('estado', 'El reclamo ya está resuelto.');
  const textoNota = typeof nota === 'string' ? nota.trim() : '';
  if (textoNota.length > 300) throw errorCampo('nota', 'La nota puede tener hasta 300 caracteres.');
  const eventoId = `ev-${requestId}`;
  const cambios = {
    estado: siguiente,
    [`cronologia.${siguiente}`]: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
    ultimoEventoId: eventoId,
  };
  if (textoNota) cambios.notaMunicipal = textoNota;
  const lote = writeBatch(db);
  lote.update(refDe(uid, C.reclamos, reclamoId), cambios);
  lote.set(doc(db, C.eventos, eventoId), nuevoEvento('reclamo', reclamoId, uid));
  await conErrores(() => lote.commit());
  despacharEvento(eventoId);
}

export async function cambiarAlarma({ alarmaId, activa } = {}, requestId) {
  uidActual();
  if (!alarmaId) throw new ErrorApp('no-encontrado');
  const ref = doc(db, C.alarmas, alarmaId);
  if (!activa) {
    await conErrores(() => updateDoc(ref, { activa: false, actualizadoEn: serverTimestamp() }));
    return;
  }
  validarIdSolicitud(requestId);
  const eventoId = `ev-${requestId}`;
  const lote = writeBatch(db);
  lote.update(ref, { activa: true, activadaEn: serverTimestamp(), activacionId: eventoId, actualizadoEn: serverTimestamp() });
  lote.set(doc(db, C.eventos, eventoId), nuevoEvento('alarma', alarmaId));
  await conErrores(() => lote.commit());
  despacharEvento(eventoId);
}

export async function cambiarBicicletas({ estacionId, bicicletas, estado } = {}) {
  uidActual();
  if (!estacionId) throw new ErrorApp('no-encontrado');
  if (!Number.isInteger(bicicletas) || bicicletas < 0) throw errorCampo('bicicletas', 'La cantidad de bicicletas no es válida.');
  if (estado != null && !['operativa', 'fuera_de_servicio'].includes(estado)) throw errorCampo('estado', 'El estado no es válido.');
  await conErrores(() => runTransaction(db, async (tx) => {
    const ref = doc(db, C.estaciones, estacionId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new ErrorApp('no-encontrado');
    const capacidad = snap.get('capacidad');
    if (bicicletas > capacidad) throw errorCampo('bicicletas', `La estación tiene ${capacidad} anclajes.`);
    tx.update(ref, { bicicletas, estado: estado ?? snap.get('estado') ?? 'operativa', actualizadoEn: serverTimestamp() });
  }));
}

function validarAviso({ titulo, cuerpo, detalle = '', tipo, zona, destino = null, enlace = null, vigenteHoras = null }) {
  const t = String(titulo ?? '').trim();
  const c = String(cuerpo ?? '').trim();
  const d = String(detalle ?? '').trim();
  if (t.length < 3 || t.length > 100) throw errorCampo('titulo', 'El título debe tener entre 3 y 100 caracteres.');
  if (c.length < 10 || c.length > 500) throw errorCampo('cuerpo', 'El texto debe tener entre 10 y 500 caracteres.');
  if (d.length > 3000) throw errorCampo('detalle', 'El detalle puede tener hasta 3000 caracteres.');
  if (!TIPOS_AVISO.includes(tipo)) throw errorCampo('tipo', 'Elegí un tipo de aviso.');
  if (!(ZONAS.includes(zona) || zona === 'todas')) throw errorCampo('zona', 'Elegí una zona o toda la ciudad.');
  const dest = destino ? String(destino).trim() : null;
  if (dest && !/^#\/[a-z]+(\/[A-Za-z0-9_-]+)?$/.test(dest)) throw errorCampo('destino', 'El destino interno debe tener la forma #/servicio o #/servicio/id.');
  const enl = enlace ? String(enlace).trim() : null;
  if (enl && !/^https:\/\/.{4,300}$/.test(enl)) throw errorCampo('enlace', 'El enlace debe empezar con https://.');
  let vigenteHasta = null;
  if (vigenteHoras != null && vigenteHoras !== '') {
    const horas = Number(vigenteHoras);
    if (!Number.isFinite(horas) || horas <= 0 || horas > 24 * 30) throw errorCampo('vigenteHoras', 'La vigencia debe ser de 1 hora a 30 días.');
    vigenteHasta = Timestamp.fromMillis(Date.now() + horas * 60 * MIN);
  }
  return { titulo: t, cuerpo: c, detalle: d, tipo, zona, destino: dest, enlace: enl, vigenteHasta };
}

export async function publicarAviso(datos = {}, requestId) {
  uidActual();
  validarIdSolicitud(requestId);
  const aviso = validarAviso(datos);
  const eventoId = `ev-${requestId}`;
  const lote = writeBatch(db);
  lote.set(doc(db, C.avisos, requestId), {
    ...aviso, creadoEn: serverTimestamp(), autor: 'municipalidad', eventoId,
  });
  lote.set(doc(db, C.eventos, eventoId), nuevoEvento('aviso', requestId));
  await conErrores(() => lote.commit());
  despacharEvento(eventoId);
  return { id: requestId };
}

export async function configurarDemo({ simuladorActivo, simuladorCadaMin, horarioEstricto, avisoEstacionamientoMin } = {}) {
  uidActual();
  const cambios = {};
  if (simuladorActivo !== undefined) {
    if (typeof simuladorActivo !== 'boolean') throw errorCampo('simuladorActivo', 'Valor inválido.');
    cambios.simuladorActivo = simuladorActivo;
  }
  if (simuladorCadaMin !== undefined) {
    if (!Number.isInteger(simuladorCadaMin) || simuladorCadaMin < 1 || simuladorCadaMin > 30) {
      throw errorCampo('simuladorCadaMin', 'Elegí entre 1 y 30 minutos.');
    }
    cambios.simuladorCadaMin = simuladorCadaMin;
  }
  if (horarioEstricto !== undefined) {
    if (typeof horarioEstricto !== 'boolean') throw errorCampo('horarioEstricto', 'Valor inválido.');
    cambios.horarioEstricto = horarioEstricto;
  }
  if (avisoEstacionamientoMin !== undefined) {
    if (!Number.isInteger(avisoEstacionamientoMin) || avisoEstacionamientoMin < 1 || avisoEstacionamientoMin > LIMITES.avisoEstacionamientoMinMax) {
      throw errorCampo('avisoEstacionamientoMin', `Elegí entre 1 y ${LIMITES.avisoEstacionamientoMinMax} minutos.`);
    }
    cambios.avisoEstacionamientoMin = avisoEstacionamientoMin;
  }
  if (!Object.keys(cambios).length) return;
  await conErrores(() => updateDoc(doc(db, C.municipal, 'config'), { ...cambios, actualizadoEn: serverTimestamp() }));
}

// Vuelve bicicletas, alarmas y config a los valores de shared/catalogo.mjs con updates
// permitidos por las reglas (un solo lote: las 7 estaciones + las 5 alarmas del catálogo + config).
// El catálogo se importa recién acá para no sumarlo al paquete inicial (solo lo usa el panel).
export async function restablecerDemo() {
  uidActual();
  const { catalogo } = await import('../../shared/catalogo.mjs');
  const base = catalogo(Date.now());
  const lote = writeBatch(db);
  for (const e of listaConId(base.estaciones)) {
    lote.update(doc(db, C.estaciones, e.id), {
      bicicletas: e.bicicletas, estado: e.estado ?? 'operativa', actualizadoEn: serverTimestamp(),
    });
  }
  for (const a of listaConId(base.alarmas)) {
    lote.update(doc(db, C.alarmas, a.id), { activa: false, actualizadoEn: serverTimestamp() });
  }
  const c = base.config ?? {};
  lote.update(doc(db, C.municipal, 'config'), {
    simuladorActivo: c.simuladorActivo ?? false,
    simuladorCadaMin: c.simuladorCadaMin ?? 2,
    horarioEstricto: c.horarioEstricto ?? true,
    avisoEstacionamientoMin: c.avisoEstacionamientoMin ?? LIMITES.avisoEstacionamientoMinPorDefecto,
    actualizadoEn: serverTimestamp(),
  });
  await conErrores(() => lote.commit());
}

// Ayudantes que comparte src/datos/repositorioPanel.js (cargado solo con el panel municipal).
export { coleccionDe, conErrores, errorCampo, escribirSinBloquear, escucharColeccion, exigirConexion, refDe, uidActual, validar };
