// Estacionamiento medido (S6, sección 8.9 y 10.3): E1 zonas con tarifa, horario y control de horario;
// E2 inicio con importe correcto; E3 aviso "por vencer" con el umbral de municipal/config; E4 extensión
// y "Terminar ahora"; patente ocupada entre vecinos; accesibilidad.
//
// Las tarifas salen de shared/catalogo.mjs (lo mismo que se siembra), nunca de memoria. Cada prueba usa
// una patente al azar: los bloqueos de patente quedan vigentes en el proyecto entre corridas.
import { test, expect, irA } from './fixtures.mjs';
import { revisarAccesibilidad } from './accesibilidad.mjs';
import { catalogo } from '../../shared/catalogo.mjs';
import { costoEstacionamiento } from '../../shared/dominio.mjs';

const ZONAS = catalogo(Date.now()).zonasEstacionamiento;
const zona = (id) => {
  const z = ZONAS.find((x) => x.id === id);
  if (!z) throw new Error(`La zona ${id} no está en shared/catalogo.mjs`);
  return z;
};

// Las teselas de OpenStreetMap son de un tercero (imágenes sin texto alternativo propio).
const EXCLUIR_AXE = ['.leaflet-tile-pane'];

function patenteAlAzar() {
  const letras = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  const l = () => letras[Math.floor(Math.random() * letras.length)];
  const d = () => String(Math.floor(Math.random() * 10));
  return Math.random() < 0.5 ? `${l()}${l()}${l()}${d()}${d()}${d()}` : `${l()}${l()}${d()}${d()}${d()}${l()}${l()}`;
}

const soloDigitos = (texto) => String(texto ?? '').replace(/\D/g, '');

async function abrirEstacionamiento(page, hash = '#/estacionamiento') {
  await irA(page, hash);
  await expect(page.getByTestId('pantalla-estacionamiento')).toBeVisible();
  await expect(page.getByTestId('zona-p1')).toBeVisible({ timeout: 20_000 });
}

async function esperarDialogo(page, testID) {
  await page.locator('[role="dialog"]').first().waitFor({ state: 'visible' });
  await expect(page.getByTestId(testID)).toBeVisible();
}

/** Completa el formulario, confirma y devuelve el id de la sesión creada. */
async function iniciar(page, { zonaId = 'p1', patente, minutos = 15 }) {
  await page.getByTestId(`zona-${zonaId}`).click();
  await expect(page.getByTestId(`zona-${zonaId}`)).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('campo-patente').fill(patente);
  await page.getByTestId(`minutos-${minutos}`).click();
  await page.getByTestId('iniciar-estacionamiento').click();
  await esperarDialogo(page, 'confirmar-estacionamiento');
  await page.getByTestId('confirmar-estacionamiento').click();
  const temporizador = page.locator('[data-testid^="temporizador-"]').first();
  await expect(temporizador).toBeVisible({ timeout: 20_000 });
  const testId = await temporizador.getAttribute('data-testid');
  return testId.replace('temporizador-', '');
}

