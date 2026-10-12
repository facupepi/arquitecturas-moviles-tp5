// Inicio (S2, sección 8.3 y 10.3): los siete accesos a 360 × 740 sin desplazar, sin desborde a 320 px,
// datos vivos y resumen del vecino, buscador de servicios, enlace profundo y accesibilidad.
import { Timestamp } from 'firebase-admin/firestore';
import { test, expect, irA } from './fixtures.mjs';
import { revisarAccesibilidad } from './accesibilidad.mjs';
import { catalogo, datosInicialesVecino } from '../../shared/catalogo.mjs';
import { dinero } from '../../shared/formato.mjs';

const RUTAS = ['bicicletas', 'tributos', 'reclamos', 'contactos', 'alarmas', 'estacionamiento', 'notificaciones'];

// Valores esperados tomados del catálogo y de los datos iniciales, no de memoria.
const BICIS = catalogo().estaciones
  .filter((e) => e.estado !== 'fuera_de_servicio')
  .reduce((total, e) => total + e.bicicletas, 0);
const IMPAGOS = datosInicialesVecino().tributos.filter((t) => !t.pagadoEn);
const DEUDA = IMPAGOS.reduce((total, t) => total + t.importe, 0);

async function abrirInicio(page) {
  await irA(page, '#/inicio');
  await expect(page.getByTestId('pantalla-inicio')).toBeVisible();
}

