// Prueba de humo de la app publicada (WI, sección 10.4). Solo lo público: la app solo admite
// cuentas de Google y una prueba automática no puede (ni debe) entrar con una cuenta real, así que
// no crea usuarios ni escribe nada en producción.
//
// - La URL responde 200 por HTTPS con la pantalla estática y la nota académica, y carga sin errores graves.
// - Política de seguridad: CSP y encabezados de Hosting (solo contra Hosting, no en vite preview).
// - Ingreso: columna centrada con "Continuar con Google", privacidad breve y sin ingreso como invitado.
// - El manifiesto es válido (campos de 9.3 e íconos que responden).
// - El service worker queda activo ya en Ingreso y controla la página al recargar.
// - GET /functions/v1/tareas de Supabase devuelve ok.
import { test, expect } from '@playwright/test';
import { SUPABASE_URL, vigilarConsola, usuarioGuardado } from './ayudantes.mjs';

const TOKEN_APPCHECK = process.env.APPCHECK_TOKEN_HUMO || '';

function origenes(baseURL) {
  return [new URL(baseURL).origin, SUPABASE_URL];
}

async function prepararPagina(page) {
  if (TOKEN_APPCHECK) {
    await page.addInitScript((t) => { self.FIREBASE_APPCHECK_DEBUG_TOKEN = t; }, TOKEN_APPCHECK);
  }
}

const esLocal = (url) => ['127.0.0.1', 'localhost'].includes(new URL(url).hostname);

