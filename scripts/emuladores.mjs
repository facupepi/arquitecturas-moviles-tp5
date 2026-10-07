// Entorno local con emuladores (WP1).
//
//   node scripts/emuladores.mjs          desarrollo: Auth 9099, Firestore 8085, interfaz 4005,
//                                        edge-simulado 8787 y Vite --mode emulador en 5175.
//                                        Los datos se exportan a .firebase/datos-emulador al salir.
//   node scripts/emuladores.mjs --e2e    pruebas e2e: firebase.pruebas.json (Auth 9098, Firestore 8086),
//                                        siembra con horarioEstricto false, edge-simulado 8787 y
//                                        Vite --mode e2e en 5176. Sin datos persistentes.
//
// Modo compartido (fase de pantallas: varios agentes en paralelo contra un solo juego de emuladores):
//   node scripts/emuladores.mjs --compartido         Auth 9098, Firestore 8086 y edge-simulado 8787, SIN Vite.
//                                                    Siembra demo-conecta-tp5 y un proyecto por agente
//                                                    (demo-conecta-tp5-s1 … -s8). Queda encendido.
//   node scripts/emuladores.mjs --apagar             Apaga el modo compartido (pid de .firebase/compartido.json).
//   node scripts/emuladores.mjs --vite s3            Vite --mode e2e del agente s3 en 5203, contra los emuladores
//                                                    compartidos y el proyecto demo-conecta-tp5-s3.
//   node scripts/emuladores.mjs --apagar-vite s3     Cierra ese Vite (pid de .firebase/vite-s3.json o dueño node del puerto).
//   node scripts/emuladores.mjs --playwright s3 [argumentos de playwright test]
//                                                    Playwright con E2E_AGENTE=s3: URL base 5203 y sin webServer.
//   node scripts/emuladores.mjs --puertos            Qué proceso ocupa cada puerto de las pruebas.
//
// Orden: comprueba los puertos, arranca Auth y Firestore, siembra (scripts/sembrar.mjs, WP3),
// levanta tests/e2e/edge-simulado.mjs y por último Vite. Al salir termina todo el árbol de
// procesos (en Windows con taskkill /T, para no dejar el java del emulador huérfano).
//
// Este archivo también exporta las utilidades que usa scripts/con-emuladores.mjs.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

// Agentes de la fase de pantallas (11.2): cada uno con su puerto de Vite y su proyecto demo-* propio en
// los mismos emuladores. Los usuarios de Auth quedan todos en el proyecto por defecto (el SDK web no
// le manda el proyecto al emulador de Auth), pero Firestore queda separado por agente.
export const AGENTES_E2E = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];

export function agenteE2E(nombre) {
  const agente = String(nombre ?? '').trim().toLowerCase();
  if (!AGENTES_E2E.includes(agente)) {
    throw new Error(`Agente desconocido: "${nombre ?? ''}". Usá uno de ${AGENTES_E2E.join(', ')}.`);
  }
  const proyecto = `${PROYECTO_DEMO}-${agente}`;
  const puerto = 5200 + Number(agente.slice(1));
  return {
    nombre: agente,
    puerto,
    proyecto,
    urlVite: `http://127.0.0.1:${puerto}`,
    urlEdge: `http://127.0.0.1:${PERFILES.e2e.puertos.edge}/p/${proyecto}`,
    subAdmin: `admin-e2e-${agente}`,
  };
}

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

