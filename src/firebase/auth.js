// Autenticación (WP4, sección 5.2). Toma de heredado:src/firebase.js el popup con respaldo de redirect
// y la tabla de mensajes por código. Solo se ingresa con una cuenta de Google: no hay acceso anónimo.
import { useSyncExternalStore } from 'react';
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  onIdTokenChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  signOut,
} from 'firebase/auth';
import { app } from './app.js';
import { USAR_EMULADORES, PUERTOS } from './config.js';
import { ErrorApp } from '../datos/errores.js';

// Sin popupRedirectResolver: así no se carga el iframe /__/auth/iframe en cada arranque. El
// resolvedor se pasa como tercer argumento solo en las funciones de Google.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
});
auth.languageCode = 'es';

if (USAR_EMULADORES) {
  connectAuthEmulator(auth, 'http://127.0.0.1:' + PUERTOS.auth, { disableWarnings: true });
}

const proveedorGoogle = new GoogleAuthProvider();
proveedorGoogle.setCustomParameters({ prompt: 'select_account' });

const MARCA_REDIRECCION = 'conecta:redireccion';

// ---------------------------------------------------------------------------------------------
// Sesión observable

/** Usuario = { uid, nombre, email, proveedor: 'google.com' } */
function aUsuario(u) {
  if (!u) return null;
  const datosGoogle = u.providerData?.find((p) => p?.providerId === 'google.com') ?? null;
  return {
    uid: u.uid,
    // displayName y email pueden venir solo en los datos del proveedor: se usan como respaldo.
    nombre: u.displayName || datosGoogle?.displayName || null,
    email: u.email || datosGoogle?.email || null,
    proveedor: datosGoogle ? 'google.com' : (u.providerData?.[0]?.providerId || 'desconocido'),
  };
}

const iguales = (a, b) => a === b || (!!a && !!b && a.uid === b.uid && a.nombre === b.nombre
  && a.email === b.email && a.proveedor === b.proveedor);

let estadoSesion = { usuario: null, listo: false };
const oyentesSesion = new Set();
let huboSesionGuardada = null; // si al arrancar ya había una sesión persistida (visita repetida)

function publicarSesion(u) {
  const usuario = aUsuario(u);
  if (estadoSesion.listo && iguales(estadoSesion.usuario, usuario)) return;
  estadoSesion = { usuario, listo: true };
  for (const oyente of oyentesSesion) oyente();
}

// onIdTokenChanged (no onAuthStateChanged): también avisa si cambian el nombre o el correo con el
// token. La comparación de campos evita dibujar de nuevo con cada renovación.
// Una sesión anónima guardada por una versión anterior (que tenía ingreso como invitado) ya no se
// admite: se cierra y la app muestra el ingreso con Google. Las reglas y Supabase también la rechazan.
onIdTokenChanged(auth, (u) => {
  const usuario = u?.isAnonymous ? null : u;
  if (u?.isAnonymous) signOut(auth).catch(() => {});
  if (huboSesionGuardada === null) huboSesionGuardada = !!usuario;
  publicarSesion(usuario);
});

const suscribirSesion = (oyente) => {
  oyentesSesion.add(oyente);
  return () => oyentesSesion.delete(oyente);
};
const leerSesion = () => estadoSesion;

/** Hook: { usuario: Usuario | null, listo: boolean }. listo = Auth ya restauró (o no) la sesión. */
export function useSesion() {
  return useSyncExternalStore(suscribirSesion, leerSesion, leerSesion);
}

/** Lo mismo que useSesion, fuera de React. */
export function sesionActual() {
  return estadoSesion;
}

/** true si al arrancar la app ya había una sesión guardada (atributo de la traza inicio_con_datos). */
export function habiaSesionAlIniciar() {
  return huboSesionGuardada === true;
}

// ---------------------------------------------------------------------------------------------
// Ayudantes de redirección

function esPwaIos() {
  try {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const instalada = navigator.standalone === true
      || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);
    return ios && instalada;
  } catch {
    return false;
  }
}

function marcarRedireccion(tipo) {
  try { sessionStorage.setItem(MARCA_REDIRECCION, tipo); } catch { /* sin sessionStorage: igual se intenta */ }
}
function leerMarca() {
  try { return sessionStorage.getItem(MARCA_REDIRECCION); } catch { return null; }
}
function borrarMarca() {
  try { sessionStorage.removeItem(MARCA_REDIRECCION); } catch { /* nada que borrar */ }
}

const POPUP_BLOQUEADO = new Set(['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment']);

// ---------------------------------------------------------------------------------------------
// Mensajes y errores

const MENSAJES_AUTH = {
  'auth/popup-closed-by-user': 'Cerraste la ventana de Google. Podés volver a ingresar.',
  'auth/cancelled-popup-request': 'Ya hay una ventana de ingreso abierta.',
  'auth/popup-blocked': 'El navegador bloqueó la ventana de Google.',
  'auth/unauthorized-domain': 'El ingreso con Google no está disponible en esta dirección. Contactá a atención ciudadana.',
  'auth/operation-not-allowed': 'Este modo de ingreso no está disponible en este momento. Intentá más tarde.',
  'auth/network-request-failed': 'No se pudo conectar con el servicio de ingreso. Revisá tu conexión.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada. Contactá a atención ciudadana.',
  'auth/too-many-requests': 'Hubo demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.',
  'auth/quota-exceeded': 'El servicio de ingreso está saturado. Probá en unos minutos.',
  'auth/requires-recent-login': 'Por seguridad, volvé a ingresar y repetí la operación.',
  'auth/user-token-expired': 'Tu sesión venció. Volvé a ingresar.',
  'auth/web-storage-unsupported': 'Tu navegador bloquea el almacenamiento que necesita el ingreso. Revisá las cookies o salí del modo privado.',
  'auth/operation-not-supported-in-this-environment': 'Este navegador no permite ingresar con Google desde acá.',
  'auth/internal-error': 'El servicio de ingreso no respondió. Intentá nuevamente.',
  'auth/firebase-app-check-token-is-invalid': 'No pudimos verificar la aplicación. Recargá la página.',
};
const MENSAJE_AUTH_POR_DEFECTO = 'No se pudo iniciar sesión. Intentá nuevamente.';

