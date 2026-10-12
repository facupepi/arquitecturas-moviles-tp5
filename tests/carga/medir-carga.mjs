// Medición del requisito "carga en menos de 3 s" (WI, sección 10.5).
//
// Chromium con perfil de celular (390 × 844, DPR 3, táctil, agente de usuario del Pixel 7), red
// emulada por CDP (150 ms de latencia por solicitud, 1,6 Mbps de bajada, 750 kbps de subida) y CPU
// limitada ×4. Dos series:
//
//   frio      contexto nuevo (sin caché, sin service worker, sin sesión). Mide FCP, LCP, el momento
//             en que la pantalla de Ingreso es utilizable (botón "Continuar con Google" montado por
//             React), las tareas largas (TBT y fin de la última) y el peso transferido.
//   repetida  contexto con una visita previa sin limitar (service worker activo y precache completo,
//             sin sesión). Se abre una pestaña nueva con la red y la CPU limitadas y se mide FCP, LCP,
//             el Ingreso utilizable y el peso.
//
// Solo se ingresa con una cuenta de Google y una medición automática no puede entrar con una cuenta
// real: por eso ninguna serie inicia sesión ni crea usuarios. (La versión con invitados medía además
// data-listo después de entrar.)
//
// Criterio (10.5): LCP en frío < 3 s y el Ingreso utilizable en la visita repetida < 3 s, por
// mediana y por peor caso.
//
// Uso:
//   npm run test:carga                                  contra https://san-francisco-conecta-tp5.web.app
//   node tests/carga/medir-carga.mjs --url <base>       contra otra URL ya servida
//   node tests/carga/medir-carga.mjs --dist <carpeta>   sirve esa carpeta como Hosting (servidor-hosting.mjs)
//   Opciones: --corridas 7 (por serie), --salida docs/pruebas/carga.json, --etiqueta "texto",
//             --latencia 150 --bajada 1.6 --subida 0.75 (Mbps) --cpu 4, --solo frio|repetida, --detalle (cronología de solicitudes),
//             --simular-recaptcha (costo aproximado de App Check, ver abajo)
//
// No crea cuentas ni escribe en el backend.
import { chromium, devices } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { servirHosting } from './servidor-hosting.mjs';

const URL_PUBLICA = 'https://san-francisco-conecta-tp5.web.app';