async function modoClasico() {
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

// ===================== Modo compartido =====================

const ESTADO_COMPARTIDO = '.firebase/compartido.json';
const estadoVite = (agente) => `.firebase/vite-${agente}.json`;

function leerEstado(ruta) {
  try { return JSON.parse(readFileSync(ruta, 'utf8')); } catch { return null; }
}

function escribirEstado(ruta, datos) {
  mkdirSync('.firebase', { recursive: true });
  writeFileSync(ruta, JSON.stringify(datos, null, 2));
}

function borrarEstado(ruta, pid) {
  const actual = leerEstado(ruta);
  if (actual && actual.pid === pid) rmSync(ruta, { force: true });
}

function procesoVivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

function matarPid(pid) {
  if (!procesoVivo(pid)) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  else { try { process.kill(pid, 'SIGTERM'); } catch { /* ya no estaba */ } }
}

// Dueño (pid) de cada puerto en escucha: netstat en Windows, lsof en el resto.
export function duenosDePuertos(puertos) {
  const duenos = new Map();
  if (process.platform === 'win32') {
    const salida = spawnSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' }).stdout ?? '';
    for (const linea of salida.split(/\r?\n/)) {
      // En escucha = dirección remota :0 (vale también con Windows en otro idioma, "ESCUCHANDO").
      const m = /^\s*TCP\s+\S+:(\d+)\s+(?:0\.0\.0\.0|\[::\]):0\s+\S+\s+(\d+)\s*$/i.exec(linea);
      if (m && puertos.includes(Number(m[1]))) duenos.set(Number(m[1]), Number(m[2]));
    }
  } else {
    for (const p of puertos) {
      const pid = Number((spawnSync('lsof', ['-nP', `-iTCP:${p}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' }).stdout ?? '').trim().split('\n')[0]);
      if (pid) duenos.set(p, pid);
    }
  }
  return duenos;
}

function nombreProceso(pid) {
  if (process.platform === 'win32') {
    const salida = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8' }).stdout ?? '';
    return (/^"([^"]+)"/.exec(salida.trim()) ?? [])[1] ?? '?';
  }
  return (spawnSync('ps', ['-p', String(pid), '-o', 'comm='], { encoding: 'utf8' }).stdout ?? '?').trim();
}

async function esperarPuertosLibres(puertos, limiteMs = 15_000) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) {
    if (!(await puertosOcupados(Object.fromEntries(puertos.map((p) => [p, p])))).length) return true;
    await esperar(500);
  }
  return false;
}

function informarPuertos(puertos) {
  const duenos = duenosDePuertos(puertos);
  for (const p of puertos) {
    const pid = duenos.get(p);
    console.log(pid ? `  ${p}: ocupado por pid ${pid} (${nombreProceso(pid)})` : `  ${p}: libre`);
  }
  if (duenos.size) {
    console.log(process.platform === 'win32'
      ? 'Para liberar uno que sea tuyo: Stop-Process -Id <pid> -Force (PowerShell) o taskkill //PID <pid> //T //F (Git Bash).'
      : 'Para liberar uno que sea tuyo: kill <pid>.');
  }
}

function puertosCompartidos() {
  const { auth, firestore, websocketFirestore, hub, logging, edge } = PERFILES.e2e.puertos;
  return { auth, firestore, websocketFirestore, hub, logging, edge };
}

async function modoCompartido() {
  const perfil = PERFILES.e2e;
  const puertos = puertosCompartidos();
  const previo = leerEstado(ESTADO_COMPARTIDO);
  if (previo && procesoVivo(previo.pid)) {
    console.error(`El modo compartido ya está encendido (pid ${previo.pid}). Para reiniciarlo, primero: npm run e2e:compartido:apagar`);
    process.exit(1);
  }
  const ocupados = await puertosOcupados(puertos);
  if (ocupados.length) {
    console.error(`Puertos ocupados: ${ocupados.join(', ')}. Mirá quién los usa con "npm run e2e:puertos".`);
    process.exit(1);
  }

  const cli = rutaCliFirebase();
  const emulador = spawn(process.execPath,
    [cli, 'emulators:start', '--only', 'auth,firestore', '--project', PROYECTO_DEMO, '--config', perfil.config],
    { stdio: 'inherit', env: entornoConJava21() });
  let edge = null;
  let cerrando = false;
  function cerrar(codigo = 0) {
    if (cerrando) return;
    cerrando = true;
    terminarArbol(edge);
    terminarArbol(emulador);
    borrarEstado(ESTADO_COMPARTIDO, process.pid);
    process.exit(codigo);
  }
  for (const senal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(senal, () => cerrar(0));
  emulador.on('exit', (codigo) => {
    if (!cerrando) { console.error(`Los emuladores se detuvieron (código ${codigo}).`); cerrar(1); }
  });

  try {
    await esperarEmuladores(perfil.puertos.hub, ['auth', 'firestore']);
    const base = entornoEmuladores(perfil);
    // Un proyecto demo-* por agente en el mismo emulador: el catálogo que mueve uno (bicicletas,
    // alarmas, municipal/config) no lo ve otro. Las reglas de firebase.pruebas.json valen para todos.
    const proyectos = [PROYECTO_DEMO, ...AGENTES_E2E.map((a) => agenteE2E(a).proyecto)];
    await Promise.all(proyectos.map((proyecto) => correrNode(['scripts/sembrar.mjs', '--emulador', '--e2e'],
      { ...base, GCLOUD_PROJECT: proyecto, FIREBASE_PROJECT_ID: proyecto })));

    edge = spawn(process.execPath, ['tests/e2e/edge-simulado.mjs'], { stdio: 'inherit', env: base });
    edge.on('exit', (codigo) => {
      if (!cerrando) { console.error(`edge-simulado se detuvo (código ${codigo}).`); cerrar(1); }
    });
    const limite = Date.now() + 30_000;
    for (;;) {
      try { if ((await fetch(`http://127.0.0.1:${puertos.edge}/functions/v1/tareas`)).ok) break; } catch { /* arrancando */ }
      if (Date.now() > limite) throw new Error('edge-simulado no respondió a tiempo.');
      await esperar(300);
    }

    escribirEstado(ESTADO_COMPARTIDO, { pid: process.pid, inicio: new Date().toISOString(), puertos, proyectos });
    console.log(`MODO COMPARTIDO LISTO (pid ${process.pid}). Auth ${puertos.auth}, Firestore ${puertos.firestore}, ` +
      `edge-simulado ${puertos.edge}. Proyectos: ${proyectos.join(', ')}. Para apagar: npm run e2e:compartido:apagar`);
  } catch (e) {
    console.error(e.message);
    cerrar(1);
  }
}

async function apagarCompartido() {
  const estado = leerEstado(ESTADO_COMPARTIDO);
  const puertos = Object.values(puertosCompartidos());
  if (estado?.pid && procesoVivo(estado.pid)) {
    matarPid(estado.pid);
    console.log(`Modo compartido (pid ${estado.pid}) cerrado.`);
  } else {
    console.log('No encontré un modo compartido encendido por este script.');
  }
  rmSync(ESTADO_COMPARTIDO, { force: true });
  if (await esperarPuertosLibres(puertos)) {
    console.log(`Puertos libres: ${puertos.join(', ')}.`);
    return;
  }
  console.log('Siguen ocupados:');
  informarPuertos(puertos);
  process.exitCode = 1;
}

async function compartidoActivo(agente) {
  try {
    const datos = await (await fetch(`http://127.0.0.1:${PERFILES.e2e.puertos.hub}/emulators`)).json();
    if (!datos.auth || !datos.firestore) return false;
    return (await fetch(`${agente.urlEdge}/functions/v1/tareas`)).ok;
  } catch {
    return false;
  }
}

async function viteAgente(nombre) {
  const agente = agenteE2E(nombre);
  if (!(await compartidoActivo(agente))) {
    console.error('El modo compartido no está encendido (emuladores 9098/8086 y edge-simulado 8787). ' +
      'Lo levanta el orquestador con "npm run e2e:compartido".');
    process.exit(1);
  }
  if (!(await puertoLibre(agente.puerto))) {
    console.error(`El puerto ${agente.puerto} está ocupado. Cerralo con "node scripts/emuladores.mjs --apagar-vite ${agente.nombre}".`);
    informarPuertos([agente.puerto]);
    process.exit(1);
  }
  // Las variables de process.env pisan a .env.e2e: este Vite usa el proyecto y el edge del agente.
  process.env.VITE_FIREBASE_PROJECT_ID = agente.proyecto;
  process.env.VITE_SUPABASE_URL = agente.urlEdge;
  const { createServer } = await import('vite');
  const vite = await createServer({
    mode: 'e2e',
    cacheDir: `node_modules/.vite-e2e-${agente.nombre}`, // un caché por agente: dos Vite no se pisan las dependencias
    server: { port: agente.puerto, strictPort: true, host: '127.0.0.1' },
    clearScreen: false,
  });
  await vite.listen();
  escribirEstado(estadoVite(agente.nombre), {
    pid: process.pid, puerto: agente.puerto, proyecto: agente.proyecto, inicio: new Date().toISOString(),
  });
  const cerrar = async () => {
    try { await vite.close(); } catch { /* ya cerrado */ }
    borrarEstado(estadoVite(agente.nombre), process.pid);
    process.exit(0);
  };
  for (const senal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(senal, cerrar);
  console.log(`VITE ${agente.nombre.toUpperCase()} LISTO en ${agente.urlVite} (proyecto ${agente.proyecto}, pid ${process.pid}). ` +
    `Para cerrarlo: node scripts/emuladores.mjs --apagar-vite ${agente.nombre}`);
}

async function apagarViteAgente(nombre) {
  const agente = agenteE2E(nombre);
  const estado = leerEstado(estadoVite(agente.nombre));
  if (estado?.pid && procesoVivo(estado.pid)) matarPid(estado.pid);
  rmSync(estadoVite(agente.nombre), { force: true });
  if (!(await esperarPuertosLibres([agente.puerto], 5_000))) {
    // Sin archivo de estado o con un pid viejo: se cierra el dueño del puerto solo si es node.
    const pid = duenosDePuertos([agente.puerto]).get(agente.puerto);
    const proceso = pid ? nombreProceso(pid) : '';
    if (pid && /^node(\.exe)?$/i.test(proceso)) matarPid(pid);
    else if (pid) {
      console.error(`El puerto ${agente.puerto} lo usa el pid ${pid} (${proceso}), que no es node: no lo cierro.`);
      process.exit(1);
    }
  }
  if (await esperarPuertosLibres([agente.puerto], 10_000)) console.log(`Vite de ${agente.nombre} cerrado; puerto ${agente.puerto} libre.`);
  else { informarPuertos([agente.puerto]); process.exitCode = 1; }
}

async function playwrightAgente(nombre, args) {
  const agente = agenteE2E(nombre);
  try {
    await fetch(agente.urlVite);
  } catch {
    console.error(`No responde ${agente.urlVite}. Levantá antes tu Vite: node scripts/emuladores.mjs --vite ${agente.nombre}`);
    process.exit(1);
  }
  const cli = resolve('node_modules/@playwright/test/cli.js');
  const hijo = spawn(process.execPath, [cli, 'test', '--config', 'playwright.config.mjs', ...args],
    { stdio: 'inherit', env: { ...process.env, E2E_AGENTE: agente.nombre } });
  hijo.on('exit', (codigo) => process.exit(codigo ?? 1));
}

async function principal() {
  const argv = process.argv.slice(2);
  const valor = (bandera) => argv[argv.indexOf(bandera) + 1];
  try {
    if (argv.includes('--compartido')) return await modoCompartido();
    if (argv.includes('--apagar')) return await apagarCompartido();
    if (argv.includes('--vite')) return await viteAgente(valor('--vite'));
    if (argv.includes('--apagar-vite')) return await apagarViteAgente(valor('--apagar-vite'));
    if (argv[0] === '--playwright') return await playwrightAgente(argv[1], argv.slice(2));
    if (argv.includes('--puertos')) {
      const puertos = [...new Set([...Object.values(PERFILES.e2e.puertos), ...AGENTES_E2E.map((a) => agenteE2E(a).puerto)])];
      const estado = leerEstado(ESTADO_COMPARTIDO);
      console.log(`Modo compartido: ${estado?.pid && procesoVivo(estado.pid) ? `encendido (pid ${estado.pid})` : 'apagado o sin archivo de estado'}`);
      return informarPuertos(puertos);
    }
    return await modoClasico();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

const ejecutadoDirecto = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (ejecutadoDirecto) await principal();
