// Pruebas extremo a extremo (WP1, sección 10.3).
//
// Corren contra Vite en modo e2e (5176) con los emuladores de prueba (Auth 9098, Firestore 8086),
// la siembra de horarioEstricto false y tests/e2e/edge-simulado.mjs (8787). Todo lo levanta
// "node scripts/emuladores.mjs --e2e" como webServer.
//
// Proyectos: Pixel 7 (Chromium) e iPhone 13 (WebKit). Desktop Firefox solo corre en la prueba de
// humo (playwright.humo.config.mjs, WI).
//
// La prueba de PWA (tests/e2e/pwa.spec.mjs, WI) necesita el build: se activa con E2E_PWA=1, que
// agrega un segundo servidor (vite build --mode e2e y vite preview en 4176) y el proyecto "pwa".
//
// Modo compartido (fase de pantallas, varios agentes en paralelo; ver scripts/emuladores.mjs):
//   E2E_AGENTE=s3        URL base http://127.0.0.1:5203, sin webServer, resultados en test-results/s3/.
//                        Lo pone "npm run e2e:agente -- s3 …" (node scripts/emuladores.mjs --playwright s3 …).
//   E2E_URL_BASE=<url>   pisa la URL base (con o sin agente).
//   E2E_SIN_SERVIDOR=1   no levanta webServer (los emuladores y Vite ya están corriendo).
import { defineConfig, devices } from '@playwright/test';
import { agenteE2E } from './scripts/emuladores.mjs';

const conPwa = process.env.E2E_PWA === '1';
const enCi = !!process.env.CI;
const agente = process.env.E2E_AGENTE ? agenteE2E(process.env.E2E_AGENTE) : null;
const sinServidor = !!agente || process.env.E2E_SIN_SERVIDOR === '1';
const urlBase = process.env.E2E_URL_BASE || agente?.urlVite || 'http://127.0.0.1:5176';
const salida = agente ? `test-results/${agente.nombre}` : 'test-results';

const comunes = {
  baseURL: urlBase,
  locale: 'es-AR',
  timezoneId: 'America/Argentina/Cordoba',
  serviceWorkers: 'allow',
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
};

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.mjs',
  // Los specs comparten el catálogo de los emuladores (el admin mueve bicicletas y activa alarmas):
  // se corren de a uno para que no se pisen.
  fullyParallel: false,
  workers: 1,
  retries: enCi ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: enCi,
  outputDir: salida,
  // Con agente, el junit queda en su carpeta: docs/pruebas/e2e-junit.xml es de la corrida completa.
  reporter: [['list'], ['junit', { outputFile: agente ? `${salida}/e2e-junit.xml` : 'docs/pruebas/e2e-junit.xml' }]],
  use: comunes,
  projects: [
    { name: 'Pixel 7', testIgnore: '**/pwa.spec.mjs', use: { ...devices['Pixel 7'], ...comunes } },
    { name: 'iPhone 13', testIgnore: '**/pwa.spec.mjs', use: { ...devices['iPhone 13'], ...comunes } },
    ...(conPwa
      ? [{ name: 'pwa', testMatch: '**/pwa.spec.mjs', use: { ...devices['Pixel 7'], ...comunes, baseURL: 'http://127.0.0.1:4176' } }]
      : []),
  ],
  webServer: sinServidor ? undefined : [
    {
      command: 'node scripts/emuladores.mjs --e2e',
      url: 'http://127.0.0.1:5176',
      reuseExistingServer: !enCi,
      timeout: 300_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    ...(conPwa
      ? [{
        command: 'npx vite build --mode e2e --outDir dist-e2e && npx vite preview --mode e2e --outDir dist-e2e --port 4176 --strictPort',
        url: 'http://127.0.0.1:4176',
        reuseExistingServer: !enCi,
        timeout: 900_000,
      }]
      : []),
  ],
});
