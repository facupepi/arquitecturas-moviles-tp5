// Prueba de humo contra la URL publicada (WI, sección 10.4).
//
//   npm run test:humo
//
// Corre tests/humo/publicado.spec.mjs contra https://san-francisco-conecta-tp5.web.app en los dos
// perfiles de celular de las pruebas e2e (Pixel 7 con Chromium, iPhone 13 con WebKit) y en los tres
// motores de escritorio (Chromium, Firefox y WebKit). No levanta ningún servidor: prueba lo publicado.
//
// Variables opcionales:
//   HUMO_URL_BASE       pisa la URL base (por ejemplo, el canal de vista previa de Hosting).
//   HUMO_SUPABASE_URL   pisa la URL de Supabase (por defecto, el proyecto de producción).
//   APPCHECK_TOKEN_HUMO token de depuración de App Check registrado en la consola de Firebase. Nunca
//                       se versiona: un navegador sin interfaz puede sacar un puntaje bajo de reCAPTCHA.
//
// Solo prueba lo público (la app solo admite cuentas de Google): no ingresa, no crea usuarios ni
// escribe nada en producción.
import { defineConfig, devices } from '@playwright/test';

export const URL_BASE = process.env.HUMO_URL_BASE || 'https://san-francisco-conecta-tp5.web.app';
const salida = 'test-results/humo';

const comunes = {
  baseURL: URL_BASE,
  locale: 'es-AR',
  timezoneId: 'America/Argentina/Cordoba',
  serviceWorkers: 'allow',
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
};

export default defineConfig({
  testDir: 'tests/humo',
  testMatch: '**/*.spec.mjs',
  // Los proyectos corren en paralelo; las pruebas de un mismo proyecto van en orden.
  fullyParallel: false,
  workers: 3,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  forbidOnly: !!process.env.CI,
  outputDir: salida,
  reporter: [['list'], ['json', { outputFile: `${salida}/resultados.json` }]],
  use: comunes,
  projects: [
    { name: 'Pixel 7', use: { ...devices['Pixel 7'], ...comunes } },
    { name: 'iPhone 13', use: { ...devices['iPhone 13'], ...comunes } },
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'], ...comunes } },
    { name: 'Desktop Firefox', use: { ...devices['Desktop Firefox'], ...comunes } },
    { name: 'Desktop Safari', use: { ...devices['Desktop Safari'], ...comunes } },
  ],
});
