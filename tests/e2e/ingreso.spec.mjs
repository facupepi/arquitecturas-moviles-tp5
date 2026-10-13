// Ingreso (S1, secciones 8.1 y 10.3): solo con Google (no hay acceso anónimo). Leyenda visible,
// privacidad breve, sin opción de invitado; Google con el widget del emulador de Auth, datos semilla
// visibles y las notificaciones de vencimiento de T-1001 y T-0999 sin esperar a la tarea diaria;
// error de ingreso junto al botón; columna centrada; una sesión anónima guardada por la versión
// anterior se cierra; instalación de la PWA; revisión de accesibilidad.
import { test, expect, esperarListo } from './fixtures.mjs';
import { revisarAccesibilidad } from './accesibilidad.mjs';

const uidActual = (page) => page.evaluate(async () => (await import('/src/firebase/auth.js')).auth.currentUser?.uid ?? null);

async function abrirIngreso(page) {
  await page.goto('/');
  await expect(page.getByTestId('pantalla-ingreso')).toBeVisible({ timeout: 30_000 });
}

/** Completa el popup de Google del emulador de Auth creando una cuenta nueva. */
async function cuentaNuevaEnPopup(popup, { email, nombre }) {
  await popup.waitForLoadState();
  await popup.locator('#add-account-button').click();
  await popup.locator('#email-input').fill(email);
  await popup.locator('#display-name-input').fill(nombre);
  await popup.locator('#sign-in').click();
}

