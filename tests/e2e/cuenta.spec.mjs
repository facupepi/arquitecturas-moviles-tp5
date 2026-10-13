// Mi cuenta (S1, secciones 8.2 y 10.3). Solo hay cuentas de Google (no hay invitados): la tarjeta
// lo muestra, "Cerrar sesión" (desde Cuenta o desde el menú del marco) vuelve a Ingreso con aviso y
// el usuario sigue existiendo; al volver a entrar con la misma cuenta están los mismos datos;
// borrado con confirmación que borra el usuario y sus datos (también las tarjetas); medios de pago
// (agregar tarjeta con sus errores, tope de 5, quitar con confirmación, nunca el número completo en
// Firestore); avisos del dispositivo, instalación, privacidad; accesibilidad.
import {
  test, expect, irA, entrarConGoogleFalso, NOMBRE_VECINO, sembrarTarjeta, TARJETAS_PRUEBA,
} from './fixtures.mjs';
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
    // El vecino nuevo arranca solo con sus cedulones impagos (T-0999, T-1001 y T-1002).
    await expect(page.getByTestId('dato-tributos')).toHaveText(/3$/);
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
    await expect(page.getByTestId('dato-tributos')).toHaveText(/3$/);
    await expect(page.getByTestId('dato-reclamos')).toHaveText(/0$/);
  });

  test('"Borrar mis datos" pide confirmación y borra el usuario y sus datos', async ({ vecino, adminAuth, adminDb }) => {
    const { page, uid } = vecino;
    await sembrarTarjeta(adminDb, uid, TARJETAS_PRUEBA.debito);
    await abrirCuenta(page);
    await expect(page.getByTestId('tarjeta-guardada-tarjeta-1')).toBeVisible();
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
    expect((await adminDb.collection(`usuarios/${uid}/tarjetas`).get()).size).toBe(0);
  });

  test('medios de pago: agregar tarjeta con errores debajo de cada campo, tope de 5 y quitar con confirmación', async ({ vecino, adminDb }) => {
    const { page, uid } = vecino;
    await page.setViewportSize({ width: 360, height: 740 });
    await abrirCuenta(page);
    const seccion = page.getByTestId('cuenta-medios-pago');
    await expect(seccion.getByRole('heading', { name: 'Medios de pago' })).toBeVisible();
    await expect(page.getByTestId('sin-tarjetas')).toContainText('Todavía no guardaste tarjetas');
    await expect(page.getByTestId('nota-seguridad-tarjetas')).toHaveText('Guardamos solo los últimos 4 dígitos. Nunca te pedimos el código de seguridad.');
    await expect(page.getByTestId('dato-tarjetas')).toContainText('0');

    // El diálogo de alta: tipo, número, titular y vencimiento; nada de código de seguridad.
    await page.getByTestId('agregar-tarjeta').click();
    const alta = await dialogo(page, 'dialogo-tarjeta');
    await expect(alta.locator('input')).toHaveCount(3);
    await expect(alta).not.toContainText(/CVV|CVC|código de seguridad de/i);
    await expect(page.getByTestId('tarjeta-numero')).toHaveAttribute('autocomplete', 'cc-number');
    await expect(page.getByTestId('tarjeta-vence')).toHaveAttribute('autocomplete', 'cc-exp');
    // Las áreas táctiles del tipo tienen al menos 48 px.
    for (const alto of await page.getByTestId('tarjeta-tipo').getByRole('radio').evaluateAll((ns) => ns.map((n) => n.getBoundingClientRect().height))) {
      expect(alto).toBeGreaterThanOrEqual(48);
    }

    // Datos inválidos: cada error debajo de su campo, con aria-invalid.
    await page.getByTestId('tarjeta-tipo-credito').click();
    await page.getByTestId('tarjeta-numero').fill('4242 4242 4242 4241');   // falla Luhn
    await page.getByTestId('tarjeta-titular').fill('A');
    await page.getByTestId('tarjeta-vence').fill('0120');                     // vencida
    await page.getByTestId('guardar-tarjeta').click();
    await expect(alta).toContainText('Revisá el número: no corresponde a una tarjeta válida.');
    await expect(alta).toContainText('Usá entre 2 y 60 caracteres.');
    await expect(alta).toContainText('La tarjeta está vencida.');
    for (const campo of ['tarjeta-numero', 'tarjeta-titular', 'tarjeta-vence']) {
      await expect(page.getByTestId(campo)).toHaveAttribute('aria-invalid', 'true');
    }
    await expect(page.getByTestId('tarjeta-numero')).toBeFocused();
    await revisarAccesibilidad(page, 'cuenta-alta-tarjeta');
    // Corto: menos de 13 dígitos.
    await page.getByTestId('tarjeta-numero').fill('4242 4242 4242');
    await page.getByTestId('guardar-tarjeta').click();
    await expect(alta).toContainText('El número tiene entre 13 y 19 dígitos.');

    // Válida: se guarda, el número se descarta y la lista la muestra enmascarada.
    await page.getByTestId('tarjeta-numero').fill('4242424242424242');
    await expect(page.getByTestId('tarjeta-numero')).toHaveValue('4242 4242 4242 4242');
    await expect(alta).toContainText('Tarjeta Visa.');
    await page.getByTestId('tarjeta-titular').fill('Vecina Prueba');
    await page.getByTestId('tarjeta-vence').fill('1230');
    await page.getByTestId('guardar-tarjeta').click();
    await expect(page.getByTestId('dialogo-tarjeta')).toHaveCount(0);
    const fila = page.getByTestId('tarjeta-guardada-tarjeta-1');
    await expect(fila).toContainText('Visa crédito •••• 4242');
    await expect(fila).toContainText('Vecina Prueba · vence 12/30');
    await expect(page.getByTestId('dato-tarjetas')).toContainText('1');
    const guardada = (await adminDb.doc(`usuarios/${uid}/tarjetas/tarjeta-1`).get()).data();
    expect(Object.keys(guardada).sort()).toEqual(['creadoEn', 'red', 'tipo', 'titular', 'ultimos4', 'vence']);
    expect(guardada).toMatchObject({ tipo: 'credito', red: 'Visa', ultimos4: '4242', titular: 'Vecina Prueba', vence: '12/30' });
    expect(JSON.stringify(guardada)).not.toMatch(/4242424242|cvv|numero/i);
    // Al volver a abrir, el formulario está vacío.
    await page.getByTestId('agregar-tarjeta').click();
    await dialogo(page, 'dialogo-tarjeta');
    await expect(page.getByTestId('tarjeta-numero')).toHaveValue('');
    // La misma tarjeta otra vez: el error va debajo del número.
    await page.getByTestId('tarjeta-tipo-credito').click();
    await page.getByTestId('tarjeta-numero').fill('4242424242424242');
    await page.getByTestId('tarjeta-titular').fill('Vecina Prueba');
    await page.getByTestId('tarjeta-vence').fill('1230');
    await page.getByTestId('guardar-tarjeta').click();
    await expect(page.getByTestId('dialogo-tarjeta')).toContainText('Esa tarjeta ya está guardada.');
    await page.getByTestId('cancelar-tarjeta').click();
    await expect(page.getByTestId('dialogo-tarjeta')).toHaveCount(0);

    // En 360 px la sección no desborda.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await revisarAccesibilidad(page, 'cuenta-medios-pago');

    // Tope de 5: con cinco guardadas no se ofrece agregar otra.
    for (let i = 2; i <= 5; i += 1) {
      await sembrarTarjeta(adminDb, uid, { ...TARJETAS_PRUEBA.debito, id: `tarjeta-${i}`, ultimos4: `000${i}` });
    }
    await expect(page.locator('[data-testid^="tarjeta-guardada-"]')).toHaveCount(5);
    await expect(page.getByTestId('agregar-tarjeta')).toHaveCount(0);
    await expect(page.getByTestId('tarjetas-tope')).toContainText('máximo de 5 tarjetas');

    // Quitar pide confirmación; cancelar no borra nada.
    await page.getByTestId('quitar-tarjeta-1').click();
    const quitar = await dialogo(page, 'dialogo-quitar-tarjeta');
    await expect(quitar).toContainText('Visa crédito •••• 4242');
    await revisarAccesibilidad(page, 'cuenta-quitar-tarjeta');
    await page.getByTestId('cancelar-quitar-tarjeta').click();
    await expect(page.getByTestId('dialogo-quitar-tarjeta')).toHaveCount(0);
    expect((await adminDb.doc(`usuarios/${uid}/tarjetas/tarjeta-1`).get()).exists).toBe(true);
    await page.getByTestId('quitar-tarjeta-1').click();
    await dialogo(page, 'dialogo-quitar-tarjeta');
    await page.getByTestId('confirmar-quitar-tarjeta').click();
    await expect(page.getByTestId('tarjeta-guardada-tarjeta-1')).toHaveCount(0);
    await expect.poll(async () => (await adminDb.doc(`usuarios/${uid}/tarjetas/tarjeta-1`).get()).exists, { timeout: 10_000 }).toBe(false);
    // Con un lugar libre vuelve "Agregar tarjeta" y recibe el foco.
    await expect(page.getByTestId('agregar-tarjeta')).toBeVisible();
    await expect(page.getByTestId('agregar-tarjeta')).toBeFocused();
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
