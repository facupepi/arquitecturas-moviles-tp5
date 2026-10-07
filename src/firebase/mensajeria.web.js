// Cloud Messaging en la web (WP4, sección 5.8). Toma de heredado:src/push.js el flujo de permiso,
// isSupported, getToken y deleteToken.
//
// Este módulo SOLO obtiene o borra el token: no toca Firestore (eso lo hace src/datos/sesion.js).
// No usa onMessage ni firebase/messaging/sw: los push los recibe siempre el evento `push` de src/sw.js,
// que muestra la notificación con la app abierta o cerrada. getToken usa el pushManager de la
// registración propia que se le pasa, así que no hace falta firebase-messaging-sw.js.
//
// Sin VITE_FIREBASE_VAPID_KEY (o con emuladores) la mensajería queda desactivada: soportaPush()
// devuelve false, estadoPushLocal() lo explica en `motivo` y obtenerTokenPush() lanza 'no-soportado'.
// La app sigue funcionando: las alertas con la app abierta llegan por onSnapshot y quedan en el historial.
import { app } from './app.js';
import { USAR_EMULADORES, VAPID_KEY } from './config.js';
import { ErrorApp } from '../datos/errores.js';
import { registroListo } from '../plataforma/registroSW';

const CLAVE_TOKEN = 'conecta:token-push';

const MOTIVOS = {
  emuladores: 'Los avisos en el celular no están disponibles en esta demostración. Las novedades te llegan igual con la app abierta y quedan en el historial.',
  sinClave: 'Los avisos en este dispositivo todavía no están configurados. Podés consultar el historial de notificaciones.',
  navegador: 'Este navegador no admite avisos en segundo plano. Podés consultar el historial de notificaciones.',
  ios: 'En iPhone y iPad, los avisos funcionan solo con la app instalada en la pantalla de inicio (Compartir, Agregar a inicio).',
};

let avisoSinClaveMostrado = false;
function avisarSinClave() {
  if (avisoSinClaveMostrado) return;
  avisoSinClaveMostrado = true;
  console.warn('[Mensajería] Falta VITE_FIREBASE_VAPID_KEY: los avisos push quedan desactivados. '
    + 'Generá el par de claves en la consola (Cloud Messaging, Configuración web) y cargalo en .env.local.');
}

const esIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Motivo por el que no hay push en este navegador, o null si en principio se puede. Síncrono. */
function motivoSinSoporte() {
  if (USAR_EMULADORES) return MOTIVOS.emuladores;
  if (!VAPID_KEY) { avisarSinClave(); return MOTIVOS.sinClave; }
  const apis = typeof window !== 'undefined' && 'Notification' in window
    && 'serviceWorker' in navigator && 'PushManager' in window;
  if (!apis) return esIos() ? MOTIVOS.ios : MOTIVOS.navegador;
  return null;
}

let sdkPromesa = null;
const cargarSdk = () => (sdkPromesa ??= import('firebase/messaging'));
let mensajeria = null;

async function obtenerMensajeria() {
  const sdk = await cargarSdk();
  mensajeria ??= sdk.getMessaging(app);
  return { sdk, mensajeria };
}

/** true si este navegador puede recibir push (APIs, IndexedDB, clave VAPID). */
export async function soportaPush() {
  if (motivoSinSoporte()) return false;
  try {
    const sdk = await cargarSdk();
    return await sdk.isSupported();
  } catch {
    return false;
  }
}

function permisoActual() {
  return typeof Notification === 'undefined' ? 'no-soportado' : Notification.permission;
}

/**
 * Pide permiso si hace falta y devuelve el token de FCM de este navegador.
 * Lanza ErrorApp('no-soportado'), ErrorApp('permiso') o ErrorApp('sin-conexion').
 */
