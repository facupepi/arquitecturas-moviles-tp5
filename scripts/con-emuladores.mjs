// Corre un comando con los emuladores de prueba (WP1, sección 10.2).
//
//   node scripts/con-emuladores.mjs "node --test --test-concurrency=1 tests/reglas/"
//   node scripts/con-emuladores.mjs --con-auth "<comando>"     también levanta Auth (9098)
//
// Envuelve "firebase emulators:exec" con firebase.pruebas.json (Firestore 8086; la CLI no acepta
// puertos por bandera), el proyecto demo-conecta-tp5 y Java 21. El comando recibe
// FIRESTORE_EMULATOR_HOST (y FIREBASE_AUTH_EMULATOR_HOST) de la propia CLI.
import { spawn } from 'node:child_process';
import { PERFILES, PROYECTO_DEMO, rutaCliFirebase, entornoConJava21, puertosOcupados, terminarArbol } from './emuladores.mjs';

const args = process.argv.slice(2);
const conAuth = args.includes('--con-auth');
const comando = args.filter((a) => a !== '--con-auth').join(' ').trim();
if (!comando) {
  console.error('Uso: node scripts/con-emuladores.mjs [--con-auth] "<comando>"');
  process.exit(2);
}

const perfil = PERFILES.e2e;
const necesarios = conAuth
  ? { firestore: perfil.puertos.firestore, auth: perfil.puertos.auth, hub: perfil.puertos.hub, logging: perfil.puertos.logging }
  : { firestore: perfil.puertos.firestore, hub: perfil.puertos.hub, logging: perfil.puertos.logging };
const ocupados = await puertosOcupados(necesarios);
if (ocupados.length) {
  console.error(`Puertos ocupados: ${ocupados.join(', ')}. ¿Quedó corriendo otra prueba o "npm run test:e2e"?`);
  process.exit(1);
}

const hijo = spawn(process.execPath, [
  rutaCliFirebase(), 'emulators:exec',
  '--only', conAuth ? 'auth,firestore' : 'firestore',
  '--config', perfil.config,
  '--project', PROYECTO_DEMO,
  comando,
], { stdio: 'inherit', env: { ...entornoConJava21(), GCLOUD_PROJECT: PROYECTO_DEMO } });

const cortar = () => { terminarArbol(hijo); process.exit(130); };
process.on('SIGINT', cortar);
process.on('SIGTERM', cortar);
hijo.on('error', (e) => { console.error(e.message); process.exitCode = 1; });
hijo.on('exit', (codigo) => { process.exitCode = codigo ?? 1; });
