// Capturas de pantalla para el informe y el README (WI, sección 11.2).
//
//   node scripts/capturas.mjs [--salida <carpeta>]               contra los emuladores (modo compartido)
//   node scripts/capturas.mjs --url <https://…> [--salida <carpeta>]   contra la app publicada
//
// Todas las capturas salen a 390 × 844 con escala 2 (780 × 1688 px), sin la barra del navegador.
//
// Con emuladores: antes hay que levantar el modo compartido (npm run e2e:compartido) y después
// apagarlo (npm run e2e:compartido:apagar). Este script arranca su propio Vite --mode e2e en el
// puerto 5209 contra el proyecto demo-conecta-tp5 y lo cierra al terminar. El administrador es un
// usuario Google del emulador con documento en administradores, igual que el fixture `admin`.
//
// Con emuladores, el vecino es una cuenta de Google nueva del emulador de Auth (como el fixture
// `vecino`). Contra la URL publicada solo se captura Ingreso: la app solo admite cuentas de Google y
// el ingreso con una cuenta real no se automatiza (no hay acceso anónimo).
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { deflateSync, crc32 } from 'node:zlib';
import { chromium, devices } from '@playwright/test';

const argv = process.argv.slice(2);
const valor = (bandera) => (argv.includes(bandera) ? argv[argv.indexOf(bandera) + 1] : undefined);
const URL_PUBLICADA = valor('--url');
const SALIDA = resolve(valor('--salida') ?? 'docs/capturas');
const EMULADORES = !URL_PUBLICADA;
const PUERTO_VITE = 5209;
const ANCHO = 390;
const ALTO = 844;
const POSICION = { lat: -31.4262, lng: -62.0731 }; // cerca del Parque Cincuentenario
const ADMIN = { sub: 'admin-capturas', nombre: 'Equipo municipal' };
const VECINO = { sub: `vecina-capturas-${Date.now().toString(36)}`, nombre: 'Vecina de San Francisco' };

mkdirSync(SALIDA, { recursive: true });

// ------------------------------------------------------------------ entorno

let vite = null;
let adminDb = null;
let adminAuth = null;
let fx = null;

// Proyecto propio dentro de los emuladores compartidos: no toca el catálogo de demo-conecta-tp5
// ni el de los agentes (demo-conecta-tp5-sN), y se vacía al terminar.
const PROYECTO_CAPTURAS = 'demo-conecta-tp5-capturas';
const PUERTO_FIRESTORE = 8086;

async function prepararEmuladores() {
  process.env.FIRESTORE_EMULATOR_HOST ??= `127.0.0.1:${PUERTO_FIRESTORE}`;
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9098';
  process.env.E2E_PROYECTO = PROYECTO_CAPTURAS;
  const urlEdge = `http://127.0.0.1:8787/p/${PROYECTO_CAPTURAS}`;
  try {
    const r = await fetch(`${urlEdge}/functions/v1/tareas`);
    if (!r.ok) throw new Error();
  } catch {
    throw new Error('El modo compartido no está encendido. Levantalo con "npm run e2e:compartido".');
  }
  fx = await import('../tests/e2e/fixtures.mjs');
  const { initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const { getAuth } = await import('firebase-admin/auth');
  adminDb = getFirestore(initializeApp({ projectId: PROYECTO_CAPTURAS }, 'capturas'));
  adminAuth = getAuth(initializeApp({ projectId: fx.PROYECTO_USUARIOS }, 'capturas-auth'));
  const { sembrarCatalogo } = await import('./sembrar.mjs');
  await sembrarCatalogo(adminDb, { e2e: true, forzar: true });

  // Las variables de process.env pisan a .env.e2e (igual que "emuladores.mjs --vite sN").
  process.env.VITE_FIREBASE_PROJECT_ID = PROYECTO_CAPTURAS;
  process.env.VITE_SUPABASE_URL = urlEdge;
  const { createServer } = await import('vite');
  vite = await createServer({
    mode: 'e2e',
    cacheDir: 'node_modules/.vite-capturas',
    server: { port: PUERTO_VITE, strictPort: true, host: '127.0.0.1' },
    clearScreen: false,
    logLevel: 'warn',
  });
  await vite.listen();
  return `http://127.0.0.1:${PUERTO_VITE}`;
}

async function limpiarEmuladores(uids) {
  for (const uid of uids.filter(Boolean)) await adminAuth.deleteUser(uid).catch(() => {});
  await fetch(`http://127.0.0.1:${PUERTO_FIRESTORE}/emulator/v1/projects/${PROYECTO_CAPTURAS}/databases/(default)/documents`,
    { method: 'DELETE' }).catch(() => {});
}

// PNG sintético (asfalto con un pozo) para adjuntar al reclamo.
function trozo(tipo, datos) {
  const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo), datos]);
  const control = Buffer.alloc(4); control.writeUInt32BE(crc32(cuerpo) >>> 0);
  return Buffer.concat([largo, cuerpo, control]);
}
function fotoPozo(w = 640, h = 480) {
  const filas = [];
  for (let y = 0; y < h; y++) {
    const f = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) {
      const asfalto = 80 + ((x * 7 + y * 13) % 28);
      const pozo = ((x - 320) ** 2) / 170 ** 2 + ((y - 260) ** 2) / 95 ** 2 < 1;
      f[1 + x * 3] = pozo ? 45 : asfalto; f[2 + x * 3] = pozo ? 52 : asfalto; f[3 + x * 3] = pozo ? 68 : asfalto + 4;
    }
    filas.push(f);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr), trozo('IDAT', deflateSync(Buffer.concat(filas))), trozo('IEND', Buffer.alloc(0))]);
}

