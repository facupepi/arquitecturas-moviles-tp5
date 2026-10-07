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
import { defineConfig, devices } from '@playwright/test';

const conPwa = process.env.E2E_PWA === '1';
const enCi = !!process.env.CI;

const comunes = {
  baseURL: 'http://127.0.0.1:5176',
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
  outputDir: 'test-results',
  reporter: [['list'], ['junit', { outputFile: 'docs/pruebas/e2e-junit.xml' }]],
  use: comunes,
  projects: [
    { name: 'Pixel 7', testIgnore: '**/pwa.spec.mjs', use: { ...devices['Pixel 7'], ...comunes } },
    { name: 'iPhone 13', testIgnore: '**/pwa.spec.mjs', use: { ...devices['iPhone 13'], ...comunes } },
    ...(conPwa
      ? [{ name: 'pwa', testMatch: '**/pwa.spec.mjs', use: { ...devices['Pixel 7'], ...comunes, baseURL: 'http://127.0.0.1:4176' } }]
      : []),
  ],
  webServer: [
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
