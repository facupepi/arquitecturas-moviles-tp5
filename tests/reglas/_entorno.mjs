// Ayudantes comunes de las pruebas de reglas (WP3, sección 10.2).
// Se corren con: npm run test:reglas (emulador de Firestore en 8086, proyecto demo-conecta-tp5).
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { Timestamp, setLogLevel } from 'firebase/firestore';

// Los rechazos esperados no ensucian la salida.
setLogLevel('silent');

export { assertSucceeds, assertFails };

export const PROYECTO = 'demo-conecta-tp5';
export const MIN = 60_000;

export async function crearEntorno() {
  const [host, puerto] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8086').split(':');
  const entorno = await initializeTestEnvironment({
    projectId: PROYECTO,
    firestore: { host, port: Number(puerto), rules: readFileSync('firestore.rules', 'utf8') },
  });
  await entorno.clearFirestore();
  return entorno;
}

// Vecino invitado (cuenta anónima), como entra la mayoría.
export function vecino(entorno, uid) {
  return entorno.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
}

// Usuario con cuenta de Google (el único que puede ser admin).
export function google(entorno, uid) {
  return entorno.authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com' } }).firestore();
}

export function sinSesion(entorno) {
  return entorno.unauthenticatedContext().firestore();
}

// Siembra con las reglas apagadas. fn recibe el Firestore de administración.
export async function sembrar(entorno, fn) {
  await entorno.withSecurityRulesDisabled(async (contexto) => fn(contexto.firestore()));
}

export const ts = (ms) => Timestamp.fromMillis(ms);

export const PREFERENCIAS = {
  tipos: ['obras', 'cortes', 'eventos', 'emergencias', 'servicios', 'alarmas', 'tributos', 'estacionamiento', 'reclamos'],
  zonas: ['centro', 'parque'],
  frecuencia: 'inmediata',
  push: false,
};

// Hora de Córdoba (UTC-3 todo el año): día ISO (1 = lunes ... 7 = domingo) y hora 0..23.
export function ahoraCordoba(ms = Date.now()) {
  const local = new Date(ms - 3 * 60 * MIN);
  const dia = local.getUTCDay() === 0 ? 7 : local.getUTCDay();
  return { dia, hora: local.getUTCHours() };
}
