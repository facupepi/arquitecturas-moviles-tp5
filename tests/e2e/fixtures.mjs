// Fixtures de las pruebas extremo a extremo (WP1, sección 10.3).
//
//   import { test, expect } from './fixtures.mjs';
//   test('…', async ({ vecino, admin, adminDb, nuevoVecino, sembrarVecino, geolocalizar, adelantarReloj }) => { … });
//
// - vecino          { page, uid, contexto, sub }: la `page` de la prueba, que entra con una cuenta de
//                   Google NUEVA del emulador de Auth (ingresarGoogleFalso de 5.2, sub único por prueba)
//                   y espera html[data-listo="true"]. Cada prueba tiene un uid nuevo: sus datos no se
//                   cruzan con los de otra prueba ni con los de otro agente. No hay acceso anónimo.
// - nuevoVecino()   otra cuenta de Google nueva en un contexto aparte (otro "celular"), mismo dispositivo.
// - admin           { page, uid, contexto }: usuario Google del emulador (ingresarGoogleFalso de 5.2) con
//                   documento administradores/{uid}, en un contexto aparte. El sub es 'admin-e2e', o
//                   'admin-e2e-<agente>' en el modo compartido.
// - adminDb         firebase-admin Firestore contra el emulador, en el proyecto de la corrida.
// - adminAuth       firebase-admin Auth contra el emulador (para comprobar que un usuario ya no existe).
// - sembrarVecino(uid, opciones?)   vuelve a escribir los datos iniciales de un vecino (como vecino/alta).
// - restablecerCatalogo()           reescribe el catálogo del proyecto (horarioEstricto false), para
//                                   dejarlo como al arrancar después de una prueba que lo cambia.
// - geolocalizar(context, { lat, lng })   permiso y posición simulada.
// - sembrarTarjeta(adminDb, uid, tarjeta?)   guarda una tarjeta enmascarada (TARJETAS_PRUEBA) para pagar.
// - adelantarReloj(page, ms)        page.clock.setSystemTime (sin clock.install, que rompe Firestore).
//                                   Después de adelantar el reloj no se escribe: las reglas comparan con
//                                   el request.time real.
//
// Modo compartido: con E2E_AGENTE=sN (lo pone "npm run e2e:agente -- sN") todo apunta al proyecto
// demo-conecta-tp5-sN, el mismo que usa el Vite de ese agente. E2E_PROYECTO lo pisa si hiciera falta.
import { test as base, expect } from '@playwright/test';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { agenteE2E, PERFILES, PROYECTO_DEMO } from '../../scripts/emuladores.mjs';
import { sembrarCatalogo, sembrarVecino as sembrarVecinoEn } from '../../scripts/sembrar.mjs';

const PUERTOS = PERFILES.e2e.puertos;
process.env.FIRESTORE_EMULATOR_HOST ??= `127.0.0.1:${PUERTOS.firestore}`;
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= `127.0.0.1:${PUERTOS.auth}`;
process.env.METADATA_SERVER_DETECTION ??= 'none';

export const AGENTE = process.env.E2E_AGENTE ? agenteE2E(process.env.E2E_AGENTE) : null;
/** Proyecto de Firestore de esta corrida (demo-conecta-tp5 o demo-conecta-tp5-sN). */
export const PROYECTO = process.env.E2E_PROYECTO || AGENTE?.proyecto || PROYECTO_DEMO;
/** Proyecto donde viven los usuarios de Auth (el SDK web no le manda el proyecto al emulador). */
export const PROYECTO_USUARIOS = PROYECTO_DEMO;
export const SUB_ADMIN = AGENTE?.subAdmin ?? 'admin-e2e';
export const NOMBRE_ADMIN = 'Admin E2E';
export const NOMBRE_VECINO = 'Vecino E2E';
const CLAVE_API = 'demo-clave'; // la de .env.e2e; el emulador acepta cualquiera