test.describe('Inicio', () => {
  test('los siete servicios entran a 360 × 740 sin desplazar y sin desborde a 320 px', async ({ vecino }) => {
    const { page } = vecino;
    await page.setViewportSize({ width: 360, height: 740 });
    await abrirInicio(page);
    for (const ruta of RUTAS) {
      await expect(page.getByTestId(`servicio-${ruta}`), `acceso ${ruta}`).toBeInViewport({ ratio: 1 });
    }
    // Nada quedó tapado por la barra inferior y la pantalla no se desplazó.
    const barra = await page.getByTestId('barra-inferior').boundingBox();
    for (const ruta of RUTAS) {
      const caja = await page.getByTestId(`servicio-${ruta}`).boundingBox();
      expect(caja.y + caja.height, `acceso ${ruta} sobre la barra`).toBeLessThanOrEqual(barra.y);
    }
    expect(await page.getByTestId('pantalla-inicio').evaluate((n) => n.scrollTop)).toBe(0);

    await page.setViewportSize({ width: 320, height: 640 });
    await expect(page.getByTestId('servicio-notificaciones')).toBeVisible();
    const anchos = await page.evaluate(() => ({ documento: document.documentElement.scrollWidth, ventana: window.innerWidth }));
    expect(anchos.documento).toBeLessThanOrEqual(anchos.ventana);
  });

  test('datos vivos y resumen del vecino, que cambian sin recargar', async ({ vecino, adminDb, restablecerCatalogo }) => {
    const { page, uid } = vecino;
    await abrirInicio(page);

    await expect(page.getByTestId('dato-bicicletas')).toHaveText(`${BICIS} bicis disponibles`);
    await expect(page.getByTestId('dato-tributos')).toContainText(`${IMPAGOS.length} a pagar`);
    await expect(page.getByTestId('dato-tributos')).toContainText('1 vencido');
    await expect(page.getByTestId('dato-reclamos')).toHaveText('1 en seguimiento');
    await expect(page.getByTestId('dato-estacionamiento')).toHaveText('Sin sesión activa');
    await expect(page.getByTestId('dato-alarmas')).toHaveText('Ninguna activada');
    await expect(page.getByTestId('servicio-tributos')).toHaveAttribute('aria-label', /Mis tributos: .*a pagar, 1 vencido/);

    await expect(page.getByTestId('resumen-deuda-valor')).toHaveText(dinero(DEUDA));
    await expect(page.getByTestId('resumen-reclamos')).toContainText('R-000001');
    await expect(page.getByTestId('resumen-estacionamiento-valor')).toHaveText('Sin sesión');
    await expect(page.getByTestId('resumen-avisos-valor')).not.toHaveText('Ninguno');
    await expect(page.getByTestId('ultimo-aviso')).toBeVisible();

    try {
      // Una sesión de estacionamiento que empieza en otro dispositivo aparece sola.
      const ahora = Date.now();
      await adminDb.doc(`usuarios/${uid}/estacionamiento/e2e-sesion-inicio`).set({
        patente: 'AB123CD', zonaId: 'p1', zonaNombre: 'Municipalidad, Bv. 9 de Julio', zona: 'centro',
        minutos: 30, importe: 400, inicio: Timestamp.fromMillis(ahora), fin: Timestamp.fromMillis(ahora + 30 * 60_000),
        extensiones: 0, ultimoPagoId: 'e2e-sesion-inicio', avisoPorVencer: false, avisoFinalizado: false,
        actualizadoEn: Timestamp.fromMillis(ahora),
      });
      await expect(page.getByTestId('dato-estacionamiento')).toContainText(/Activo\s*(29|30) min/);
      await expect(page.getByTestId('servicio-estacionamiento')).toHaveAttribute('aria-label', /Activo, quedan (29|30) min/);
      await expect(page.getByTestId('resumen-estacionamiento')).toContainText('AB123CD');

      // El panel activa una alarma: el acceso lo muestra sin recargar.
      await adminDb.doc('alarmas/a1').update({ activa: true, activadaEn: Timestamp.now(), actualizadoEn: Timestamp.now() });
      await expect(page.getByTestId('dato-alarmas')).toHaveText('1 activada');
    } finally {
      await restablecerCatalogo();
    }
    await expect(page.getByTestId('dato-alarmas')).toHaveText('Ninguna activada');
  });

  test('sin avisos de la ciudad muestra "Estás al día"', async ({ vecino, adminDb, restablecerCatalogo }) => {
    const { page } = vecino;
    try {
      const avisos = await adminDb.collection('avisos').get();
      await Promise.all(avisos.docs.map((d) => d.ref.delete()));
      await abrirInicio(page);
      await expect(page.getByTestId('avisos-vacio')).toContainText('Estás al día');
    } finally {
      await restablecerCatalogo();
    }
    await expect(page.getByTestId('ultimo-aviso')).toBeVisible();
  });

  test('el buscador filtra servicios, ofrece atajos y lleva al primero con Enter', async ({ vecino }) => {
    const { page } = vecino;
    await abrirInicio(page);
    const buscador = page.getByTestId('buscar-servicios');

    await buscador.fill('patente');
    await expect(page.getByTestId('servicio-estacionamiento')).toBeVisible();
    await expect(page.getByTestId('servicio-bicicletas')).toHaveCount(0);
    await expect(page.getByTestId('resultado-busqueda')).toContainText('1 resultado');

    // Sin tildes y con atajos a trámites concretos.
    await buscador.fill('policia');
    await expect(page.getByTestId('servicio-contactos')).toBeVisible();
    await expect(page.getByTestId('atajo-emergencias')).toBeVisible();

    await buscador.fill('xyzw');
    await expect(page.getByTestId('busqueda-vacia')).toBeVisible();
    await page.getByTestId('ver-todos').click();
    await expect(page.getByTestId('grilla-servicios').locator('[data-testid^="servicio-"]')).toHaveCount(7);

    await buscador.fill('cedulon');
    await buscador.press('Enter');
    await expect(page).toHaveURL(/#\/tributos$/);
  });

  test('cada acceso navega a su servicio y el enlace profundo abre la pantalla', async ({ vecino }) => {
    const { page } = vecino;
    await abrirInicio(page);
    await page.getByTestId('servicio-contactos').click();
    await expect(page).toHaveURL(/#\/contactos$/);
    await expect(page.getByTestId('pantalla-contactos')).toBeVisible();

    // Enlace profundo #/tributos con la app recién abierta (la sesión de Google persiste).
    await page.goto('/#/tributos');
    await expect(page.getByTestId('pantalla-tributos')).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/#\/tributos$/);

    // La fila de deuda del resumen también lleva a Tributos.
    await irA(page, '#/inicio');
    await page.getByTestId('resumen-deuda').click();
    await expect(page).toHaveURL(/#\/tributos$/);
  });

  test('accesibilidad de Inicio', async ({ vecino }) => {
    const { page } = vecino;
    await abrirInicio(page);
    await expect(page.getByTestId('ultimo-aviso')).toBeVisible();
    await revisarAccesibilidad(page, 'inicio');
    await page.getByTestId('buscar-servicios').fill('reclamo');
    await expect(page.getByTestId('atajo-reclamo')).toBeVisible();
    await revisarAccesibilidad(page, 'inicio-busqueda');
  });
});