test.describe('Sitio publicado, sin sesión', () => {
  test('responde 200 por HTTPS con la pantalla estática, la nota académica y la pantalla de Ingreso', async ({ page, baseURL }) => {
    await prepararPagina(page);
    const errores = vigilarConsola(page, origenes(baseURL));
    const respuesta = await page.goto('/');
    expect(respuesta, 'respuesta de la navegación').not.toBeNull();
    expect(respuesta.status()).toBe(200);
    // HTTPS obligatorio; solo se acepta http en 127.0.0.1 o localhost (HUMO_URL_BASE sobre vite preview).
    const { protocol, hostname } = new URL(page.url());
    if (!['127.0.0.1', 'localhost'].includes(hostname)) expect(protocol).toBe('https:');
    expect(respuesta.headers()['content-type'] ?? '').toContain('text/html');

    // La pantalla estática de index.html (9.4) ya trae la nota académica, antes del JavaScript.
    const html = await respuesta.text();
    expect(html).toContain('Proyecto académico UTN FRSFCO');
    expect(html).not.toMatch(/Prototipo académico/);

    await expect(page.getByTestId('pantalla-ingreso')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('nota-academica')).toHaveText('Proyecto académico UTN FRSFCO');
    await expect(page.getByTestId('ingresar-google')).toBeVisible();
    // Sin desborde horizontal.
    const anchos = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(anchos[0]).toBeLessThanOrEqual(anchos[1]);
    expect(errores, 'errores de consola graves al cargar').toEqual([]);
  });

  test('la pantalla de Ingreso solo ofrece Google: no hay ingreso como invitado', async ({ page }) => {
    await prepararPagina(page);
    await page.goto('/');
    const ingreso = page.getByTestId('pantalla-ingreso');
    await expect(ingreso).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('ingresar-google')).toBeVisible();
    await expect(page.getByTestId('ingresar-google')).toContainText('Continuar con Google');
    await expect(page.getByTestId('ingresar-google')).toBeInViewport();
    // Nada de invitados: ni el botón ni textos que lo ofrezcan.
    await expect(page.getByTestId('ingresar-invitado')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /invitado/i })).toHaveCount(0);
    await expect(ingreso).not.toContainText(/invitado|no necesitás cuenta|sin cuenta/i);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu ciudad, a un toque.');
    await expect(page.getByTestId('privacidad-breve')).toContainText('Ley 25.326');
    // Sin sesión guardada: la prueba no ingresó con ninguna cuenta.
    expect(await usuarioGuardado(page)).toBeNull();
  });

  test('la política de seguridad de Hosting viaja en los encabezados', async ({ page, baseURL }) => {
    test.skip(esLocal(baseURL), 'vite preview no envía los encabezados de Hosting');
    await prepararPagina(page);
    const respuesta = await page.goto('/');
    const h = respuesta.headers();
    const csp = h['content-security-policy'] ?? '';
    expect(csp, 'Content-Security-Policy').toContain("default-src 'self'");
    expect(csp).toMatch(/script-src 'self'[^;]*https:\/\/apis\.google\.com/);
    // El popup de Google pasa por el dominio de Auth del proyecto.
    expect(csp).toMatch(/frame-src [^;]*firebaseapp\.com/);
    expect(csp).toMatch(/connect-src [^;]*\*\.supabase\.co/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('SAMEORIGIN');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['permissions-policy'] ?? '').toContain('microphone=()');
    if (new URL(baseURL).protocol === 'https:') expect(h['strict-transport-security'] ?? '').toContain('max-age=');
  });

  test('el manifiesto es válido y sus íconos responden', async ({ page, request, browserName, baseURL }) => {
    await prepararPagina(page);
    await page.goto('/');
    const enlace = page.locator('link[rel="manifest"]');
    await expect(enlace).toHaveCount(1);
    const href = await enlace.getAttribute('href');
    const urlManifiesto = new URL(href, page.url()).href;

    const r = await request.get(urlManifiesto);
    expect(r.status(), urlManifiesto).toBe(200);
    expect(r.headers()['content-type'] ?? '').toMatch(/application\/(manifest\+)?json/);
    const m = await r.json();
    expect(m.name).toBe('San Francisco Conecta');
    expect(m.short_name).toBe('SF Conecta');
    expect(m.lang).toBe('es-AR');
    expect(m.start_url).toBe('/#/inicio');
    expect(m.scope).toBe('/');
    expect(m.id).toBe('/');
    expect(m.display).toBe('standalone');
    expect(m.theme_color).toBe('#009ee2');
    expect(m.background_color).toBe('#f4f7fa');
    const tamanos = m.icons.map((i) => `${i.sizes}${i.purpose === 'maskable' ? ' maskable' : ''}`);
    expect(tamanos).toEqual(expect.arrayContaining(['192x192', '512x512', '512x512 maskable']));
    for (const icono of m.icons) {
      const ri = await request.get(new URL(icono.src, urlManifiesto).href);
      expect(ri.status(), icono.src).toBe(200);
      expect(ri.headers()['content-type'], icono.src).toBe('image/png');
    }
    expect(m.shortcuts.map((s) => s.url)).toEqual(['/#/reclamos/nuevo', '/#/estacionamiento', '/#/bicicletas']);

    // Chromium valida el manifiesto como lo haría para instalar la app.
    if (browserName === 'chromium') {
      const cdp = await page.context().newCDPSession(page);
      const { errors } = await cdp.send('Page.getAppManifest');
      expect(errors, 'errores del manifiesto según Chromium').toEqual([]);
    }
    expect(new URL(urlManifiesto).origin).toBe(new URL(baseURL).origin);
  });

  test('el service worker queda activo ya en Ingreso y controla la página al recargar', async ({ page, baseURL }) => {
    await prepararPagina(page);
    await page.goto('/');
    await expect(page.getByTestId('pantalla-ingreso')).toBeVisible({ timeout: 45_000 });
    const soportado = await page.evaluate(() => 'serviceWorker' in navigator);
    expect(soportado, 'el navegador expone navigator.serviceWorker').toBe(true);

    const registro = await page.evaluate(() => Promise.race([
      navigator.serviceWorker.ready.then((reg) => ({
        estado: reg.active?.state ?? null, script: reg.active?.scriptURL ?? null, alcance: reg.scope,
      })),
      new Promise((resolver) => setTimeout(() => resolver(null), 45_000)),
    ]));
    expect(registro, 'navigator.serviceWorker.ready en 45 s').not.toBeNull();
    expect(registro.script).toBe(new URL('/sw.js', baseURL).href);
    expect(registro.alcance).toBe(new URL('/', baseURL).href);
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state), { timeout: 30_000 }).toBe('activated');

    await page.reload();
    await expect(page.getByTestId('pantalla-ingreso')).toBeVisible({ timeout: 45_000 });
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  });

  test('GET /functions/v1/tareas de Supabase devuelve ok', async ({ request }) => {
    const r = await request.get(`${SUPABASE_URL}/functions/v1/tareas`);
    expect(r.status()).toBe(200);
    const cuerpo = await r.json();
    expect(cuerpo.ok).toBe(true);
  });
});