const CODIGO_APP = {
  'auth/network-request-failed': 'sin-conexion',
  'auth/too-many-requests': 'cuota',
  'auth/quota-exceeded': 'cuota',
  'auth/popup-blocked': 'popup-bloqueado',
  'auth/web-storage-unsupported': 'no-soportado',
  'auth/operation-not-supported-in-this-environment': 'no-soportado',
  'auth/user-token-expired': 'sin-sesion',
  'auth/requires-recent-login': 'sin-sesion',
  'auth/firebase-app-check-token-is-invalid': 'app-check',
};

/**
 * Mensaje en castellano para cualquier error de ingreso: un error de Firebase Auth (por su code),
 * un ErrorApp lanzado por este módulo (usa su mensaje) o cualquier otro (mensaje genérico).
 * Nunca devuelve códigos crudos.
 */
export function mensajeDeError(e) {
  const codigoAuth = e?.code || e?.causa?.code;
  if (codigoAuth && MENSAJES_AUTH[codigoAuth]) return MENSAJES_AUTH[codigoAuth];
  if (e instanceof ErrorApp && e.message) return e.message;
  return MENSAJE_AUTH_POR_DEFECTO;
}

function aErrorApp(e, datos = null) {
  if (e instanceof ErrorApp) return e;
  const codigo = CODIGO_APP[e?.code] || 'desconocido';
  return new ErrorApp(codigo, mensajeDeError(e), { datos, causa: e });
}

// ---------------------------------------------------------------------------------------------
// Ingreso y salida

/**
 * Popup de Google. Con el popup bloqueado, o dentro de la PWA instalada de iOS (donde el popup no
 * vuelve a la app), sigue por redirect: la página se va y completarRedireccion() termina el ingreso.
 */
export async function ingresarConGoogle() {
  try {
    if (esPwaIos()) return await redirigir(() => signInWithRedirect(auth, proveedorGoogle, browserPopupRedirectResolver));
    try {
      const credencial = await signInWithPopup(auth, proveedorGoogle, browserPopupRedirectResolver);
      return credencial.user;
    } catch (e) {
      if (!POPUP_BLOQUEADO.has(e?.code)) throw e;
      return await redirigir(() => signInWithRedirect(auth, proveedorGoogle, browserPopupRedirectResolver));
    }
  } catch (e) {
    throw aErrorApp(e);
  }
}

async function redirigir(iniciar) {
  marcarRedireccion('ingreso');
  try {
    await iniciar(); // la página navega a Google; esta promesa no se resuelve en la práctica
    return null;
  } catch (e) {
    borrarMarca();
    if (POPUP_BLOQUEADO.has(e?.code)) throw new ErrorApp('popup-bloqueado', undefined, { causa: e });
    throw e;
  }
}

/**
 * Termina un ingreso por redirect. Solo trabaja si existe la marca de sessionStorage, así no carga
 * el iframe de Auth en cada arranque. Devuelve { tipo: 'ingreso' | null, error? }; no lanza, para
 * no romper el arranque de App.jsx.
 */
export async function completarRedireccion() {
  const marca = leerMarca();
  if (!marca) return { tipo: null };
  borrarMarca();
  try {
    const resultado = await getRedirectResult(auth, browserPopupRedirectResolver);
    return { tipo: resultado ? 'ingreso' : null };
  } catch (e) {
    console.warn('[Auth] No se pudo completar la redirección:', e?.code || e);
    return { tipo: 'ingreso', error: aErrorApp(e) };
  }
}

/** Cierra la sesión de Firebase. La orquestación (push, borrado) está en src/datos/sesion.js. */
export async function cerrarSesionFirebase() {
  borrarMarca();
  try {
    await signOut(auth);
  } catch (e) {
    throw aErrorApp(e);
  }
}

/** ID token del usuario actual (Authorization de Supabase), o null si no hay sesión. */
export async function obtenerTokenId(forzar = false) {
  await auth.authStateReady();
  const usuario = auth.currentUser;
  if (!usuario) return null;
  try {
    return await usuario.getIdToken(forzar);
  } catch (e) {
    throw aErrorApp(e);
  }
}

// ---------------------------------------------------------------------------------------------
// Solo pruebas extremo a extremo (vite --mode e2e). La condición usa import.meta.env.MODE directo
// para que en el build de producción quede `if (false)` y el bloque desaparezca.
if (import.meta.env.MODE === 'e2e') {
  globalThis.__conectaE2E = {
    /** Usuario Google del emulador de Auth (acepta un token sin firma). Devuelve { uid }. */
    async ingresarGoogleFalso(sub, nombre) {
      const reclamos = { sub, email: `${sub}@ejemplo.test`, name: nombre, email_verified: true };
      const resultado = await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify(reclamos)));
      return { uid: resultado.user.uid };
    },
  };
}
