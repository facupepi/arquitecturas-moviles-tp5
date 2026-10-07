// Autenticación (WP4, sección 5.2). Toma de heredado:src/firebase.js el popup con respaldo de redirect
// y la tabla de mensajes por código, ahora también para vincular una cuenta de invitado con Google.
import { useSyncExternalStore } from 'react';
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  onIdTokenChanged,
  GoogleAuthProvider,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  linkWithPopup,
  linkWithRedirect,
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

/** Usuario = { uid, nombre, email, anonimo, proveedor: 'anonymous' | 'google.com' } */
function aUsuario(u) {
  if (!u) return null;
  const datosGoogle = u.providerData?.find((p) => p?.providerId === 'google.com') ?? null;
  const google = !!datosGoogle;
  return {
    uid: u.uid,
    // Al vincular un invitado, displayName y email pueden quedar vacíos en el usuario aunque los
    // traiga la cuenta de Google: se usan los del proveedor (pedido de S1).
    nombre: u.displayName || datosGoogle?.displayName || null,
    email: u.email || datosGoogle?.email || null,
    anonimo: u.isAnonymous,
    proveedor: u.isAnonymous ? 'anonymous' : google ? 'google.com' : (u.providerData?.[0]?.providerId || 'anonymous'),
  };
}

const iguales = (a, b) => a === b || (!!a && !!b && a.uid === b.uid && a.nombre === b.nombre
  && a.email === b.email && a.anonimo === b.anonimo && a.proveedor === b.proveedor);

let estadoSesion = { usuario: null, listo: false };
const oyentesSesion = new Set();
let huboSesionGuardada = null; // si al arrancar ya había una sesión persistida (visita repetida)

function publicarSesion(u) {
  const usuario = aUsuario(u);
  if (estadoSesion.listo && iguales(estadoSesion.usuario, usuario)) return;
  estadoSesion = { usuario, listo: true };
  for (const oyente of oyentesSesion) oyente();
}