// ------------------------------------------------------------------ ayudantes de página

const opcionesContexto = (baseURL) => ({
  ...devices['Pixel 7'],
  viewport: { width: ANCHO, height: ALTO },
  screen: { width: ANCHO, height: ALTO },
  deviceScaleFactor: 2,
  baseURL,
  locale: 'es-AR',
  timezoneId: 'America/Argentina/Cordoba',
  geolocation: { latitude: POSICION.lat, longitude: POSICION.lng, accuracy: 15 },
  permissions: ['geolocation'],
  serviceWorkers: 'block',
});

/** Próximo lunes a viernes a las 10:30 de Córdoba (UTC−3), como Date. */
function proximoDiaHabil1030() {
  const d = new Date(Date.now() - 3 * 3600_000);
  d.setUTCDate(d.getUTCDate() + 1);
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 13, 30));
}

const ir = (page, hash) => page.evaluate((h) => { window.location.hash = h; }, hash);
const listo = (page) => page.locator('html[data-listo="true"]').waitFor({ state: 'attached', timeout: 45_000 });

async function cerrarFlotantes(page) {
  for (let i = 0; i < 6; i++) {
    const cerrar = page.locator('[data-testid="aviso-flotante"] [aria-label="Cerrar aviso"]');
    if (!(await cerrar.count())) break;
    await cerrar.first().click().catch(() => {});
    await page.waitForTimeout(250);
  }
}

/** Lleva el elemento al borde superior de su contenedor desplazable, con un margen. */
async function mostrar(page, testId, margen = 12) {
  const el = page.getByTestId(testId).first();
  await el.waitFor({ state: 'attached', timeout: 20_000 });
  await el.evaluate((nodo, m) => {
    let p = nodo.parentElement;
    while (p) {
      const s = getComputedStyle(p);
      if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight) break;
      p = p.parentElement;
    }
    const contenedor = p ?? document.scrollingElement;
    const arriba = contenedor === document.scrollingElement ? 0 : contenedor.getBoundingClientRect().top;
    contenedor.scrollTop += nodo.getBoundingClientRect().top - arriba - m;
  }, margen);
}

/** Vuelve al principio todos los contenedores desplazables. */
async function arriba(page) {
  await page.evaluate(() => {
    for (const n of document.querySelectorAll('*')) if (n.scrollTop > 0) n.scrollTop = 0;
  });
}

async function teselas(page) {
  await page.waitForFunction(() => {
    const t = [...document.querySelectorAll('img.leaflet-tile')];
    return t.length > 0 && t.every((i) => i.complete && i.naturalWidth > 0);
  }, null, { timeout: 30_000 }).catch(() => console.warn('  aviso: el mapa no terminó de cargar las teselas'));
}

/** Elige una opción de un Selector, sea de chips o de lista (que abre un diálogo). */
async function elegir(page, testId, valor) {
  const opcion = page.getByTestId(`${testId}-${valor}`);
  if (!(await opcion.isVisible().catch(() => false))) {
    await page.getByTestId(testId).first().click();
    await opcion.waitFor({ timeout: 5_000 });
  }
  await opcion.click();
}