test.describe('Estacionamiento medido', () => {
  test.afterEach(async ({ restablecerCatalogo }) => {
    await restablecerCatalogo();   // algunas pruebas cambian municipal/config o el horario de las zonas
  });

  test('E1: zonas con tarifa y horario, enlace profundo y patente inválida con el error junto al campo', async ({ vecino }) => {
    const { page } = vecino;
    await abrirEstacionamiento(page, '#/estacionamiento/p3');

    // Enlace profundo: la zona p3 queda elegida.
    await expect(page.getByTestId('zona-p3')).toHaveAttribute('aria-checked', 'true');
    for (const z of ZONAS) {
      const opcion = page.getByTestId(`zona-${z.id}`);
      await expect(opcion).toContainText(z.nombre);
      await expect(opcion).toContainText(z.horarioTexto);
      await expect(opcion).toContainText(/por hora/);
      expect(soloDigitos(await opcion.textContent())).toContain(String(z.tarifaHora));
      await expect(page.getByTestId(`horario-${z.id}`)).toHaveText(/^(En horario|Fuera de horario)$/);
    }
    await expect(page.getByTestId('sin-sesiones')).toContainText('Tu próximo lugar te espera');

    // Importe en vivo con costoEstacionamiento.
    await page.getByTestId('zona-p2').click();
    await page.getByTestId('minutos-90').click();
    await expect.poll(async () => soloDigitos(await page.getByTestId('importe').textContent()))
      .toBe(String(costoEstacionamiento(zona('p2').tarifaHora, 90)));

    // Patente inválida: error debajo del campo, campo marcado y sin diálogo.
    await page.getByTestId('campo-patente').fill('12ab');
    await page.getByTestId('iniciar-estacionamiento').click();
    await expect(page.locator('#campo-patente-error')).toHaveText('Usá una patente como ABC123 o AB123CD.');
    await expect(page.getByTestId('campo-patente')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    // El foco vuelve a la patente (queda a la vista) y debajo del botón se resume el problema.
    await expect(page.getByTestId('campo-patente')).toBeFocused();
    await expect(page.getByTestId('resumen-error-patente')).toBeVisible();

    // Al corregirla, el error desaparece.
    await page.getByTestId('campo-patente').fill('ab123cd');
    await expect(page.getByTestId('campo-patente')).toHaveValue('AB123CD');
    await expect(page.locator('#campo-patente-error')).toHaveCount(0);

    await revisarAccesibilidad(page, 'estacionamiento', { excluir: EXCLUIR_AXE });
  });

  test('E2: inicia con el importe correcto y deja sesión, pago y bloqueo sin uid', async ({ vecino, adminDb }) => {
    const { page, uid } = vecino;
    const patente = patenteAlAzar();
    const p2 = zona('p2');
    const esperado = costoEstacionamiento(p2.tarifaHora, 30);
    await abrirEstacionamiento(page);

    await page.getByTestId('zona-p2').click();
    await page.getByTestId('campo-patente').fill(patente.toLowerCase());
    await page.getByTestId('minutos-30').click();
    expect(soloDigitos(await page.getByTestId('importe').textContent())).toBe(String(esperado));
    await page.getByTestId('iniciar-estacionamiento').click();
    await esperarDialogo(page, 'confirmar-estacionamiento');
    const dialogo = page.locator('[role="dialog"]');
    await expect(page.getByTestId('confirmacion-patente')).toContainText(patente);
    expect(soloDigitos(await page.getByTestId('confirmacion-importe').textContent())).toBe(String(esperado));
    await expect(dialogo).toContainText('Pago simulado, sin cargos reales');
    await expect(dialogo).toContainText(/EST-[A-Z0-9]{8}/);
    await revisarAccesibilidad(page, 'estacionamiento-confirmacion', { excluir: EXCLUIR_AXE });
    await page.getByTestId('confirmar-estacionamiento').click();

    const temporizador = page.locator('[data-testid^="temporizador-"]').first();
    await expect(temporizador).toBeVisible({ timeout: 20_000 });
    await expect(temporizador).toHaveAttribute('role', 'timer');
    await expect(temporizador).toHaveText(/^00:(29|30):\d\d$/);
    const sesionId = (await temporizador.getAttribute('data-testid')).replace('temporizador-', '');

    const sesion = (await adminDb.doc(`usuarios/${uid}/estacionamiento/${sesionId}`).get()).data();
    expect(sesion).toMatchObject({ patente, zonaId: 'p2', minutos: 30, importe: esperado, extensiones: 0 });
    const pago = (await adminDb.doc(`usuarios/${uid}/pagos/${sesionId}`).get()).data();
    expect(pago).toMatchObject({ tipo: 'estacionamiento', refId: sesionId, importe: esperado, proveedor: 'pasarela-simulada' });
    expect(pago.comprobante).toMatch(/^EST-[A-Z0-9]{8}$/);
    const bloqueo = (await adminDb.doc(`bloqueosPatente/${patente}`).get()).data();
    expect(bloqueo.sesionId).toBe(sesionId);
    expect(bloqueo).not.toHaveProperty('uid');

    await revisarAccesibilidad(page, 'estacionamiento-sesion-activa', { excluir: EXCLUIR_AXE });
  });

  test('E3: con el umbral en 14 minutos aparece el aviso "por vencer"', async ({ vecino, adminDb, adelantarReloj }) => {
    const { page } = vecino;
    await adminDb.doc('municipal/config').update({ avisoEstacionamientoMin: 14 });
    await abrirEstacionamiento(page);
    const sesionId = await iniciar(page, { patente: patenteAlAzar(), minutos: 15 });

    // Con 15 minutos y umbral 14, todavía no corresponde avisar.
    await expect(page.getByTestId(`temporizador-${sesionId}`)).toHaveText(/^00:1[45]:\d\d$/);
    await expect(page.getByTestId('aviso-por-vencer')).toHaveCount(0);

    // Un minuto después (sin escribir más: las reglas usan la hora real) entra en el umbral.
    await adelantarReloj(page, 61_000);
    const aviso = page.getByTestId('aviso-por-vencer');
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('Tu estacionamiento está por vencer');
    await expect(page.getByTestId(`temporizador-${sesionId}`)).toHaveText(/^00:1[34]:\d\d$/);
    await revisarAccesibilidad(page, 'estacionamiento-por-vencer', { excluir: EXCLUIR_AXE });
  });

  test('E4: extender suma el tiempo y el importe', async ({ vecino, adminDb }) => {
    const { page, uid } = vecino;
    const p1 = zona('p1');
    await abrirEstacionamiento(page);
    const sesionId = await iniciar(page, { zonaId: 'p1', patente: patenteAlAzar(), minutos: 15 });
    const finAntes = (await adminDb.doc(`usuarios/${uid}/estacionamiento/${sesionId}`).get()).data().fin.toMillis();

    const boton = page.getByTestId(`extender-15-${sesionId}`);
    expect(soloDigitos(await boton.textContent())).toBe(`15${costoEstacionamiento(p1.tarifaHora, 15)}`);
    await boton.click();
    await esperarDialogo(page, 'confirmar-extension');
    await expect(page.locator('[role="dialog"]')).toContainText('Pago simulado, sin cargos reales');
    await page.getByTestId('confirmar-extension').click();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);

    await expect(page.getByTestId(`minutos-pagados-${sesionId}`)).toContainText('30 min');
    await expect(page.getByTestId(`temporizador-${sesionId}`)).toHaveText(/^00:(29|30):\d\d$/);
    const sesion = (await adminDb.doc(`usuarios/${uid}/estacionamiento/${sesionId}`).get()).data();
    expect(sesion.minutos).toBe(30);
    expect(sesion.extensiones).toBe(1);
    expect(sesion.importe).toBe(2 * costoEstacionamiento(p1.tarifaHora, 15));
    expect(sesion.fin.toMillis() - finAntes).toBe(15 * 60_000);
    const pagos = await adminDb.collection(`usuarios/${uid}/pagos`).where('tipo', '==', 'extension').get();
    expect(pagos.docs.map((d) => d.data().refId)).toContain(sesionId);
  });

  test('E4: "Terminar ahora" cierra la sesión y otro vecino puede usar la patente', async ({ vecino, nuevoVecino }) => {
    const { page } = vecino;
    const patente = patenteAlAzar();
    await abrirEstacionamiento(page);
    const sesionId = await iniciar(page, { patente, minutos: 60 });

    await page.getByTestId(`finalizar-${sesionId}`).click();
    await esperarDialogo(page, 'confirmar-finalizar');
    await expect(page.locator('[role="dialog"]')).toContainText('No se reintegra el tiempo no usado');
    await page.getByTestId('confirmar-finalizar').click();

    await expect(page.getByTestId(`temporizador-${sesionId}`)).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId('sin-sesiones')).toBeVisible();
    await expect(page.getByTestId(`historial-${sesionId}`)).toContainText(patente);
    await expect(page.getByTestId(`historial-${sesionId}`)).toContainText('Terminada antes de tiempo');

    const otro = await nuevoVecino();
    await abrirEstacionamiento(otro.page);
    const otraSesion = await iniciar(otro.page, { patente, minutos: 15 });
    expect(otraSesion).not.toBe(sesionId);
  });

  test('E2: la misma patente desde otro vecino con la sesión activa da "patente ocupada"', async ({ vecino, nuevoVecino }) => {
    const { page } = vecino;
    const patente = patenteAlAzar();
    await abrirEstacionamiento(page);
    await iniciar(page, { patente, minutos: 30 });

    const otro = await nuevoVecino();
    await abrirEstacionamiento(otro.page);
    await otro.page.getByTestId('campo-patente').fill(patente);
    await otro.page.getByTestId('minutos-15').click();
    await otro.page.getByTestId('iniciar-estacionamiento').click();
    await esperarDialogo(otro.page, 'confirmar-estacionamiento');
    await otro.page.getByTestId('confirmar-estacionamiento').click();

    // El error va debajo del campo, con la hora de fin, y el diálogo se cierra.
    const error = otro.page.locator('#campo-patente-error');
    await expect(error).toHaveText(/La patente ya tiene una sesión activa hasta las \d\d:\d\d\./, { timeout: 20_000 });
    await expect(otro.page.getByTestId('campo-patente')).toHaveAttribute('aria-invalid', 'true');
    await expect(otro.page.locator('[role="dialog"]')).toHaveCount(0);
    await expect(otro.page.locator('[data-testid^="temporizador-"]')).toHaveCount(0);
    await expect(otro.page.getByTestId('campo-patente')).toBeFocused();
  });

  test('E1: con el control de horario encendido, una zona fuera de horario no deja iniciar', async ({ vecino, adminDb }) => {
    const { page } = vecino;
    await adminDb.doc('municipal/config').update({ horarioEstricto: true });
    await adminDb.doc('zonasEstacionamiento/p3').update({ horario: { dias: [], desde: 8, hasta: 13 } });
    await adminDb.doc('zonasEstacionamiento/p1').update({ horario: { dias: [1, 2, 3, 4, 5, 6, 7], desde: 0, hasta: 24 } });
    await abrirEstacionamiento(page);

    await expect(page.getByTestId('horario-p3')).toHaveText('Fuera de horario');
    await expect(page.getByTestId('horario-p1')).toHaveText('En horario');
    await page.getByTestId('zona-p3').click();
    await expect(page.getByTestId('aviso-horario')).toContainText('Ahora no se puede iniciar');
    await page.getByTestId('campo-patente').fill(patenteAlAzar());
    await page.getByTestId('iniciar-estacionamiento').click();
    await expect(page.getByTestId('error-iniciar')).toContainText('no cobra en este momento');
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);

    // En una zona en horario sí se puede.
    await page.getByTestId('zona-p1').click();
    await expect(page.getByTestId('error-iniciar')).toHaveCount(0);
    await expect(page.getByTestId('aviso-horario')).toHaveCount(0);
  });
});
