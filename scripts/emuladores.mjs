// Entorno local con emuladores (WP1).
//
//   node scripts/emuladores.mjs          desarrollo: Auth 9099, Firestore 8085, interfaz 4005,
//                                        edge-simulado 8787 y Vite --mode emulador en 5175.
//                                        Los datos se exportan a .firebase/datos-emulador al salir.
//   node scripts/emuladores.mjs --e2e    pruebas e2e: firebase.pruebas.json (Auth 9098, Firestore 8086),
//                                        siembra con horarioEstricto false, edge-simulado 8787 y
//                                        Vite --mode e2e en 5176. Sin datos persistentes.
//
// Orden: comprueba los puertos, arranca Auth y Firestore, siembra (scripts/sembrar.mjs, WP3),
// levanta tests/e2e/edge-simulado.mjs y por último Vite. Al salir termina todo el árbol de
// procesos (en Windows con taskkill /T, para no dejar el java del emulador huérfano).
//
// Este archivo también exporta las utilidades que usa scripts/con-emuladores.mjs.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer as crearServidorRed } from 'node:net';
import { pathToFileURL } from 'node:url';

export const PROYECTO_DEMO = 'demo-conecta-tp5';

export const PERFILES = {
  desarrollo: {
    config: 'firebase.json',
    modoVite: 'emulador',
    puertos: { auth: 9099, firestore: 8085, websocketFirestore: 9150, ui: 4005, hub: 4405, logging: 4505, edge: 8787, vite: 5175 },
  },
  e2e: {
    config: 'firebase.pruebas.json',
    modoVite: 'e2e',
    puertos: { auth: 9098, firestore: 8086, websocketFirestore: 9151, hub: 4406, logging: 4506, edge: 8787, vite: 5176 },
  },
};

export function rutaCliFirebase() {
  const local = resolve('node_modules/firebase-tools/lib/bin/firebase.js');
  if (existsSync(local)) return local;
  const global = process.env.APPDATA ? join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/bin/firebase.js') : '';
  if (global && existsSync(global)) return global;
  throw new Error('No encontré la CLI de Firebase. Corré "npm install" (firebase-tools está en devDependencies).');
}

const JAVA_21_WINDOWS = 'C:/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot';

// El emulador de Firestore exige Java 21 y la máquina también tiene el JDK 17 de Android.
export function entornoConJava21(base = process.env) {
  const entorno = { ...base };
  const java = base.JAVA_21_HOME || JAVA_21_WINDOWS;
  if (process.platform === 'win32' && existsSync(java)) {
    entorno.JAVA_HOME = java;
    const clavePath = Object.keys(entorno).find((k) => k.toUpperCase() === 'PATH') || 'PATH';
    entorno[clavePath] = join(java, 'bin') + ';' + (entorno[clavePath] || '');
  }
  return entorno;
}

export function puertoLibre(puerto, host = '127.0.0.1') {
  return new Promise((resolver) => {
    const servidor = crearServidorRed();
    servidor.once('error', () => resolver(false));
    servidor.once('listening', () => servidor.close(() => resolver(true)));
    servidor.listen(puerto, host);
  });
}

export async function puertosOcupados(puertos) {
  const ocupados = [];
  for (const [nombre, puerto] of Object.entries(puertos)) {
    if (!(await puertoLibre(puerto))) ocupados.push(`${nombre} (${puerto})`);
  }
  return ocupados;
}

// child.kill() en Windows no llega a los nietos (el java del emulador): se usa taskkill /T.
export function terminarArbol(hijo) {
  if (!hijo || hijo.exitCode !== null || hijo.signalCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(hijo.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    hijo.kill('SIGTERM');
  }
}

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Espera a que el hub informe los emuladores pedidos.
export async function esperarEmuladores(puertoHub, nombres, limiteMs = 180_000) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) {
    try {
      const r = await fetch(`http://127.0.0.1:${puertoHub}/emulators`);
      const datos = await r.json();
      if (nombres.every((n) => datos[n])) return datos;
    } catch { /* todavía no arrancó */ }
    await esperar(750);
  }
  throw new Error('Los emuladores de Firebase no arrancaron a tiempo. Revisá la salida de la CLI.');
}