const argv = process.argv.slice(2);
const opcion = (nombre, porDefecto) => {
  const i = argv.indexOf(`--${nombre}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : porDefecto;
};
const CORRIDAS = Number(opcion('corridas', 7));
const SALIDA = resolve(opcion('salida', 'docs/pruebas/carga.json'));
const ETIQUETA = opcion('etiqueta', '');
const SOLO = opcion('solo', '');
const DETALLE = argv.includes('--detalle'); // guarda la cronología de solicitudes de cada corrida
// Aproxima el costo de App Check en un build sin App Check (emuladores o VITE_APPCHECK_DESACTIVADO):
// al terminar DOMContentLoaded (cuando ya corrió el módulo de entrada, que es donde se inicializa App
// Check) agrega el cargador público de reCAPTCHA v3, que baja recaptcha__<idioma>.js de gstatic.
// No pide token ni habla con el proyecto de Firebase. Es una cota inferior: falta el iframe "anchor".
const SIMULAR_RECAPTCHA = argv.includes('--simular-recaptcha');
const RED = {
  latencia: Number(opcion('latencia', 150)),
  bajadaMbps: Number(opcion('bajada', 1.6)),
  subidaMbps: Number(opcion('subida', 0.75)),
};
const CPU = Number(opcion('cpu', 4));
const ESPERA_FINAL_MS = 4_000; // después del hito, para que se asienten LCP y tareas largas
const LIMITE_MS = 60_000;

const PIXEL7 = devices['Pixel 7'];
const PERFIL = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: PIXEL7.userAgent,
  locale: 'es-AR',
  timezoneId: 'America/Argentina/Cordoba',
};

// Se inyecta antes que cualquier script de la página: observa pintado, LCP, tareas largas y los hitos.
function sondear() {
  const m = { fcp: null, lcp: null, lcpElemento: null, tareas: [], ingreso: null, listo: null, dato: null };
  window.__carga = m;
  const ahora = () => performance.now();
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') m.fcp = e.startTime;
    }).observe({ type: 'paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        m.lcp = e.startTime;
        const el = e.element;
        m.lcpElemento = el ? `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.dataset?.testid ? `[data-testid=${el.dataset.testid}]` : ''} "${(el.textContent || '').trim().slice(0, 40)}"` : null;
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) m.tareas.push([e.startTime, e.duration]);
    }).observe({ type: 'longtask', buffered: true });
  } catch { /* navegador sin PerformanceObserver */ }
  const revisar = () => {
    if (m.ingreso === null) {
      const b = document.querySelector('[data-testid="ingresar-google"]');
      if (b && b.getBoundingClientRect().height > 0) m.ingreso = ahora();
    }
    if (m.listo === null && document.documentElement.getAttribute('data-listo') === 'true') m.listo = ahora();
    if (m.dato === null) {
      const d = [...document.querySelectorAll('[data-testid^="dato-"]')].find((x) => (x.textContent || '').trim());
      if (d) m.dato = ahora();
    }
  };
  new MutationObserver(revisar).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  document.addEventListener('DOMContentLoaded', revisar);
  if (window.__simularRecaptcha) {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('script');
      s.src = 'https://www.google.com/recaptcha/api.js?render=explicit&hl=es';
      s.async = true;
      document.head.appendChild(s);
    });
  }
}

async function limitar(pagina) {
  const cdp = await pagina.context().newCDPSession(pagina);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: RED.latencia,
    downloadThroughput: (RED.bajadaMbps * 1_000_000) / 8,
    uploadThroughput: (RED.subidaMbps * 1_000_000) / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  // Peso transferido por solicitud (encodedDataLength incluye encabezados y cuerpo comprimido).
  const solicitudes = new Map();
  cdp.on('Network.requestWillBeSent', (e) => solicitudes.set(e.requestId, { url: e.request.url, tipo: e.type, t: e.timestamp }));
  cdp.on('Network.responseReceived', (e) => {
    const s = solicitudes.get(e.requestId);
    if (s) Object.assign(s, { sw: !!e.response.fromServiceWorker, cacheDisco: !!e.response.fromDiskCache, estado: e.response.status, tipo: e.type, respuesta: e.timestamp });
  });
  cdp.on('Network.loadingFinished', (e) => {
    const s = solicitudes.get(e.requestId);
    if (s) Object.assign(s, { bytes: e.encodedDataLength, fin: e.timestamp });
  });
  return { cdp, solicitudes };
}

function resumirRed(solicitudes, origenApp) {
  const porTipo = {};
  let total = 0;
  let deApp = 0;
  let n = 0;
  let desdeSW = 0;
  for (const s of solicitudes.values()) {
    if (s.bytes === undefined) continue;
    n += 1;
    if (s.sw) desdeSW += 1;
    total += s.bytes;
    const clave = s.tipo ?? 'Other';
    porTipo[clave] = (porTipo[clave] ?? 0) + s.bytes;
    if (s.url.startsWith(origenApp)) deApp += s.bytes;
  }
  const kb = (b) => Math.round((b / 1024) * 10) / 10;
  return {
    solicitudes: n,
    desdeServiceWorker: desdeSW,
    totalKB: kb(total),
    origenAppKB: kb(deApp),
    porTipoKB: Object.fromEntries(Object.entries(porTipo).map(([k, v]) => [k, kb(v)])),
  };
}

// Cronología de solicitudes en ms desde la primera (el documento), para buscar cuellos de botella.
function cronologia(solicitudes) {
  const lista = [...solicitudes.values()].filter((s) => s.t !== undefined);
  const t0 = Math.min(...lista.map((s) => s.t));
  const ms = (t) => (t === undefined ? null : Math.round((t - t0) * 1000));
  return lista.map((s) => ({
    url: s.url.replace(/^https?:\/\/[^/]+/, '').slice(0, 80), tipo: s.tipo, sw: s.sw ?? null,
    inicio: ms(s.t), respuesta: ms(s.respuesta), fin: ms(s.fin), kb: s.bytes === undefined ? null : Math.round(s.bytes / 102.4) / 10,
  })).sort((a, b) => a.inicio - b.inicio);
}

// Primer byte del documento según la red emulada (la Navigation Timing no incluye la latencia de CDP).
function ttfbDocumento(solicitudes) {
  const doc = [...solicitudes.values()].find((s) => s.tipo === 'Document');
  return doc?.respuesta ? Math.round((doc.respuesta - doc.t) * 1000) : null;
}

function resumirTareas(tareas, desde, hasta) {
  let tbt = 0;
  let ultima = null;
  for (const [inicio, duracion] of tareas) {
    if (hasta !== null && inicio > hasta) continue;
    if (desde !== null && inicio + duracion > desde) tbt += Math.max(0, duracion - 50 - Math.max(0, desde - inicio));
    ultima = Math.max(ultima ?? 0, inicio + duracion);
  }
  return { tbt: Math.round(tbt), finUltimaTarea: ultima === null ? null : Math.round(ultima), cantidad: tareas.length };
}

const redondear = (x) => (x === null || x === undefined ? null : Math.round(x));

async function corridaFrio(navegador, base, i) {
  const contexto = await navegador.newContext({ ...PERFIL, serviceWorkers: 'allow' });
  if (SIMULAR_RECAPTCHA) await contexto.addInitScript(() => { window.__simularRecaptcha = true; });
  await contexto.addInitScript(sondear);
  const pagina = await contexto.newPage();
  const { cdp, solicitudes } = await limitar(pagina);
  try {
    await pagina.goto(base, { waitUntil: 'commit', timeout: LIMITE_MS });
    await pagina.waitForFunction(() => window.__carga?.ingreso !== null, null, { timeout: LIMITE_MS, polling: 50 });
    await pagina.waitForTimeout(ESPERA_FINAL_MS);
    const m = await pagina.evaluate(() => ({ ...window.__carga, nav: performance.getEntriesByType('navigation')[0]?.toJSON() }));
    const redIngreso = resumirRed(solicitudes, base);
    const tareas = resumirTareas(m.tareas, m.fcp, m.ingreso);
    return {
      corrida: i,
      ttfb: ttfbDocumento(solicitudes),
      fcp: redondear(m.fcp),
      lcp: redondear(m.lcp),
      lcpElemento: m.lcpElemento,
      ingresoUtilizable: redondear(m.ingreso),
      tbtHastaIngreso: tareas.tbt,
      finUltimaTareaLarga: tareas.finUltimaTarea,
      tareasLargas: m.tareas.length,
      interactivo: redondear(Math.max(m.ingreso, tareas.finUltimaTarea ?? 0)),
      domContentLoaded: redondear(m.nav?.domContentLoadedEventEnd),
      load: redondear(m.nav?.loadEventEnd),
      redHastaIngreso: redIngreso,
      ...(DETALLE ? { cronologia: cronologia(solicitudes) } : {}),
    };
  } finally {
    await cdp.detach().catch(() => {});
    await contexto.close();
  }
}

async function corridaRepetida(navegador, base, i) {
  const contexto = await navegador.newContext({ ...PERFIL, serviceWorkers: 'allow' });
  if (SIMULAR_RECAPTCHA) await contexto.addInitScript(() => { window.__simularRecaptcha = true; });
  await contexto.addInitScript(sondear);
  try {
    // Visita previa sin limitar: Ingreso, service worker activo y precache completo (sin sesión).
    const previa = await contexto.newPage();
    await previa.goto(base, { waitUntil: 'load', timeout: LIMITE_MS });
    await previa.waitForFunction(() => window.__carga?.ingreso !== null, null, { timeout: LIMITE_MS });
    await previa.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return reg.active?.state;
    });
    await previa.waitForTimeout(2_000); // el precache termina de guardarse
    await previa.close();

    const pagina = await contexto.newPage();
    const { cdp, solicitudes } = await limitar(pagina);
    try {
      await pagina.goto(base, { waitUntil: 'commit', timeout: LIMITE_MS });
      await pagina.waitForFunction(() => window.__carga?.ingreso !== null, null, { timeout: LIMITE_MS, polling: 50 });
      await pagina.waitForTimeout(ESPERA_FINAL_MS);
      const m = await pagina.evaluate(() => ({
        ...window.__carga,
        nav: performance.getEntriesByType('navigation')[0]?.toJSON(),
        controlada: !!navigator.serviceWorker.controller,
      }));
      const tareas = resumirTareas(m.tareas, m.fcp, m.ingreso);
      return {
        corrida: i,
        controladaPorSW: m.controlada,
        ttfb: ttfbDocumento(solicitudes),
        fcp: redondear(m.fcp),
        lcp: redondear(m.lcp),
        lcpElemento: m.lcpElemento,
        ingresoUtilizable: redondear(m.ingreso),
        tbtHastaIngreso: tareas.tbt,
        finUltimaTareaLarga: tareas.finUltimaTarea,
        tareasLargas: m.tareas.length,
        interactivo: redondear(Math.max(m.ingreso, tareas.finUltimaTarea ?? 0)),
        red: resumirRed(solicitudes, base),
        ...(DETALLE ? { cronologia: cronologia(solicitudes) } : {}),
      };
    } finally {
      await cdp.detach().catch(() => {});
    }
  } finally {
    await contexto.close();
  }
}

function estadistica(valores) {
  const v = valores.filter((x) => typeof x === 'number').sort((a, b) => a - b);
  if (!v.length) return null;
  const q = (p) => v[Math.min(v.length - 1, Math.ceil(p * v.length) - 1)];
  const mediana = v.length % 2 ? v[(v.length - 1) / 2] : Math.round((v[v.length / 2 - 1] + v[v.length / 2]) / 2);
  return { n: v.length, minimo: v[0], mediana, p90: q(0.9), peor: v[v.length - 1] };
}

function resumir(corridas, campos) {
  return Object.fromEntries(campos.map((c) => [c, estadistica(corridas.map((r) => c.split('.').reduce((o, k) => o?.[k], r)))]));
}

async function principal() {
  let base = opcion('url', null);
  let servidor = null;
  const dist = opcion('dist', null);
  if (dist) {
    servidor = await servirHosting(dist, Number(opcion('puerto', 0)));
    base = servidor.url;
  }
  base = (base ?? URL_PUBLICA).replace(/\/$/, '');

  const respuesta = await fetch(`${base}/`).catch((e) => ({ ok: false, status: String(e.cause?.code ?? e.message) }));
  if (!respuesta.ok) {
    console.error(`medir-carga: ${base}/ respondió ${respuesta.status}. ¿Está desplegado el Hosting? No se mide.`);
    await servidor?.cerrar();
    process.exit(2);
  }

  console.log(`Midiendo ${base}: ${CORRIDAS} corridas por serie, red ${RED.latencia} ms / ${RED.bajadaMbps} Mbps / ${RED.subidaMbps} Mbps, CPU ×${CPU}`);
  const navegador = await chromium.launch();
  const frio = [];
  const repetida = [];
  try {
    for (let i = 1; i <= CORRIDAS; i += 1) {
      if (SOLO !== 'repetida') {
        const r = await corridaFrio(navegador, base, i);
        frio.push(r);
        console.log(`frío ${i}: FCP ${r.fcp} · LCP ${r.lcp} · ingreso ${r.ingresoUtilizable} · interactivo ${r.interactivo} · TBT ${r.tbtHastaIngreso} · ${r.redHastaIngreso.totalKB} KB`);
      }
      if (SOLO !== 'frio') {
        const r = await corridaRepetida(navegador, base, i);
        repetida.push(r);
        console.log(`repetida ${i}: SW ${r.controladaPorSW} · FCP ${r.fcp} · LCP ${r.lcp} · ingreso ${r.ingresoUtilizable} · interactivo ${r.interactivo} · ${r.red.totalKB} KB (${r.red.desdeServiceWorker}/${r.red.solicitudes} del SW)`);
      }
    }
  } finally {
    await navegador.close();
    await servidor?.cerrar();
  }

  const resumenFrio = resumir(frio, ['ttfb', 'fcp', 'lcp', 'ingresoUtilizable', 'interactivo', 'tbtHastaIngreso', 'finUltimaTareaLarga', 'domContentLoaded', 'load', 'redHastaIngreso.totalKB']);
  const resumenRepetida = resumir(repetida, ['ttfb', 'fcp', 'lcp', 'ingresoUtilizable', 'interactivo', 'tbtHastaIngreso', 'finUltimaTareaLarga', 'red.totalKB']);
  const cumple = {
    frioLcpMenor3s: resumenFrio.lcp ? resumenFrio.lcp.peor < 3000 : null,
    repetidaIngresoMenor3s: resumenRepetida.ingresoUtilizable ? resumenRepetida.ingresoUtilizable.peor < 3000 : null,
  };
  const informe = {
    fecha: new Date().toISOString(),
    etiqueta: ETIQUETA,
    url: base,
    perfil: { ...PERFIL, red: RED, cpu: CPU, navegador: `Chromium ${navegador.version()}`, simularRecaptcha: SIMULAR_RECAPTCHA },
    criterio: 'LCP en frío < 3000 ms e Ingreso utilizable en visita repetida < 3000 ms (peor caso)',
    cumple,
    resumen: { frio: resumenFrio, repetida: resumenRepetida },
    corridas: { frio, repetida },
  };
  mkdirSync(dirname(SALIDA), { recursive: true });
  const previo = existsSync(SALIDA) ? JSON.parse(readFileSync(SALIDA, 'utf8')) : null;
  const series = Array.isArray(previo?.series) ? previo.series.filter((s) => s.etiqueta !== ETIQUETA) : [];
  writeFileSync(SALIDA, `${JSON.stringify({ series: [...series, informe] }, null, 2)}\n`);
  console.log(JSON.stringify({ cumple, frio: resumenFrio, repetida: resumenRepetida }, null, 2));
  console.log(`Guardado en ${SALIDA}`);
  if (cumple.frioLcpMenor3s === false || cumple.repetidaListoMenor3s === false) process.exitCode = 1;
}

await principal();