const hechas = [];
async function foto(page, nombre, { flotantes = true } = {}) {
  if (flotantes) await cerrarFlotantes(page);
  await page.mouse.move(1, ALTO - 140); // fuera de cualquier control: sin estados de hover
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(700);
  const ruta = join(SALIDA, `${nombre}.png`);
  await page.screenshot({ path: ruta, animations: 'disabled', caret: 'hide' });
  hechas.push(nombre);
  console.log(`captura ${nombre}.png`);
}

// ------------------------------------------------------------------ recorrido

const base = EMULADORES ? await prepararEmuladores() : URL_PUBLICADA;
const navegador = await chromium.launch();
const errores = [];
let vecino = null;
let admin = null;
let uidVecino = null;
let uidAdmin = null;

try {
  recorrido: {
  // ---------- Ingreso
  const contextoVecino = await navegador.newContext(opcionesContexto(base));
  vecino = await contextoVecino.newPage();
  vecino.on('pageerror', (e) => errores.push(`vecino: ${e.message}`));
  await vecino.goto('/');
  await vecino.getByTestId('pantalla-ingreso').waitFor({ timeout: 60_000 });
  await foto(vecino, 'ingreso');
  if (!EMULADORES) {
    console.log('App publicada: solo se captura Ingreso (el resto exige una cuenta de Google real).');
    break recorrido;
  }

  uidVecino = await fx.entrarConGoogleFalso(vecino, VECINO.sub, VECINO.nombre, { esperar: false });
  await listo(vecino);
  await vecino.getByTestId('insignia-no-leidas').first().waitFor({ timeout: 15_000 }).catch(() => {});

  // ---------- Estacionamiento: zonas y sesión activa
  // Las zonas se muestran en horario de cobro (próximo día hábil a las 10:30 de Córdoba): el reloj de
  // la página se adelanta solo para esta captura y vuelve a la hora real antes de escribir nada.
  await ir(vecino, '#/estacionamiento');
  await vecino.getByTestId('zona-p1').waitFor();
  await vecino.clock.setSystemTime(proximoDiaHabil1030());
  await vecino.getByTestId('zona-p1').getByText('Cobra ahora').first().waitFor({ timeout: 10_000 }).catch(() => {});
  await teselas(vecino);
  await mostrar(vecino, 'mapa-estacionamiento', 8).catch(() => {});
  await foto(vecino, 'estacionamiento-zonas');
  await vecino.clock.setSystemTime(new Date());
  await vecino.waitForTimeout(1500);
  await vecino.getByTestId('zona-p1').click();
  await vecino.getByTestId('campo-patente').fill('AB123CD');
  await elegir(vecino, 'minutos', '60');
  await vecino.getByTestId('iniciar-estacionamiento').click();
  await vecino.locator('[role="dialog"]').waitFor();
  await vecino.getByTestId('confirmar-estacionamiento').click();
  const temporizador = vecino.locator('[data-testid^="temporizador-"]').first();
  await temporizador.waitFor({ timeout: 20_000 });
  const sesionId = (await temporizador.getAttribute('data-testid')).replace('temporizador-', '');
  await vecino.waitForTimeout(1500);
  await mostrar(vecino, `sesion-${sesionId}`);
  await foto(vecino, 'estacionamiento-temporizador');

  // ---------- Reclamos: errores del formulario y reclamo nuevo con una foto
  await ir(vecino, '#/reclamos');
  await vecino.getByTestId('formulario-reclamo').waitFor();
  await vecino.getByTestId('enviar-reclamo').click();
  await vecino.waitForTimeout(400);
  await mostrar(vecino, 'formulario-reclamo');
  await foto(vecino, 'reclamos-formulario');

  await vecino.getByTestId('campo-categoria-bacheo').click();
  await vecino.getByTestId('campo-direccion').fill('Belgrano y Pellegrini');
  await vecino.getByTestId('campo-descripcion').fill(
    'Hay un pozo grande en la esquina que junta agua cuando llueve. Esta semana se cayeron dos motos.');
  const [selector] = await Promise.all([vecino.waitForEvent('filechooser'), vecino.getByTestId('adjuntar').click()]);
  await selector.setFiles([{ name: 'pozo-belgrano.png', mimeType: 'image/png', buffer: fotoPozo() }]);
  await vecino.getByTestId('adjunto-0').waitFor();
  await vecino.getByTestId('enviar-reclamo').click();
  await vecino.getByTestId('resultado-reclamo').getByText('Recibimos').waitFor({ timeout: 30_000 });
  const codigo = (await vecino.getByTestId('resultado-reclamo').innerText()).match(/R-[A-Z0-9]{6}/)[0];
  console.log(`reclamo ${codigo}`);

  // ---------- Alarmas: zonas seguidas y aviso por cercanía (antes de que el panel active a2)
  await ir(vecino, '#/alarmas');
  await vecino.getByTestId('pantalla-alarmas').waitFor();
  await vecino.getByTestId('interruptor-cercania').click();
  await vecino.getByTestId('cercania-activa').waitFor({ timeout: 15_000 });

  // ---------- Panel municipal (solo con emuladores)
  let reclamoId = null;
  if (EMULADORES) {
    uidAdmin = await fx.uidGoogleFalso(ADMIN.sub, ADMIN.nombre);
    await fx.hacerAdmin(adminDb, uidAdmin, ADMIN.nombre);
    const contextoAdmin = await navegador.newContext(opcionesContexto(base));
    admin = await contextoAdmin.newPage();
    admin.on('pageerror', (e) => errores.push(`admin: ${e.message}`));
    await admin.goto('/');
    await fx.entrarConGoogleFalso(admin, ADMIN.sub, ADMIN.nombre);
    await ir(admin, '#/panel');
    await admin.getByTestId('pantalla-panel').waitFor();

    // Avanzar el reclamo del vecino con una nota.
    await admin.getByTestId('buscar-reclamos-panel').fill(codigo);
    const tarjeta = admin.locator('[data-testid^="reclamo-panel-"]').first();
    await tarjeta.waitFor({ timeout: 30_000 });
    reclamoId = (await tarjeta.getAttribute('data-testid')).replace('reclamo-panel-', '');
    await admin.getByTestId(`avanzar-${reclamoId}`).click();
    await admin.getByTestId('dialogo-avance').waitFor();
    await admin.getByTestId('nota-reclamo').fill('La cuadrilla de bacheo pasa el jueves a la mañana.');
    await admin.getByTestId('confirmar-avance').click();
    await admin.getByTestId(`estado-panel-${reclamoId}`).getByText('En proceso').waitFor({ timeout: 15_000 });

    // Activar la alarma del Parque.
    await admin.getByTestId('panel-pestana-alarmas').click();
    await admin.getByTestId('alarma-panel-a2').click();
    await admin.getByTestId('estado-alarma-panel-a2').getByText('Activada').waitFor({ timeout: 15_000 });

    // Publicar un aviso de obras en el Centro.
    await admin.getByTestId('panel-pestana-avisos').click();
    await admin.getByTestId('campo-aviso-titulo').fill('Corte de tránsito por obras en Bv. 25 de Mayo');
    await admin.getByTestId('campo-aviso-cuerpo').fill(
      'Entre Iturraspe y Belgrano, de 8 a 17 h, por repavimentación. Usá Bv. 9 de Julio como alternativa.');
    await elegir(admin, 'aviso-tipo', 'obras');
    await elegir(admin, 'aviso-zona', 'centro');
    await admin.getByTestId('publicar-aviso').click();
    await admin.getByTestId('dialogo-publicar').waitFor();
    await admin.getByTestId('confirmar-publicacion').click();
    await admin.getByTestId('dialogo-publicar').waitFor({ state: 'hidden', timeout: 15_000 });

    // Reclamos de vuelta, con el del vecino ya en proceso.
    await admin.getByTestId('panel-pestana-reclamos').click();
    await admin.getByTestId('buscar-reclamos-panel').fill('');
    await admin.getByTestId(`reclamo-panel-${reclamoId}`).waitFor();
    await admin.waitForTimeout(1500);
    await cerrarFlotantes(admin);
    await mostrar(admin, 'panel-pestana', 8);
    await foto(admin, 'panel-municipal');
  } else {
    console.log('URL publicada: se omiten el panel municipal y las acciones del administrador.');
  }

  // ---------- Seguimiento del reclamo
  await ir(vecino, '#/reclamos');
  await vecino.getByTestId(`reclamo-${codigo}`).waitFor({ timeout: 20_000 });
  await vecino.getByTestId(`reclamo-${codigo}`).click();
  await vecino.getByTestId('detalle-reclamo').waitFor();
  if (EMULADORES) await vecino.getByTestId('linea-tiempo').getByText('En proceso').first().waitFor({ timeout: 15_000 }).catch(() => {});
  await vecino.waitForTimeout(800);
  if (EMULADORES) await vecino.getByTestId('nota-municipal').waitFor({ timeout: 10_000 }).catch(() => {});
  await mostrar(vecino, 'linea-tiempo', 80);
  await foto(vecino, 'reclamos-seguimiento');

  // ---------- Alarmas: mapa y zonas
  await ir(vecino, '#/alarmas');
  await vecino.getByTestId('mapa-alarmas').waitFor();
  if (EMULADORES) await vecino.getByTestId('estado-alarma-a2').getByText('Activada').waitFor({ timeout: 15_000 });
  await teselas(vecino);
  await arriba(vecino);
  await foto(vecino, 'alarmas-mapa');
  await mostrar(vecino, 'avisos-alarmas');
  await foto(vecino, 'alarmas-zonas');

  // ---------- Bicicletas
  await ir(vecino, '#/bicicletas');
  await vecino.getByTestId('mapa-estaciones').waitFor();
  await teselas(vecino);
  await arriba(vecino);
  await foto(vecino, 'bicicletas-mapa');
  await vecino.getByTestId('usar-ubicacion').click();
  await vecino.locator('[data-testid^="distancia-"]').first().waitFor({ timeout: 15_000 });
  await vecino.waitForTimeout(600);
  await mostrar(vecino, 'buscar-estacion', 76);
  await foto(vecino, 'bicicletas-detalle');

  // ---------- Tributos
  await ir(vecino, '#/tributos');
  await vecino.getByTestId('tributo-T-1001').waitFor({ timeout: 20_000 });
  await mostrar(vecino, 'pestanas-tributos').catch(() => {});
  await foto(vecino, 'tributos-lista');
  await vecino.getByTestId('ver-cedulon-T-1001').click();
  await vecino.getByTestId('dialogo-cedulon').waitFor();
  await vecino.getByTestId('codigo-pago').waitFor();
  await foto(vecino, 'tributos-cedulon');
  await vecino.keyboard.press('Escape');
  await vecino.getByTestId('dialogo-cedulon').waitFor({ state: 'hidden' }).catch(() => {});

  // ---------- Contactos
  await ir(vecino, '#/contactos');
  await vecino.getByTestId('lista-contactos').waitFor();
  await mostrar(vecino, 'categoria', 44);
  await foto(vecino, 'contactos');

  // ---------- Notificaciones
  await ir(vecino, '#/notificaciones');
  await vecino.getByTestId('lista-notificaciones').waitFor();
  await vecino.waitForTimeout(800);
  await mostrar(vecino, 'filtro', 58);
  await foto(vecino, 'notificaciones-historial');
  await mostrar(vecino, 'preferencias-notificaciones');
  await foto(vecino, 'notificaciones-preferencias');

  // ---------- Inicio, con todo lo anterior reflejado en los accesos
  await ir(vecino, '#/inicio');
  await vecino.getByTestId('grilla-servicios').waitFor();
  await arriba(vecino);
  await foto(vecino, 'inicio');

  // ---------- Instalación (Cuenta). Chrome ofrece la instalación con beforeinstallprompt, que un
  // navegador sin interfaz no emite: se despacha el mismo evento para mostrar el estado que ve el vecino.
  await ir(vecino, '#/cuenta');
  await vecino.getByTestId('pantalla-cuenta').waitFor();
  await vecino.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = async () => {};
    e.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(e);
  });
  await vecino.getByTestId('instalar-app').waitFor({ timeout: 5_000 });
  await mostrar(vecino, 'cuenta-instalar', 64);
  await foto(vecino, 'instalacion');

  }
} finally {
  await navegador.close();
  if (EMULADORES && adminDb) await limpiarEmuladores([uidVecino, uidAdmin]);
  if (vite) await vite.close();
  console.log(`${hechas.length} capturas en ${SALIDA}`);
  if (errores.length) console.log(`Errores de página:\n${errores.join('\n')}`);
}