if (!PROYECTO.startsWith('demo-')) throw new Error(`Las pruebas e2e solo corren contra proyectos demo-* (llegó ${PROYECTO}).`);

function appAdmin(proyecto) {
  const nombre = `e2e-${proyecto}`;
  return getApps().find((a) => a.name === nombre) ?? initializeApp({ projectId: proyecto }, nombre);
}

// ---------------------------------------------------------------------------------------------
// Ayudantes sueltos (también se pueden importar sin usar los fixtures)

/** Espera a que el almacén marque html[data-listo="true"] (datos mostrados). */
export async function esperarListo(page, timeout = 30_000) {
  await page.locator('html[data-listo="true"]').waitFor({ state: 'attached', timeout });
}

async function abrirApp(page) {
  if (!page.url().startsWith('http')) await page.goto('/');
  await page.locator('#root').waitFor({ state: 'attached' });
}

let contadorSubs = 0;
/** sub de Google único para esta corrida, este agente y este proceso (cuenta nueva en el emulador). */
export function subNuevo(prefijo = 'vecino') {
  contadorSubs += 1;
  const azar = Math.random().toString(36).slice(2, 8);
  return `${prefijo}-${AGENTE?.nombre ?? 'local'}-${process.pid}-${Date.now().toString(36)}-${contadorSubs}-${azar}`;
}

/**
 * uid que el emulador de Auth asigna a un usuario Google falso (mismo sub → mismo uid).
 * Usa la misma credencial sin firma que globalThis.__conectaE2E.ingresarGoogleFalso.
 */
export async function uidGoogleFalso(sub, nombre = NOMBRE_ADMIN) {
  const token = JSON.stringify({ sub, email: `${sub}@ejemplo.test`, name: nombre, email_verified: true });
  const r = await fetch(`http://127.0.0.1:${PUERTOS.auth}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${CLAVE_API}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      postBody: `id_token=${encodeURIComponent(token)}&providerId=google.com`,
      requestUri: 'http://127.0.0.1', returnSecureToken: true, returnIdpCredential: true,
    }),
  });
  const datos = await r.json();
  if (!r.ok || !datos.localId) throw new Error(`El emulador de Auth no creó el usuario Google ${sub}: ${JSON.stringify(datos.error ?? datos)}`);
  return datos.localId;
}

/** Entra con un usuario Google del emulador (globalThis.__conectaE2E, solo en vite --mode e2e). */
export async function entrarConGoogleFalso(page, sub, nombre = NOMBRE_ADMIN, { esperar = true } = {}) {
  await abrirApp(page);
  await page.waitForFunction(() => typeof globalThis.__conectaE2E?.ingresarGoogleFalso === 'function', null, { timeout: 30_000 });
  const { uid } = await page.evaluate(([s, n]) => globalThis.__conectaE2E.ingresarGoogleFalso(s, n), [sub, nombre]);
  if (esperar) await esperarListo(page);
  return uid;
}

/** Crea administradores/{uid} con el Admin SDK (el cliente no puede escribir esa colección). */
export async function hacerAdmin(adminDb, uid, nombre = NOMBRE_ADMIN) {
  await adminDb.doc(`administradores/${uid}`).set({ nombre, alta: Timestamp.now() });
}

/**
 * Guarda una tarjeta (medio de pago) del vecino con el Admin SDK, como la deja guardarTarjeta:
 * solo tipo, red, últimos 4, titular y vencimiento. Por defecto, tarjeta-1 = Mastercard débito •••• 8210.
 */
export const TARJETAS_PRUEBA = {
  debito: { id: 'tarjeta-1', tipo: 'debito', red: 'Mastercard', ultimos4: '8210', titular: 'Vecino Prueba', vence: '08/30' },
  credito: { id: 'tarjeta-2', tipo: 'credito', red: 'Visa', ultimos4: '4242', titular: 'Vecino Prueba', vence: '12/30' },
};
export async function sembrarTarjeta(adminDb, uid, tarjeta = TARJETAS_PRUEBA.debito) {
  const { id, ...datos } = tarjeta;
  await adminDb.doc(`usuarios/${uid}/tarjetas/${id}`).set({ ...datos, creadoEn: Timestamp.now() });
}

/** Cambia de pantalla por hash sin recargar: irA(page, '#/tributos'). */
export async function irA(page, hash) {
  await page.evaluate((h) => { window.location.hash = h; }, hash.startsWith('#') ? hash : `#/${hash}`);
}

/** Permiso de ubicación y posición simulada para un contexto. */
export async function geolocalizar(context, { lat, lng, precision = 10 }) {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: lat, longitude: lng, accuracy: precision });
}

