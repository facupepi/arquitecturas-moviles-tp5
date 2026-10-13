// Tributos (S4, sección 8.7): T1 cedulón con código de pago e impresión, T2 pago con la pasarela
// (medio → procesando → aprobado y comprobante), T3 historial y estados, T4 estado "por vencer" y
// recordatorios de vencimiento.
// Datos: los que escribe vecino/alta (datosInicialesVecino de shared/catalogo.mjs) para cada vecino
// nuevo: T-0999 vencido, T-1001 por vencer (2 días) y T-1002 pendiente (8 días). Sin pagos previos.
import { Timestamp } from 'firebase-admin/firestore';
import { test, expect, irA } from './fixtures.mjs';
import { revisarAccesibilidad } from './accesibilidad.mjs';
import { datosInicialesVecino } from '../../shared/catalogo.mjs';
import { codigoPagoTributo, comprobante, luhnValido } from '../../shared/dominio.mjs';

const ESPERA_DATOS = 30_000;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/;
const SEMILLA = Object.fromEntries(datosInicialesVecino(Date.now()).tributos.map((t) => [t.id, t]));
// "$ 61.750" con espacio duro (Intl): se compara solo la parte numérica.
const importe = (n) => new RegExp(`\\$\\s?${n.toLocaleString('es-AR').replace('.', '\\.')}`);

async function abrirTributos(page) {
  await irA(page, '#/tributos');
  await expect(page.getByTestId('pantalla-tributos')).toBeVisible();
  await expect(page.getByTestId('tributo-T-1001')).toBeVisible({ timeout: ESPERA_DATOS });
}

/** En WebKit hay que esperar el role="dialog" (el Modal de RNW lo pone al quedar activo). */
async function esperarDialogo(page, testID) {
  const dialogo = page.locator(`[role="dialog"][data-testid="${testID}"]`);
  await expect(dialogo).toBeVisible();
  return dialogo;
}

// Ningún texto de demostración en los flujos de pago (pedido del usuario).
const TEXTO_DEMO = /simulad|sin cargos|sin validez|prototipo/i;

async function tributoEnDb(adminDb, uid, id) {
  const snap = await adminDb.doc(`usuarios/${uid}/tributos/${id}`).get();
  return snap.data();
}

