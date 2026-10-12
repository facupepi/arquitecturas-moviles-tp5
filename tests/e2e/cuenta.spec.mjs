// Mi cuenta (S1, secciones 8.2 y 10.3). Solo hay cuentas de Google (no hay invitados): la tarjeta
// lo muestra, "Cerrar sesión" (desde Cuenta o desde el menú del marco) vuelve a Ingreso con aviso y
// el usuario sigue existiendo; al volver a entrar con la misma cuenta están los mismos datos;
// borrado con confirmación que borra el usuario y sus datos; avisos del dispositivo, instalación,
// privacidad; accesibilidad.
import { test, expect, irA, entrarConGoogleFalso, NOMBRE_VECINO } from './fixtures.mjs';
import { revisarAccesibilidad } from './accesibilidad.mjs';

const uidActual = (page) => page.evaluate(async () => (await import('/src/firebase/auth.js')).auth.currentUser?.uid ?? null);

async function abrirCuenta(page) {
  await irA(page, '#/cuenta');
  await expect(page.getByTestId('pantalla-cuenta')).toBeVisible();
  await expect(page.getByTestId('cuenta-datos')).toBeVisible({ timeout: 15_000 });
}

/** Espera el diálogo (WebKit necesita [role="dialog"] antes de tocarlo) y lo devuelve. */
async function dialogo(page, testID) {
  await page.locator('[role="dialog"]').first().waitFor();
  const d = page.getByTestId(testID);
  await expect(d).toBeVisible();
  return d;
}

async function usuarioBorrado(adminAuth, uid) {
  await expect.poll(async () => {
    try {
      await adminAuth.getUser(uid);
      return 'existe';
    } catch (e) {
      return e?.code ?? e?.errorInfo?.code ?? 'error';
    }
  }, { timeout: 10_000 }).toBe('auth/user-not-found');
}

test.describe('Mi cuenta', () => {
  test('muestra la cuenta de Google sin nada de invitados y "Cerrar sesión" vuelve a Ingreso', async ({ vecino, adminAuth }) => {
    const { page, uid } = vecino;
    await abrirCuenta(page);
    await expect(page.getByTestId('cuenta-tipo')).toContainText('Cuenta de Google');
    await expect(page.getByTestId('cuenta-nombre')).toContainText(NOMBRE_VECINO);
    await expect(page.getByTestId('cuenta-perfil')).toContainText('@ejemplo.test');
    await expect(page.getByTestId('dato-tributos')).toContainText('4');
    await expect(page.getByTestId('vincular-google')).toHaveCount(0);
    await expect(page.getByTestId('pantalla-cuenta')).not.toContainText(/invitado/i);
    await revisarAccesibilidad(page, 'cuenta');

    await page.getByTestId('cerrar-sesion').click();
    await expect(page.getByTestId('pantalla-ingreso')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('aviso-salida')).toContainText('Cerraste la sesión');
    await expect.poll(() => uidActual(page)).toBeNull();
    // Cerrar sesión no borra la cuenta.
    expect((await adminAuth.getUser(uid)).uid).toBe(uid);
  });

  test('"Cerrar sesión" del menú de cuenta sale directo, y al volver con la misma cuenta están los datos', async ({ vecino }) => {
    const { page, uid, sub } = vecino;
    await irA(page, '#/inicio');
    await page.getByTestId('boton-cuenta').click();
    const menu = page.getByTestId('menu-cuenta');
    await expect(menu).toContainText(NOMBRE_VECINO);
    await expect(menu).not.toContainText(/invitado/i);
    await page.getByTestId('menu-cuenta-cerrar-sesion').click();
    await expect(page.getByTestId('pantalla-ingreso')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('aviso-salida')).toContainText('Cerraste la sesión');
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);

    // La misma cuenta de Google vuelve al mismo uid y a sus datos.
    expect(await entrarConGoogleFalso(page, sub, NOMBRE_VECINO)).toBe(uid);
    await abrirCuenta(page);
    await expect(page.getByTestId('dato-tributos')).toContainText('4');
    await expect(page.getByTestId('dato-reclamos')).toContainText('1');
  });

  test('"Borrar mis datos" pide confirmación y borra el usuario y sus datos', async ({ vecino, adminAuth, adminDb }) => {
    const { page, uid } = vecino;
    await abrirCuenta(page);
    await page.getByTestId('borrar-datos').click();
    await dialogo(page, 'dialogo-borrar');
    await revisarAccesibilidad(page, 'cuenta-dialogo-borrar');
    await page.getByTestId('cancelar-borrado').click();
    await expect(page.getByTestId('dialogo-borrar')).toHaveCount(0);
    expect((await adminAuth.getUser(uid)).uid).toBe(uid);

    await page.getByTestId('borrar-datos').click();
    await dialogo(page, 'dialogo-borrar');
    await page.getByTestId('confirmar-borrado').click();
    await expect(page.getByTestId('pantalla-ingreso')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('aviso-salida')).toContainText('Borramos tus datos');
    await usuarioBorrado(adminAuth, uid);
    expect((await adminDb.doc(`usuarios/${uid}`).get()).exists).toBe(false);
    expect((await adminDb.collection(`usuarios/${uid}/tributos`).get()).size).toBe(0);
  });

  test('avisos del dispositivo, instalación y privacidad', async ({ vecino, adminDb }) => {
    const { page, uid } = vecino;
    await abrirCuenta(page);

    // Avisos: con emuladores el push no está disponible y se explica por qué.
    const interruptor = page.getByTestId('cuenta-interruptor-push');
    await expect(interruptor).toHaveAttribute('aria-checked', 'false');
    await expect(interruptor).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('cuenta-avisos')).toContainText('no están disponibles');

    // Instalación: instrucciones y, cuando el navegador la ofrece, el botón.
    await expect(page.getByTestId('cuenta-instalar').getByTestId(/^instalacion-(ios|manual)$/)).toBeVisible();
    if (test.info().project.name === 'iPhone 13') {
      await expect(page.getByTestId('instalacion-ios')).toContainText('Agregar a inicio');
    }
    await page.evaluate(() => {
      const evento = new Event('beforeinstallprompt', { cancelable: true });
      evento.prompt = async () => {};
      evento.userChoice = new Promise(() => {});   // el vecino todavía no eligió
      window.dispatchEvent(evento);
    });
    await expect(page.getByTestId('instalar-app')).toBeVisible();
    await page.getByTestId('instalar-app').click();
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    await expect(page.getByTestId('instalacion-lista')).toBeVisible();

    // Privacidad: "Entendido" guarda la aceptación en el perfil.
    await expect(page.getByTestId('privacidad-completa')).toContainText('Ley 25.326');
    await page.getByTestId('aceptar-privacidad').click();
    await expect(page.getByTestId('privacidad-leida')).toBeVisible({ timeout: 10_000 });
    // La pantalla lo muestra con la escritura local; el servidor la recibe enseguida.
    await expect.poll(async () => !!(await adminDb.doc(`usuarios/${uid}`).get()).get('privacidadAceptadaEn'), { timeout: 10_000 }).toBe(true);

    // "Elegir qué avisos recibir" lleva a Notificaciones.
    await page.getByTestId('cuenta-preferencias-avisos').click();
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/notificaciones');
  });
});
