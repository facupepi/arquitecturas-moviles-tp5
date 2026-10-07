// Mi cuenta (S1, secciones 8.2 y 10.3): el invitado que cierra sesión ve el diálogo; "Borrar mis
// datos y salir" vuelve a Ingreso y el usuario ya no existe en el emulador de Auth; borrado con
// confirmación; vincular con Google conserva el uid y los datos; cuenta de Google ya existente
// (popup y redirect); avisos del dispositivo, instalación, privacidad; accesibilidad.
import { test, expect, irA, uidGoogleFalso } from './fixtures.mjs';
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

function sufijoUnico(info) {
  return `${Date.now()}-${info.project.name.replace(/\W+/g, '').toLowerCase()}`;
}

test.describe('Mi cuenta', () => {
  test('el invitado que toca "Cerrar sesión" ve el diálogo y "Borrar mis datos y salir" borra todo', async ({ vecino, adminAuth, adminDb }) => {
    const { page, uid } = vecino;
    await abrirCuenta(page);
    await expect(page.getByTestId('cuenta-tipo')).toContainText('Cuenta de invitado');
    await expect(page.getByTestId('dato-tributos')).toContainText('4');
    await revisarAccesibilidad(page, 'cuenta');

    await page.getByTestId('cerrar-sesion').click();
    const d = await dialogo(page, 'dialogo-invitado-salir');
    await expect(d).toContainText('no vas a poder volver a esta cuenta');
    await expect(page.getByTestId('salir-vincular')).toBeVisible();
    await revisarAccesibilidad(page, 'cuenta-dialogo-invitado-salir');

    await page.getByTestId('salir-borrar').click();
    await expect(page.getByTestId('pantalla-ingreso')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('aviso-salida')).toContainText('Borramos tus datos');
    await usuarioBorrado(adminAuth, uid);
    expect((await adminDb.doc(`usuarios/${uid}`).get()).exists).toBe(false);
    expect((await adminDb.collection(`usuarios/${uid}/tributos`).get()).size).toBe(0);
  });

  test('"Cerrar sesión" del menú de cuenta abre el mismo diálogo y se puede cancelar', async ({ vecino }) => {
    const { page } = vecino;
    await irA(page, '#/inicio');
    await page.getByTestId('boton-cuenta').click();
    await page.getByTestId('menu-cuenta-cerrar-sesion').click();
    await expect(page.getByTestId('pantalla-cuenta')).toBeVisible();
    await dialogo(page, 'dialogo-invitado-salir');
    await page.getByTestId('dialogo-invitado-salir-cerrar').click();
    await expect(page.getByTestId('dialogo-invitado-salir')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/cuenta');
    // Sigue con la sesión abierta.
    await expect(page.getByTestId('cuenta-tipo')).toContainText('Cuenta de invitado');
  });

  test('"Borrar mis datos" pide confirmación antes de borrar', async ({ vecino, adminAuth }) => {
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
    await usuarioBorrado(adminAuth, uid);
  });

  test('vincular con Google conserva el uid y los datos del invitado', async ({ vecino, adminAuth, adminDb }, info) => {
    const { page, uid } = vecino;
    await abrirCuenta(page);
    await expect(page.getByTestId('dato-tributos')).toContainText('4');
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByTestId('vincular-google').click()]);
    await popup.waitForLoadState();
    await popup.locator('#add-account-button').click();
    await popup.locator('#email-input').fill(`s1-vinculo-${sufijoUnico(info)}@ejemplo.test`);
    await popup.locator('#display-name-input').fill('Vecino Vinculado');
    await popup.locator('#sign-in').click();

    // La tarjeta cambia sola (onIdTokenChanged) y el uid es el mismo.
    await expect(page.getByTestId('cuenta-tipo')).toContainText('Cuenta de Google', { timeout: 15_000 });
    // Muestra el correo de la cuenta vinculada (el nombre depende de que Auth copie el displayName).
    await expect(page.getByTestId('cuenta-perfil')).toContainText('s1-vinculo-');
    expect(await uidActual(page)).toBe(uid);
    await expect(page.getByTestId('vincular-google')).toHaveCount(0);
    await expect(page.getByTestId('dato-tributos')).toContainText('4');
    await expect(page.getByTestId('dato-reclamos')).toContainText('1');
    await expect.poll(async () => (await adminDb.doc(`usuarios/${uid}`).get()).get('anonimo'), { timeout: 10_000 }).toBe(false);
    await revisarAccesibilidad(page, 'cuenta-google');

    // Con cuenta de Google, "Cerrar sesión" sale directo (sin el diálogo del invitado).
    await page.getByTestId('cerrar-sesion').click();
    await expect(page.getByTestId('pantalla-ingreso')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('aviso-salida')).toContainText('Cerraste la sesión');
    await adminAuth.deleteUser(uid).catch(() => {});
  });

  test('si la cuenta de Google ya existe, avisa que se borran los datos del invitado y entra con ella', async ({ vecino, adminAuth }, info) => {
    const { page, uid } = vecino;
    const sub = `s1-existente-${sufijoUnico(info)}`;
    const uidGoogle = await uidGoogleFalso(sub, 'Cuenta Existente');
    try {
      await abrirCuenta(page);
      const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByTestId('vincular-google').click()]);
      await popup.waitForLoadState();
      await popup.locator(`li.js-reuse-account[data-id-token*="${sub}"]`).click();

      const d = await dialogo(page, 'dialogo-cuenta-existente');
      await expect(d).toContainText('se va a borrar');
      await revisarAccesibilidad(page, 'cuenta-dialogo-cuenta-existente');
      await page.getByTestId('confirmar-cuenta-existente').click();

      await expect(page.getByTestId('cuenta-tipo')).toContainText('Cuenta de Google', { timeout: 20_000 });
      expect(await uidActual(page)).toBe(uidGoogle);
      await usuarioBorrado(adminAuth, uid);
    } finally {
      await adminAuth.deleteUser(uidGoogle).catch(() => {});
    }
  });

  test('después de un redirect, #/cuenta?vinculo=existente ofrece cambiar de cuenta', async ({ vecino }) => {
    const { page } = vecino;
    await abrirCuenta(page);
    // Lo que hace App.jsx cuando completarRedireccion devuelve cuentaExistente.
    await page.evaluate(async () => {
      const { guardarCredencialPendiente } = await import('/src/navegacion/vinculoPendiente.js');
      guardarCredencialPendiente({ providerId: 'google.com', simulada: true });
      window.location.hash = '#/cuenta?vinculo=existente';
    });
    await dialogo(page, 'dialogo-cuenta-existente');
    await expect(page.getByTestId('confirmar-cuenta-existente')).toBeEnabled();
    await page.getByTestId('seguir-invitado').click();
    await expect(page.getByTestId('dialogo-cuenta-existente')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/cuenta');
    const pendiente = await page.evaluate(async () => (await import('/src/navegacion/vinculoPendiente.js')).leerCredencialPendiente());
    expect(pendiente).toBeNull();
    await expect(page.getByTestId('cuenta-tipo')).toContainText('Cuenta de invitado');
  });

  test('avisos del dispositivo, instalación y privacidad', async ({ vecino, adminDb }) => {
    const { page, uid } = vecino;
    await abrirCuenta(page);

    // Avisos: con emuladores el push no está disponible y se explica por qué.
    const interruptor = page.getByTestId('cuenta-interruptor-push');
    await expect(interruptor).toHaveAttribute('aria-checked', 'false');
    await expect(interruptor).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('cuenta-avisos')).toContainText('no están disponibles en esta demostración');

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