// Variables para firebase-admin y los scripts de Node que hablan con los emuladores.
export function entornoEmuladores(perfil) {
  return {
    ...process.env,
    GCLOUD_PROJECT: PROYECTO_DEMO,
    FIREBASE_PROJECT_ID: PROYECTO_DEMO,
    FIRESTORE_EMULATOR_HOST: `127.0.0.1:${perfil.puertos.firestore}`,
    FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${perfil.puertos.auth}`,
    PUERTO_EDGE: String(perfil.puertos.edge),
  };
}

function correrNode(args, entorno) {
  return new Promise((resolver, rechazar) => {
    const hijo = spawn(process.execPath, args, { stdio: 'inherit', env: entorno });
    hijo.on('error', rechazar);
    hijo.on('exit', (codigo) => (codigo === 0 ? resolver() : rechazar(new Error(`"node ${args.join(' ')}" terminó con código ${codigo}.`))));
  });
}

async function principal() {
  const e2e = process.argv.includes('--e2e');
  const perfil = e2e ? PERFILES.e2e : PERFILES.desarrollo;
  const cli = rutaCliFirebase();
  const datos = '.firebase/datos-emulador';

  const ocupados = await puertosOcupados(perfil.puertos);
  if (ocupados.length) {
    console.error(`Puertos ocupados: ${ocupados.join(', ')}.`);
    console.error('Probablemente quedó otra instancia abierta (emulador, java o vite). Cerrala y volvé a intentar.');
    process.exit(1);
  }

  const argsEmulador = [cli, 'emulators:start', '--only', 'auth,firestore', '--project', PROYECTO_DEMO, '--config', perfil.config];
  if (!e2e) {
    mkdirSync('.firebase', { recursive: true });
    argsEmulador.push('--export-on-exit', datos);
    if (existsSync(join(datos, 'firebase-export-metadata.json'))) argsEmulador.push('--import', datos);
  }
  const emulador = spawn(process.execPath, argsEmulador, { stdio: 'inherit', env: entornoConJava21() });
  let edge = null;
  let vite = null;
  let cerrando = false;

  const salioEmulador = new Promise((r) => emulador.once('exit', r));

  // Con Ctrl+C en la consola la señal llega también a la CLI, que exporta los datos y se cierra
  // sola: se la espera un rato antes de cortar el árbol. Con SIGTERM (Playwright) se corta enseguida.
  async function cerrar(codigo = 0, esperaMs = 0) {
    if (cerrando) return;
    cerrando = true;
    try { await vite?.close(); } catch { /* ya estaba cerrado */ }
    terminarArbol(edge);
    if (esperaMs && emulador.exitCode === null) await Promise.race([salioEmulador, esperar(esperaMs)]);
    terminarArbol(emulador);
    process.exit(codigo);
  }
  process.on('SIGINT', () => cerrar(0, e2e ? 5_000 : 30_000));
  process.on('SIGTERM', () => cerrar(0));
  process.on('SIGHUP', () => cerrar(0));
  emulador.on('exit', (codigo) => {
    if (!cerrando) {
      console.error(`Los emuladores se detuvieron (código ${codigo}).`);
      cerrar(1);
    }
  });

  try {
    await esperarEmuladores(perfil.puertos.hub, ['auth', 'firestore']);
    const entorno = entornoEmuladores(perfil);

    if (existsSync('scripts/sembrar.mjs')) {
      await correrNode(['scripts/sembrar.mjs', '--emulador', ...(e2e ? ['--e2e'] : [])], entorno);
    } else {
      console.warn('Aviso: falta scripts/sembrar.mjs (WP3); los emuladores arrancan vacíos.');
    }

    if (existsSync('tests/e2e/edge-simulado.mjs')) {
      edge = spawn(process.execPath, ['tests/e2e/edge-simulado.mjs'], { stdio: 'inherit', env: entorno });
      edge.on('exit', (codigo) => { if (!cerrando) { console.error(`edge-simulado se detuvo (código ${codigo}).`); cerrar(1); } });
    } else {
      console.warn('Aviso: falta tests/e2e/edge-simulado.mjs; las llamadas a Supabase van a fallar.');
    }

    const { createServer } = await import('vite');
    vite = await createServer({ mode: perfil.modoVite, server: { port: perfil.puertos.vite, strictPort: true } });
    await vite.listen();
    vite.printUrls();
    console.log(`Emuladores listos (proyecto ${PROYECTO_DEMO}). Auth ${perfil.puertos.auth}, Firestore ${perfil.puertos.firestore}` +
      (e2e ? '.' : `, interfaz http://127.0.0.1:${perfil.puertos.ui}.`) + ' Ctrl+C para salir.');
  } catch (e) {
    console.error(e.message);
    await cerrar(1);
  }
}

const ejecutadoDirecto = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (ejecutadoDirecto) await principal();
