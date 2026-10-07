// Configuración de los servicios (WP4, sección 5.1). Solo constantes: no inicializa nada ni toca window.
//
// Cada valor sale de una variable VITE_* que Vite reemplaza al compilar. La configuración web de
// Firebase es pública por diseño (viaja en el paquete que descarga el navegador), pero no se versiona:
// vive en .env.local. Los modos "emulador" y "e2e" la pisan con .env.emulador y .env.e2e.
//
// Importante: cada variable se lee con `import.meta.env.VITE_X` completo. Si se guardara
// `import.meta.env` en una constante, Vite insertaría el objeto entero con todas las variables
// (incluido el token de depuración de App Check) en el paquete publicado.

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

/** true en los modos "emulador" y "e2e": Auth y Firestore apuntan a los emuladores locales. */
export const USAR_EMULADORES = import.meta.env.VITE_USAR_EMULADORES === 'true';

/** true solo en el modo "e2e" (Playwright). En el build de producción es siempre false. */
export const MODO_E2E = import.meta.env.MODE === 'e2e';

/** true en `vite` (desarrollo); false en cualquier build. */
export const DESARROLLO = import.meta.env.DEV === true;

export const PUERTOS = {
  auth: Number(import.meta.env.VITE_PUERTO_AUTH) || 9099,
  firestore: Number(import.meta.env.VITE_PUERTO_FIRESTORE) || 8085,
};

/** Clave pública Web Push (Cloud Messaging, Configuración web). Vacía = avisos push desactivados. */
export const VAPID_KEY = (import.meta.env.VITE_FIREBASE_VAPID_KEY || '').trim();

/** Clave de sitio de reCAPTCHA v3 para App Check. Vacía = App Check desactivado. */
export const RECAPTCHA_SITE_KEY = (import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').trim();

/** Solo para el build de medición de carga (10.5): App Check apagado a propósito. */
export const APPCHECK_DESACTIVADO = import.meta.env.VITE_APPCHECK_DESACTIVADO === 'true';

// El token de depuración de App Check solo vale en desarrollo: en un build la condición es falsa
// y el minificador descarta el valor, así nunca viaja en el paquete publicado.
export const APPCHECK_DEBUG_TOKEN = import.meta.env.DEV ? (import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || '') : '';

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