export async function obtenerTokenPush() {
  const motivo = motivoSinSoporte();
  if (motivo) throw new ErrorApp('no-soportado', motivo);

  // El permiso se pide antes de cualquier otra espera: Safari exige que requestPermission ocurra
  // dentro del gesto del usuario (el toque en el interruptor).
  if (Notification.permission === 'denied') {
    throw new ErrorApp('permiso', 'Las notificaciones están bloqueadas para este sitio. Habilitalas desde la configuración del navegador.');
  }
  if (Notification.permission !== 'granted') {
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      throw new ErrorApp('permiso', 'No se habilitaron las notificaciones. Podés consultar el historial cuando quieras.');
    }
  }

  if (!(await soportaPush())) throw new ErrorApp('no-soportado', esIos() ? MOTIVOS.ios : MOTIVOS.navegador);
  const registro = await registroListo();
  try {
    const { sdk, mensajeria: m } = await obtenerMensajeria();
    const token = await sdk.getToken(m, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registro });
    if (!token) throw new Error('getToken no devolvió un token');
    return token;
  } catch (e) {
    throw errorDeMensajeria(e);
  }
}

function errorDeMensajeria(e) {
  if (e instanceof ErrorApp) return e;
  const codigo = e?.code || '';
  if (codigo === 'messaging/permission-blocked' || codigo === 'messaging/permission-default') {
    return new ErrorApp('permiso', 'No se habilitaron las notificaciones. Podés consultar el historial cuando quieras.', { causa: e });
  }
  if (codigo === 'messaging/unsupported-browser' || codigo === 'messaging/failed-service-worker-registration') {
    return new ErrorApp('no-soportado', MOTIVOS.navegador, { causa: e });
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return new ErrorApp('sin-conexion', undefined, { causa: e });
  return new ErrorApp('desconocido', 'No pudimos activar los avisos en este dispositivo. Intentá de nuevo en unos minutos.', { causa: e });
}

/**
 * Borra el token de FCM de este navegador y cancela la suscripción push.
 * Devuelve el token que estaba guardado (para que sesion.js borre su dispositivo), o null.
 * No borra la copia local: eso lo hace sesion.js con guardarTokenLocal(null).
 */
export async function borrarTokenPush() {
  const token = leerTokenLocal();
  if (motivoSinSoporte()) return token;
  let registro = null;
  try {
    registro = await registroListo();
  } catch {
    return token;
  }
  try {
    if (permisoActual() === 'granted' && (await soportaPush())) {
      // deleteToken necesita conocer la registración: sin ella el SDK intentaría registrar
      // firebase-messaging-sw.js. getToken con la registración propia la fija (y devuelve el token
      // existente, sin crear otro, si la suscripción sigue siendo válida).
      const { sdk, mensajeria: m } = await obtenerMensajeria();
      await sdk.getToken(m, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registro });
      await sdk.deleteToken(m);
      return token;
    }
  } catch (e) {
    console.warn('[Mensajería] No se pudo borrar el token en FCM:', e?.code || e);
  }
  // Sin permiso (o si falló lo anterior): al menos se cancela la suscripción del navegador.
  // El servidor descarta el token la próxima vez que FCM lo rechace.
  try {
    const suscripcion = await registro.pushManager.getSubscription();
    if (suscripcion) await suscripcion.unsubscribe();
  } catch (e) {
    console.warn('[Mensajería] No se pudo cancelar la suscripción push:', e?.message || e);
  }
  return token;
}

function leerTokenLocal() {
  try {
    return localStorage.getItem(CLAVE_TOKEN) || null;
  } catch {
    return null;
  }
}

/**
 * Estado del push en ESTE navegador (no en la cuenta). Síncrono.
 * { soportado, permiso: 'default' | 'granted' | 'denied' | 'no-soportado', activo, token, motivo }
 * activo = permiso 'granted' y hay token guardado en este navegador. motivo explica por qué no hay
 * soporte (o null).
 */
export function estadoPushLocal() {
  const motivo = motivoSinSoporte();
  const permiso = permisoActual();
  const token = leerTokenLocal();
  const soportado = !motivo;
  return { soportado, permiso, activo: soportado && permiso === 'granted' && !!token, token, motivo };
}

/** Guarda (o borra, con null) el token en localStorage 'conecta:token-push'. */
export function guardarTokenLocal(token) {
  try {
    if (token) localStorage.setItem(CLAVE_TOKEN, token);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Sin localStorage (modo privado estricto): el interruptor se verá apagado al recargar.
  }
}