// onIdTokenChanged (no onAuthStateChanged): también se dispara al vincular, porque cambia el token
// aunque el uid sea el mismo. La comparación de campos evita dibujar de nuevo con cada renovación.
onIdTokenChanged(auth, (u) => {
  if (huboSesionGuardada === null) huboSesionGuardada = !!u;
  publicarSesion(u);
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

// Después de vincular, el objeto User cambia en el lugar: se vuelve a leer por las dudas de que el
// SDK no notifique (onIdTokenChanged igual lo hace cuando cambia el token).
const refrescarSesion = () => publicarSesion(auth.currentUser);

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
  'auth/admin-restricted-operation': 'El ingreso como invitado no está disponible en este momento. Probá con Google.',
  'auth/network-request-failed': 'No se pudo conectar con el servicio de ingreso. Revisá tu conexión.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada. Contactá a atención ciudadana.',
  'auth/too-many-requests': 'Hubo demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.',
  'auth/quota-exceeded': 'El servicio de ingreso está saturado. Probá en unos minutos.',
  'auth/credential-already-in-use': 'Esa cuenta de Google ya tiene datos. ¿Querés entrar con ella?',
  'auth/email-already-in-use': 'Esa cuenta de Google ya tiene datos. ¿Querés entrar con ella?',
  'auth/provider-already-linked': 'Tu cuenta ya está vinculada con Google.',
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
  'auth/credential-already-in-use': 'cuenta-existente',
  'auth/email-already-in-use': 'cuenta-existente',
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
// Ingreso, vínculo y salida

export async function ingresarComoInvitado() {
  try {
    const credencial = await signInAnonymously(auth);
    return credencial.user;
  } catch (e) {
    throw aErrorApp(e);
  }
}

/**
 * Popup de Google. Con el popup bloqueado, o dentro de la PWA instalada de iOS (donde el popup no
 * vuelve a la app), sigue por redirect: la página se va y completarRedireccion() termina el ingreso.
 */
export async function ingresarConGoogle() {
  try {
    if (esPwaIos()) return await redirigir('ingreso', () => signInWithRedirect(auth, proveedorGoogle, browserPopupRedirectResolver));
    try {
      const credencial = await signInWithPopup(auth, proveedorGoogle, browserPopupRedirectResolver);
      return credencial.user;
    } catch (e) {
      if (!POPUP_BLOQUEADO.has(e?.code)) throw e;
      return await redirigir('ingreso', () => signInWithRedirect(auth, proveedorGoogle, browserPopupRedirectResolver));
    }
  } catch (e) {
    throw aErrorApp(e);
  }
}

/**
 * Vincula al invitado actual con Google: conserva el uid y sus datos. Si esa cuenta de Google ya
 * existe, lanza ErrorApp('cuenta-existente') con la credencial en datos.credencial para ofrecer
 * entrar con ella (sesion.cambiarACuentaExistente).
 */
export async function vincularConGoogle() {
  const usuario = auth.currentUser;
  if (!usuario) throw new ErrorApp('sin-sesion');
  try {
    if (esPwaIos()) return await redirigir('vinculo', () => linkWithRedirect(usuario, proveedorGoogle, browserPopupRedirectResolver));
    try {
      const credencial = await linkWithPopup(usuario, proveedorGoogle, browserPopupRedirectResolver);
      refrescarSesion();
      return credencial.user;
    } catch (e) {
      if (!POPUP_BLOQUEADO.has(e?.code)) throw e;
      return await redirigir('vinculo', () => linkWithRedirect(usuario, proveedorGoogle, browserPopupRedirectResolver));
    }
  } catch (e) {
    if (e?.code === 'auth/credential-already-in-use' || e?.code === 'auth/email-already-in-use') {
      throw new ErrorApp('cuenta-existente', undefined, {
        datos: { credencial: GoogleAuthProvider.credentialFromError(e) },
        causa: e,
      });
    }
    throw aErrorApp(e);
  }
}

async function redirigir(tipo, iniciar) {
  marcarRedireccion(tipo);
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
 * Termina un ingreso o un vínculo por redirect. Solo trabaja si existe la marca de sessionStorage,
 * así no carga el iframe de Auth en cada arranque.
 * Devuelve { tipo: 'ingreso' | 'vinculo' | null, cuentaExistente?, error? }:
 *  - cuentaExistente: credencial de Google si el vínculo falló porque esa cuenta ya tenía datos.
 *  - error: ErrorApp de cualquier otra falla (no lanza, para no romper el arranque de App.jsx).
 */
export async function completarRedireccion() {
  const marca = leerMarca();
  if (!marca) return { tipo: null };
  borrarMarca();
  try {
    const resultado = await getRedirectResult(auth, browserPopupRedirectResolver);
    if (!resultado) return { tipo: null };
    const tipo = resultado.operationType === 'link' ? 'vinculo' : 'ingreso';
    if (tipo === 'vinculo') {
      await resultado.user.getIdToken(true);
      refrescarSesion();
    }
    return { tipo };
  } catch (e) {
    if (e?.code === 'auth/credential-already-in-use' || e?.code === 'auth/email-already-in-use') {
      return { tipo: 'vinculo', cuentaExistente: GoogleAuthProvider.credentialFromError(e) };
    }
    console.warn('[Auth] No se pudo completar la redirección:', e?.code || e);
    return { tipo: marca === 'vinculo' ? 'vinculo' : 'ingreso', error: aErrorApp(e) };
  }
}

/** Entra con una credencial ya obtenida (la de cuentaExistente). Lo orquesta src/datos/sesion.js. */
export async function ingresarConCredencial(credencial) {
  if (!credencial) throw new ErrorApp('desconocido', 'No recibimos los datos de la cuenta de Google. Volvé a intentar.');
  try {
    const resultado = await signInWithCredential(auth, credencial);
    return resultado.user;
  } catch (e) {
    throw aErrorApp(e);
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
