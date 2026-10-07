// Ingreso (S1, secciones 8.1 y 10.3): leyenda visible, privacidad breve, entrar como invitado,
// datos semilla visibles y las notificaciones de vencimiento de T-1001 y T-0999 sin esperar a la
// tarea diaria; Google con el widget del emulador de Auth; error de ingreso junto a los botones;
// instalación de la PWA; revisión de accesibilidad.
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
  test('muestra la leyenda y la privacidad, y el invitado entra con sus datos y avisos de vencimiento', async ({ page, adminDb }) => {
    await abrirIngreso(page);
    await expect(page.getByTestId('leyenda-prototipo')).toBeVisible();
    await expect(page.getByTestId('leyenda-prototipo')).toContainText('Prototipo académico');
    await expect(page.getByTestId('ingresar-invitado')).toBeVisible();
    await expect(page.getByTestId('ingresar-google')).toBeVisible();
    const privacidad = page.getByTestId('privacidad-breve');
    await expect(privacidad).toContainText('Tu ubicación nunca se guarda');
    await expect(privacidad).toContainText('Ley 25.326');
    await revisarAccesibilidad(page, 'ingreso');

    await page.getByTestId('ingresar-invitado').click();
    await esperarListo(page);
    await expect(page.getByTestId('pantalla-ingreso')).toHaveCount(0);
    await expect(page.getByTestId('leyenda-prototipo')).toBeVisible();
    const uid = await uidActual(page);
    expect(uid).toBeTruthy();

    // Las notificaciones de vencimiento las crea vecino/alta en el momento (T4), sin la tarea diaria.
    await expect.poll(async () => {
      const snap = await adminDb.collection(`usuarios/${uid}/notificaciones`).get();
      return snap.docs.map((d) => d.id).filter((id) => /^tributo-T-(1001|0999)-/.test(id)).length;
    }, { timeout: 5_000 }).toBe(2);
    await expect(page.getByTestId('insignia-no-leidas')).toBeVisible({ timeout: 5_000 });

    // Datos semilla visibles en Mi cuenta (4 cedulones, 1 pago, 1 reclamo y 3 notificaciones).
    await page.evaluate(() => { window.location.hash = '#/cuenta'; });
    await expect(page.getByTestId('pantalla-cuenta')).toBeVisible();
    await expect(page.getByTestId('dato-tributos')).toContainText('4', { timeout: 5_000 });
    await expect(page.getByTestId('dato-pagos')).toContainText('1');
    await expect(page.getByTestId('dato-reclamos')).toContainText('1');
    await expect(page.getByTestId('dato-notificaciones')).toContainText('3', { timeout: 5_000 });
  });

  test('se adapta a 360 px sin desborde y deja los botones a la vista', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await abrirIngreso(page);
    const anchos = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(anchos[0]).toBeLessThanOrEqual(anchos[1]);
    await expect(page.getByTestId('ingresar-invitado')).toBeInViewport();
    await expect(page.getByTestId('ingresar-google')).toBeInViewport();
  });

  test('si se cierra la ventana de Google, el error aparece debajo de los botones', async ({ page }) => {
    await abrirIngreso(page);
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByTestId('ingresar-google').click()]);
    await popup.waitForLoadState();
    await popup.close();
    const error = page.getByTestId('error-ingreso');
    await expect(error).toBeVisible({ timeout: 15_000 });
    await expect(error).toContainText('Cerraste la ventana de Google');
    // Debajo de los botones, no arriba de la página.
    const cajaBoton = await page.getByTestId('ingresar-google').boundingBox();
    const cajaError = await error.boundingBox();
    expect(cajaError.y).toBeGreaterThan(cajaBoton.y);
    await expect(page.getByTestId('ingresar-invitado')).toBeEnabled();
    await revisarAccesibilidad(page, 'ingreso-error');
  });

  test('continuar con Google entra con una cuenta de Google', async ({ page, adminAuth }, info) => {
    await abrirIngreso(page);
    const sufijo = `${Date.now()}-${info.project.name.replace(/\W+/g, '')}`;
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByTestId('ingresar-google').click()]);
    await cuentaNuevaEnPopup(popup, { email: `s1-ingreso-${sufijo}@ejemplo.test`, nombre: 'Vecina Google' });
    await esperarListo(page);
    const uid = await uidActual(page);
    try {
      await page.evaluate(() => { window.location.hash = '#/cuenta'; });
      await expect(page.getByTestId('cuenta-tipo')).toContainText('Cuenta de Google');
      await expect(page.getByTestId('cuenta-nombre')).toContainText('Vecina Google');
    } finally {
      await adminAuth.deleteUser(uid).catch(() => {});
    }
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