test.describe('Ingreso', () => {
  test('solo ofrece Google: nota académica, privacidad y ningún ingreso como invitado', async ({ page }) => {
    await abrirIngreso(page);
    await expect(page.getByTestId('leyenda-prototipo')).toHaveCount(0);
    await expect(page.getByTestId('nota-academica')).toHaveText('Proyecto académico UTN FRSF');
    await expect(page.getByTestId('pantalla-ingreso')).not.toContainText(/prototipo|demostración|simulad/i);
    await expect(page.getByTestId('ingresar-google')).toBeVisible();
    await expect(page.getByTestId('ingresar-google')).toContainText('Continuar con Google');
    await expect(page.getByTestId('ingresar-invitado')).toHaveCount(0);
    await expect(page.getByTestId('pantalla-ingreso')).not.toContainText(/invitado|sin cuenta|no necesitás cuenta/i);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu ciudad, a un toque.');
    const privacidad = page.getByTestId('privacidad-breve');
    await expect(privacidad).toContainText('Tu ubicación nunca se guarda');
    await expect(privacidad).toContainText('Ley 25.326');
    await revisarAccesibilidad(page, 'ingreso');
  });

  test('continuar con Google entra con una cuenta nueva, con sus datos y avisos de vencimiento', async ({ page, adminAuth, adminDb }, info) => {
    await abrirIngreso(page);
    const sufijo = `${Date.now()}-${info.project.name.replace(/\W+/g, '')}`;
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByTestId('ingresar-google').click()]);
    await cuentaNuevaEnPopup(popup, { email: `s1-ingreso-${sufijo}@ejemplo.test`, nombre: 'Vecina Google' });
    await esperarListo(page);
    const uid = await uidActual(page);
    expect(uid).toBeTruthy();
    try {
      await expect(page.getByTestId('pantalla-ingreso')).toHaveCount(0);
      await expect(page.getByTestId('leyenda-prototipo')).toHaveCount(0);

      // Las notificaciones de vencimiento las crea vecino/alta en el momento (T4), sin la tarea diaria.
      await expect.poll(async () => {
        const snap = await adminDb.collection(`usuarios/${uid}/notificaciones`).get();
        return snap.docs.map((d) => d.id).filter((id) => /^tributo-T-(1001|0999)-/.test(id)).length;
      }, { timeout: 5_000 }).toBe(2);
      await expect(page.getByTestId('insignia-no-leidas')).toBeVisible({ timeout: 5_000 });
      expect((await adminDb.doc(`usuarios/${uid}`).get()).get('anonimo')).toBe(false);

      // Un vecino nuevo arranca solo con sus cedulones: 3 impagos, sin pagos ni reclamos, y 3
      // notificaciones (bienvenida y dos recordatorios).
      await page.evaluate(() => { window.location.hash = '#/cuenta'; });
      await expect(page.getByTestId('pantalla-cuenta')).toBeVisible();
      await expect(page.getByTestId('cuenta-tipo')).toContainText('Cuenta de Google');
      await expect(page.getByTestId('cuenta-nombre')).toContainText('Vecina Google');
      await expect(page.getByTestId('dato-tributos')).toContainText('3', { timeout: 5_000 });
      await expect(page.getByTestId('dato-pagos')).toContainText('0');
      await expect(page.getByTestId('dato-reclamos')).toContainText('0');
      await expect(page.getByTestId('dato-notificaciones')).toContainText('3', { timeout: 5_000 });
    } finally {
      await adminAuth.deleteUser(uid).catch(() => {});
    }
  });

  test('se adapta a 360 px sin desborde y deja el botón de Google a la vista', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await abrirIngreso(page);
    const anchos = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(anchos[0]).toBeLessThanOrEqual(anchos[1]);
    await expect(page.getByTestId('ingresar-google')).toBeInViewport();
  });

  test('en escritorio es una sola columna centrada', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrirIngreso(page);
    const caja = await page.getByRole('main').boundingBox();
    expect(caja.width).toBeGreaterThanOrEqual(420);
    expect(caja.width).toBeLessThanOrEqual(500);
    // Centrada en horizontal (±2 px) y con aire parejo arriba y abajo.
    expect(Math.abs(caja.x + caja.width / 2 - 720)).toBeLessThanOrEqual(2);
    const arriba = caja.y;
    const abajo = 900 - (caja.y + caja.height);
    expect(Math.abs(arriba - abajo)).toBeLessThanOrEqual(40);
    // El botón de Google queda dentro de la misma columna.
    const boton = await page.getByTestId('ingresar-google').boundingBox();
    expect(boton.x).toBeGreaterThanOrEqual(caja.x);
    expect(boton.x + boton.width).toBeLessThanOrEqual(caja.x + caja.width);
  });

  test('si se cierra la ventana de Google, el error aparece debajo del botón', async ({ page }) => {
    await abrirIngreso(page);
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByTestId('ingresar-google').click()]);
    await popup.waitForLoadState();
    await popup.close();
    const error = page.getByTestId('error-ingreso');
    await expect(error).toBeVisible({ timeout: 15_000 });
    await expect(error).toContainText('Cerraste la ventana de Google');
    // Junto al botón, no arriba de la página.
    const cajaBoton = await page.getByTestId('ingresar-google').boundingBox();
    const cajaError = await error.boundingBox();
    expect(cajaError.y).toBeGreaterThan(cajaBoton.y);
    expect(cajaError.y - (cajaBoton.y + cajaBoton.height)).toBeLessThanOrEqual(24);
    await expect(page.getByTestId('ingresar-google')).toBeEnabled();
    await revisarAccesibilidad(page, 'ingreso-error');
  });

  test('una sesión anónima guardada por la versión anterior se cierra y vuelve al ingreso', async ({ page }) => {
    await abrirIngreso(page);
    // Una sesión anónima como la que dejaba "Entrar como invitado": se crea con el mismo módulo de
    // Firebase Auth que usa la app (el de Vite), sobre la instancia auth de src/firebase/auth.js.
    const resultado = await page.evaluate(async () => {
      const { auth } = await import('/src/firebase/auth.js');
      const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /\/firebase_auth\.js/.test(n));
      const sdk = await import(url);
      const credencial = await sdk.signInAnonymously(auth);
      return { anonimo: credencial.user.isAnonymous };
    });
    expect(resultado.anonimo).toBe(true);
    // La app no la acepta: cierra la sesión y sigue en Ingreso.
    await expect.poll(() => uidActual(page), { timeout: 10_000 }).toBeNull();
    await expect(page.getByTestId('pantalla-ingreso')).toBeVisible();
    await expect(page.locator('html[data-listo="true"]')).toHaveCount(0);
  });

  test('ofrece instalar la app cuando el navegador lo permite', async ({ page }) => {
    await abrirIngreso(page);
    // Sin evento del navegador: instrucciones (Safari de iPhone o menú del navegador).
    await expect(page.getByTestId(/^instalacion-(ios|manual)$/)).toBeVisible();
    // El navegador ofrece la instalación (beforeinstallprompt simulado).
    await page.evaluate(() => {
      const evento = new Event('beforeinstallprompt', { cancelable: true });
      evento.prompt = async () => { window.__promptLlamado = true; };
      evento.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
      window.dispatchEvent(evento);
    });
    await page.getByTestId('instalar-app').click();
    await expect(page.getByTestId('instalacion-lista')).toBeVisible();
    expect(await page.evaluate(() => window.__promptLlamado === true)).toBe(true);
  });
});
