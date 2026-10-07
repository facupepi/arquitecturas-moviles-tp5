// App Check con reCAPTCHA v3 (WP4, sección 5.4).
//
// Se inicializa al importar y antes que Firestore: firestore.js importa este módulo primero, y
// src/index.web.js también lo importa al principio. No se inicializa con los emuladores (no exigen
// App Check), con VITE_APPCHECK_DESACTIVADO=true (build de medición de carga) ni sin clave de sitio.
import { initializeAppCheck, ReCaptchaV3Provider, getToken } from 'firebase/app-check';
import { app } from './app.js';
import { USAR_EMULADORES, APPCHECK_DESACTIVADO, RECAPTCHA_SITE_KEY, APPCHECK_DEBUG_TOKEN } from './config.js';

function crearAppCheck() {
  if (USAR_EMULADORES || APPCHECK_DESACTIVADO) return null;
  if (!RECAPTCHA_SITE_KEY) {
    console.warn('[App Check] Falta VITE_RECAPTCHA_SITE_KEY: App Check queda desactivado.');
    return null;
  }
  // Desarrollo contra producción: token de depuración registrado en la consola. "true" pide al SDK
  // que genere uno y lo muestre en la consola del navegador para registrarlo.
  if (APPCHECK_DEBUG_TOKEN) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = APPCHECK_DEBUG_TOKEN === 'true' ? true : APPCHECK_DEBUG_TOKEN;
  }
  try {
    return initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    // No debería pasar (solo si se inicializa dos veces); la app sigue sin App Check.
    console.warn('[App Check] No se pudo inicializar:', e);
    return null;
  }
}

/** Instancia de App Check, o null cuando está desactivado. */
export const appCheck = crearAppCheck();

/**
 * Token vigente de App Check para el encabezado X-Firebase-AppCheck de Supabase (6.13).
 * Devuelve null si App Check está desactivado o si no se pudo obtener (bloqueador, sin red):
 * quien lo usa manda la solicitud sin el encabezado y el servidor decide según su modo.
 */
export async function obtenerTokenAppCheck() {
  if (!appCheck) return null;
  try {
    const { token } = await getToken(appCheck, false);
    return token || null;
  } catch (e) {
    console.warn('[App Check] No se pudo obtener el token:', e?.code || e);
    return null;
  }
}
