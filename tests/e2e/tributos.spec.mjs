// Tributos (S4, sección 8.7): T1 cedulón con código de pago e impresión, T2 pago simulado con
// confirmación, T3 historial y estados, T4 estado "por vencer" y recordatorios de vencimiento.
// Datos: los que escribe vecino/alta (datosInicialesVecino de shared/catalogo.mjs) para cada invitado
// nuevo: T-0999 vencido, T-1001 por vencer (2 días), T-1002 pendiente (8 días) y T-1000 pagado.
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

    // T3: historial con el pago semilla de T-1000 y su comprobante.
    await page.getByTestId('pestanas-tributos-pagados').click();
    await expect(page.getByTestId('pestanas-tributos-pagados')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('pago-semilla-T-1000')).toContainText('REC-00001000');
    await expect(page.getByTestId('pago-semilla-T-1000')).toContainText('09/2026');
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
    await expect(page.getByTestId('aviso-cedulon')).toContainText('Pago simulado, sin cargos reales.');

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
    expect(texto).toContain('Prototipo académico');
    expect(texto).toContain('Pago simulado, sin cargos reales.');
    expect(texto.replace(/\s/g, '')).toContain(esperado);
    // En pantalla el contenedor de impresión no se ve; al imprimir se ve solo él.
    await expect(impreso).toBeHidden();
    await page.emulateMedia({ media: 'print' });
    await expect(impreso).toBeVisible();
    await expect(page.getByTestId('pantalla-tributos')).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
  });

  test('pago simulado con confirmación explícita y comprobante (T2)', async ({ vecino, adminDb }) => {
    const { page, uid } = vecino;
    await abrirTributos(page);

    // Cancelar no paga nada.
    await page.getByTestId('pagar-T-1001').click();
    let dialogo = await esperarDialogo(page, 'dialogo-pago');
    await expect(dialogo).toContainText('Pago simulado, sin cargos reales.');
    await page.getByTestId('cancelar-pago').click();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    expect((await tributoEnDb(adminDb, uid, 'T-1001')).pagadoEn).toBeNull();

    // Confirmación: importe, leyenda y número de operación (requestId) generado al abrirla.
    await page.getByTestId('pagar-T-1001').click();
    dialogo = await esperarDialogo(page, 'dialogo-pago');
    await expect(page.getByTestId('importe-pago')).toHaveText(importe(SEMILLA['T-1001'].importe));
    await expect(page.getByTestId('aviso-sin-cargos')).toContainText('Pago simulado, sin cargos reales.');
    const requestId = (await page.getByTestId('numero-operacion').getAttribute('data-operacion'))?.match(UUID)?.[0];
    expect(requestId).toBeTruthy();
    await revisarAccesibilidad(page, 'confirmar-pago');

    await page.getByTestId('confirmar-pago').click();
    const comprobanteDialogo = await esperarDialogo(page, 'comprobante');
    const esperado = comprobante('REC', requestId);
    await expect(page.getByTestId('numero-comprobante')).toHaveText(esperado);
    await expect(comprobanteDialogo).toContainText('Pago simulado, sin cargos reales.');
    await revisarAccesibilidad(page, 'comprobante');

    // En Firestore: tributo pagado, pago con el requestId como id y la notificación "Pago registrado".
    const tributo = await tributoEnDb(adminDb, uid, 'T-1001');
    expect(tributo.pagadoEn).not.toBeNull();
    expect(tributo.comprobante).toBe(esperado);
    expect(tributo.pagoId).toBe(requestId);
    const pago = (await adminDb.doc(`usuarios/${uid}/pagos/${requestId}`).get()).data();
    expect(pago).toMatchObject({ tipo: 'tributo', refId: 'T-1001', importe: SEMILLA['T-1001'].importe, proveedor: 'pasarela-simulada' });
    expect((await adminDb.doc(`usuarios/${uid}/notificaciones/pago-${requestId}`).get()).exists).toBe(true);

    // La pantalla se actualiza sola: sale de pendientes, baja el total y aparece en el historial.
    await page.getByTestId('cerrar-comprobante').click();
    await expect(page.getByTestId('tributo-T-1001')).toHaveCount(0);
    await expect(page.getByTestId('total-pendiente')).toHaveText(importe(43250));
    await page.getByTestId('pestanas-tributos-pagados').click();
    await expect(page.getByTestId(`pago-${requestId}`)).toContainText(esperado);
    await page.getByTestId(`ver-comprobante-${requestId}`).click();
    await esperarDialogo(page, 'comprobante');
    await expect(page.getByTestId('numero-comprobante')).toHaveText(esperado);
  });

  test('errores dentro del diálogo: sin conexión con reintento y cedulón ya pagado', async ({ vecino, adminDb }) => {
    const { page, uid, contexto } = vecino;
    await abrirTributos(page);

    // Sin conexión: el error queda junto al botón y el reintento usa el mismo número de operación.
    await page.getByTestId('pagar-T-1002').click();
    await esperarDialogo(page, 'dialogo-pago');
    const requestId = (await page.getByTestId('numero-operacion').getAttribute('data-operacion'))?.match(UUID)?.[0];
    await contexto.setOffline(true);
    await page.getByTestId('confirmar-pago').click();
    await expect(page.getByTestId('error-pago')).toContainText('conexión');
    await expect(page.getByTestId('confirmar-pago')).toContainText('Reintentar');
    await contexto.setOffline(false);
    await page.getByTestId('confirmar-pago').click();
    await expect(page.getByTestId('numero-comprobante')).toHaveText(comprobante('REC', requestId), { timeout: 30_000 });
    expect((await tributoEnDb(adminDb, uid, 'T-1002')).pagoId).toBe(requestId);
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