test.describe('Tributos', () => {
  test('estados, total pendiente, historial y recordatorios de vencimiento (T1, T3, T4)', async ({ vecino }) => {
    const { page } = vecino;
    await abrirTributos(page);

    // T3: cada cedulón con su estado; el vencido primero.
    await expect(page.getByTestId('estado-tributo-T-0999')).toHaveText('Vencido');
    await expect(page.getByTestId('estado-tributo-T-1001')).toHaveText('Por vencer');
    await expect(page.getByTestId('estado-tributo-T-1002')).toHaveText('Pendiente');
    await expect(page.getByTestId('tributo-T-1001')).toContainText('vence en 2 días');
    await expect(page.getByTestId('tributo-T-0999')).toContainText('venció hace 40 días');
    await expect(page.getByTestId('tributo-T-1000')).toHaveCount(0);
    const orden = await page.locator('[data-testid^="tributo-T-"]').evaluateAll((nodos) => nodos.map((n) => n.dataset.testid));
    expect(orden).toEqual(['tributo-T-0999', 'tributo-T-1001', 'tributo-T-1002']);

    // Total pendiente: incluye el vencido (18.500 + 18.500 + 24.750).
    await expect(page.getByTestId('total-pendiente')).toHaveText(importe(61750));
    await expect(page.getByTestId('resumen-detalle')).toContainText('incluye 1 vencido');

    // T4: los recordatorios que creó vecino/alta, visibles en la pantalla.
    const recordatorios = page.getByTestId('recordatorios-vencimiento');
    await expect(recordatorios).toBeVisible({ timeout: ESPERA_DATOS });
    await expect(recordatorios).toContainText('vence en 2 días');
    await expect(recordatorios).toContainText('Tenés un cedulón vencido');
    await revisarAccesibilidad(page, 'tributos-pendientes');

    // T3: un vecino nuevo todavía no tiene pagos.
    await page.getByTestId('pestanas-tributos-pagados').click();
    await expect(page.getByTestId('pestanas-tributos-pagados')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('pagos-vacio')).toBeVisible();
    await revisarAccesibilidad(page, 'tributos-pagados');

    // Tocar un recordatorio abre el cedulón correspondiente.
    await page.getByTestId('pestanas-tributos-pendientes').click();
    await page.locator('[data-testid^="recordatorio-tributo-T-1001-"]').click();
    const dialogo = await esperarDialogo(page, 'dialogo-cedulon');
    await expect(dialogo).toContainText('Cedulón T-1001');
  });

  test('cedulón con código de pago verificable e impresión (T1)', async ({ vecino, adminDb }) => {
    const { page, uid } = vecino;
    await abrirTributos(page);

    await page.getByTestId('ver-cedulon-T-1001').click();
    const dialogo = await esperarDialogo(page, 'dialogo-cedulon');
    await expect(dialogo).toContainText('Tasa de servicios municipales');
    await expect(dialogo).toContainText('10/2026');
    await expect(page.getByTestId('importe-cedulon')).toHaveText(importe(18500));
    await expect(page.getByTestId('estado-cedulon')).toHaveText('Por vencer');
    await expect(page.getByTestId('barras-cedulon')).toBeVisible();
    await expect(page.getByTestId('aviso-cedulon')).toHaveText('Pagalo desde la app San Francisco Conecta.');
    await expect(dialogo).not.toContainText(TEXTO_DEMO);

    // El código de pago es el de codigoPagoTributo (24 dígitos con verificador Luhn).
    const datos = await tributoEnDb(adminDb, uid, 'T-1001');
    const esperado = codigoPagoTributo({ id: 'T-1001', importe: datos.importe, vence: datos.vence.toMillis() });
    const mostrado = (await page.getByTestId('codigo-pago').innerText()).replace(/\s/g, '');
    expect(mostrado).toBe(esperado);
    expect(mostrado).toHaveLength(24);
    expect(luhnValido(mostrado)).toBe(true);
    await revisarAccesibilidad(page, 'cedulon');

    // "Imprimir o guardar PDF" abre el diálogo de impresión con el cedulón armado (sin descargar nada).
    await page.evaluate(() => {
      window.__impresiones = 0;
      window.print = () => { window.__impresiones += 1; };
    });
    await page.getByTestId('imprimir-cedulon').click();
    await expect.poll(() => page.evaluate(() => window.__impresiones)).toBe(1);
    const impreso = page.locator('#cedulon-impresion');
    await expect(impreso).toHaveAttribute('data-tributo', 'T-1001');
    const texto = await impreso.evaluate((n) => n.textContent);
    expect(texto).toContain('Cedulón T-1001');
    expect(texto).toContain('Pagalo desde la app San Francisco Conecta.');
    expect(texto).not.toMatch(TEXTO_DEMO);
    expect(texto.replace(/\s/g, '')).toContain(esperado);
    // En pantalla el contenedor de impresión no se ve; al imprimir se ve solo él.
    await expect(impreso).toBeHidden();
    await page.emulateMedia({ media: 'print' });
    await expect(impreso).toBeVisible();
    await expect(page.getByTestId('pantalla-tributos')).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
  });

  test('pasarela: elige el medio, procesa, aprueba y deja el comprobante (T2)', async ({ vecino, adminDb }) => {
    const { page, uid } = vecino;
    await abrirTributos(page);

    // Cancelar no paga nada.
    await page.getByTestId('pagar-T-1001').click();
    let dialogo = await esperarDialogo(page, 'dialogo-pago');
    await expect(dialogo).not.toContainText(TEXTO_DEMO);
    await page.getByTestId('cancelar-pago').click();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    expect((await tributoEnDb(adminDb, uid, 'T-1001')).pagadoEn).toBeNull();

    // Pasarela: importe, los cuatro medios como radios, sin campos de tarjeta, y el número de
    // operación (requestId) generado al abrirla.
    await page.getByTestId('pagar-T-1001').click();
    dialogo = await esperarDialogo(page, 'dialogo-pago');
    await expect(page.getByTestId('importe-pago')).toHaveText(importe(SEMILLA['T-1001'].importe));
    const medios = page.getByRole('radiogroup', { name: 'Elegí cómo pagar' });
    await expect(medios.getByRole('radio')).toHaveText([
      /Tarjeta de crédito/, /Tarjeta de débito/, /Billetera virtual/, /Transferencia bancaria/,
    ]);
    await expect(medios.getByRole('radio', { checked: true })).toHaveCount(0);
    await expect(dialogo.locator('input, textarea')).toHaveCount(0);
    await expect(page.getByTestId('confirmar-pago')).toContainText('Pagar');
    const requestId = (await page.getByTestId('numero-operacion').getAttribute('data-operacion'))?.match(UUID)?.[0];
    expect(requestId).toBeTruthy();
    // Las opciones tienen al menos 48 px de alto (área táctil).
    for (const caja of await medios.getByRole('radio').evaluateAll((ns) => ns.map((n) => n.getBoundingClientRect().height))) {
      expect(caja).toBeGreaterThanOrEqual(48);
    }

    // Sin medio no paga: el error queda junto a las opciones.
    await page.getByTestId('confirmar-pago').click();
    await expect(page.getByTestId('medio-error')).toHaveText('Elegí un medio de pago para continuar.');
    expect((await tributoEnDb(adminDb, uid, 'T-1001')).pagadoEn).toBeNull();
    await revisarAccesibilidad(page, 'confirmar-pago');

    // Elegir el medio limpia el error (también con el teclado: flecha abajo pasa a la siguiente opción).
    await page.getByTestId('medio-credito').click();
    await expect(page.getByTestId('medio-error')).toHaveCount(0);
    await page.getByTestId('medio-credito').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('medio-debito')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('medio-credito')).toHaveAttribute('aria-checked', 'false');

    // Pagar: "Procesando el pago…" con el medio, sin poder cerrar el diálogo.
    await page.getByTestId('confirmar-pago').click();
    const procesando = page.getByTestId('procesando-pago');
    await expect(procesando).toBeVisible();
    await expect(procesando).toContainText('Procesando el pago…');
    await expect(procesando).toHaveAttribute('role', 'status');
    await expect(page.getByTestId('procesando-pago-medio')).toContainText('tarjeta de débito');
    await expect(page.getByTestId('dialogo-pago-cerrar')).toHaveCount(0);

    // "Pago aprobado" y el comprobante con el medio y el número de operación.
    const comprobanteDialogo = await esperarDialogo(page, 'comprobante');
    const esperado = comprobante('REC', requestId);
    await expect(page.getByTestId('comprobante-pago-estado')).toHaveText('Pago aprobado');
    await expect(page.getByTestId('numero-comprobante')).toHaveText(esperado);
    await expect(page.getByTestId('comprobante-medio')).toContainText('Tarjeta de débito');
    await expect(comprobanteDialogo).not.toContainText(TEXTO_DEMO);
    await revisarAccesibilidad(page, 'comprobante');

    // En Firestore: tributo pagado con el medio, pago con el requestId como id y la notificación.
    const tributo = await tributoEnDb(adminDb, uid, 'T-1001');
    expect(tributo.pagadoEn).not.toBeNull();
    expect(tributo.comprobante).toBe(esperado);
    expect(tributo.pagoId).toBe(requestId);
    expect(tributo.medio).toBe('debito');
    const pago = (await adminDb.doc(`usuarios/${uid}/pagos/${requestId}`).get()).data();
    expect(pago).toMatchObject({
      tipo: 'tributo', refId: 'T-1001', importe: SEMILLA['T-1001'].importe, medio: 'debito', proveedor: 'pasarela-simulada',
    });
    expect(Object.keys(pago).sort()).toEqual(['comprobante', 'creadoEn', 'importe', 'medio', 'proveedor', 'refId', 'tipo']);
    expect((await adminDb.doc(`usuarios/${uid}/notificaciones/pago-${requestId}`).get()).exists).toBe(true);

    // La pantalla se actualiza sola: sale de pendientes, baja el total y aparece en el historial.
    await page.getByTestId('cerrar-comprobante').click();
    await expect(page.getByTestId('tributo-T-1001')).toHaveCount(0);
    await expect(page.getByTestId('total-pendiente')).toHaveText(importe(43250));
    await page.getByTestId('pestanas-tributos-pagados').click();
    await expect(page.getByTestId(`pago-${requestId}`)).toContainText(esperado);
    await expect(page.getByTestId(`medio-${requestId}`)).toContainText('Tarjeta de débito');
    await page.getByTestId(`ver-comprobante-${requestId}`).click();
    await esperarDialogo(page, 'comprobante');
    await expect(page.getByTestId('numero-comprobante')).toHaveText(esperado);
    await expect(page.getByTestId('comprobante-medio')).toContainText('Tarjeta de débito');
    await page.getByTestId('comprobante-ver-cedulon').click();
    await esperarDialogo(page, 'dialogo-cedulon');
    await expect(page.getByTestId('dialogo-cedulon')).toContainText('Tarjeta de débito');
    await expect(page.getByTestId('aviso-cedulon')).toHaveText('Pagado desde la app San Francisco Conecta.');
  });

  test('errores dentro del diálogo: sin conexión con reintento y cedulón ya pagado', async ({ vecino, adminDb }) => {
    const { page, uid, contexto } = vecino;
    await abrirTributos(page);

    // Sin conexión: el error queda junto al botón y el reintento usa el mismo número de operación.
    await page.getByTestId('pagar-T-1002').click();
    await esperarDialogo(page, 'dialogo-pago');
    const requestId = (await page.getByTestId('numero-operacion').getAttribute('data-operacion'))?.match(UUID)?.[0];
    await page.getByTestId('medio-transferencia').click();
    await contexto.setOffline(true);
    await page.getByTestId('confirmar-pago').click();
    await expect(page.getByTestId('procesando-pago')).toBeVisible();
    await expect(page.getByTestId('error-pago')).toContainText('conexión');
    await expect(page.getByTestId('confirmar-pago')).toContainText('Reintentar');
    // El medio elegido se conserva para el reintento.
    await expect(page.getByTestId('medio-transferencia')).toHaveAttribute('aria-checked', 'true');
    await contexto.setOffline(false);
    await page.getByTestId('confirmar-pago').click();
    await expect(page.getByTestId('numero-comprobante')).toHaveText(comprobante('REC', requestId), { timeout: 30_000 });
    await expect(page.getByTestId('comprobante-medio')).toContainText('Transferencia bancaria');
    const pagadoOffline = await tributoEnDb(adminDb, uid, 'T-1002');
    expect(pagadoOffline.pagoId).toBe(requestId);
    expect(pagadoOffline.medio).toBe('transferencia');
    await page.getByTestId('cerrar-comprobante').click();

    // Otro dispositivo paga T-0999 mientras la confirmación está abierta.
    await page.getByTestId('pagar-T-0999').click();
    await esperarDialogo(page, 'dialogo-pago');
    await expect(page.getByTestId('aviso-vencido-pago')).toBeVisible();
    await adminDb.doc(`usuarios/${uid}/tributos/T-0999`).update({
      pagadoEn: Timestamp.now(), comprobante: 'REC-OTRO0001', pagoId: 'otro-dispositivo',
    });
    await expect(page.getByTestId('error-pago')).toContainText('ya está pagado');
    await expect(page.getByTestId('confirmar-pago')).toHaveCount(0);
    await page.getByTestId('cerrar-pago').click();
    await expect(page.getByTestId('tributo-T-0999')).toHaveCount(0);
    await expect(page.getByTestId('total-pendiente')).toHaveText(importe(18500));

    // Con todo pagado: estado vacío con la salida al historial.
    await adminDb.doc(`usuarios/${uid}/tributos/T-1001`).update({
      pagadoEn: Timestamp.now(), comprobante: 'REC-OTRO0002', pagoId: 'otro-dispositivo-2',
    });
    await expect(page.getByTestId('pendientes-vacio')).toContainText('No tenés cedulones pendientes');
    await expect(page.getByTestId('total-pendiente')).toHaveText(/^\$\s?0$/);
    await revisarAccesibilidad(page, 'tributos-al-dia');
  });

  test('enlace profundo abre el cedulón y la pantalla entra en 360 px sin desbordar', async ({ vecino }) => {
    const { page } = vecino;
    await page.setViewportSize({ width: 360, height: 740 });
    await abrirTributos(page);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho).toBeLessThanOrEqual(360);

    await irA(page, '#/tributos/T-1002');
    const dialogo = await esperarDialogo(page, 'dialogo-cedulon');
    await expect(dialogo).toContainText('Contribución sobre inmuebles');
    await expect(dialogo).toContainText('vence en 8 días');
    await page.getByTestId('dialogo-cedulon-cerrar').click();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/tributos');

    await irA(page, '#/tributos/T-9999');
    await expect(page.getByTestId('cedulon-no-encontrado')).toContainText('T-9999');
  });
});