const desfases = new WeakMap();
/**
 * Adelanta el reloj de la página `ms` milisegundos (acumulativo) con page.clock.setSystemTime.
 * No usa clock.install(): los temporizadores siguen siendo reales y el SDK de Firestore sigue andando.
 * Después de adelantar, no escribir en Firestore (las reglas usan el request.time real).
 */
export async function adelantarReloj(page, ms) {
  const total = (desfases.get(page) ?? 0) + ms;
  desfases.set(page, total);
  await page.clock.setSystemTime(new Date(Date.now() + total));
}

// ---------------------------------------------------------------------------------------------
// Fixtures

export const test = base.extend({
  adminDb: [async ({}, use) => { await use(getFirestore(appAdmin(PROYECTO))); }, { scope: 'worker' }],
  adminAuth: [async ({}, use) => { await use(getAuth(appAdmin(PROYECTO_USUARIOS))); }, { scope: 'worker' }],

  // Opciones del dispositivo del proyecto (Pixel 7, iPhone 13) para abrir contextos extra iguales.
  opcionesContexto: async ({ browserName, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, locale, timezoneId, baseURL, serviceWorkers }, use) => {
    const opciones = { viewport, userAgent, deviceScaleFactor, hasTouch, locale, timezoneId, baseURL, serviceWorkers };
    if (browserName !== 'firefox') opciones.isMobile = isMobile;
    await use(opciones);
  },

  vecino: async ({ page }, use) => {
    const sub = subNuevo();
    const uid = await entrarConGoogleFalso(page, sub, NOMBRE_VECINO);
    await use({ page, uid, contexto: page.context(), sub });
  },

  nuevoVecino: async ({ browser, opcionesContexto }, use) => {
    const contextos = [];
    await use(async () => {
      const contexto = await browser.newContext(opcionesContexto);
      contextos.push(contexto);
      const page = await contexto.newPage();
      const sub = subNuevo();
      const uid = await entrarConGoogleFalso(page, sub, NOMBRE_VECINO);
      return { page, uid, contexto, sub };
    });
    for (const c of contextos) await c.close().catch(() => {});
  },

  admin: async ({ browser, opcionesContexto, adminDb }, use) => {
    // El documento de administrador se crea antes de entrar: la app ya arranca con esAdmin.
    const uidEsperado = await uidGoogleFalso(SUB_ADMIN, NOMBRE_ADMIN);
    await hacerAdmin(adminDb, uidEsperado);
    const contexto = await browser.newContext(opcionesContexto);
    const page = await contexto.newPage();
    const uid = await entrarConGoogleFalso(page, SUB_ADMIN, NOMBRE_ADMIN);
    if (uid !== uidEsperado) await hacerAdmin(adminDb, uid);
    await use({ page, uid, contexto });
    await contexto.close().catch(() => {});
  },

  sembrarVecino: async ({ adminDb }, use) => {
    await use((uid, opciones = {}) => sembrarVecinoEn(adminDb, uid, opciones));
  },

  restablecerCatalogo: async ({ adminDb }, use) => {
    await use(() => sembrarCatalogo(adminDb, { e2e: true, forzar: true }));
  },

  geolocalizar: async ({}, use) => { await use(geolocalizar); },
  adelantarReloj: async ({}, use) => { await use(adelantarReloj); },
});

export { expect };
