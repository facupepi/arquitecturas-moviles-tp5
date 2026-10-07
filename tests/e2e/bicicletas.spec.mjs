// Bicicletas públicas (S3, secciones 8.5 y 10.3): B1 marcadores en el mapa, B2 disponibilidad en
// tiempo real, B3 estaciones cercanas con la ubicación y B4 "Reportar problema" con el reclamo
// precargado. Los valores salen del catálogo de shared/ y de lo sembrado, nunca de memoria.
import { Timestamp } from 'firebase-admin/firestore';
import { test, expect, irA, geolocalizar } from './fixtures.mjs';
import { revisarAccesibilidad } from './accesibilidad.mjs';
import { catalogo } from '../../shared/catalogo.mjs';
import { ordenarPorCercania } from '../../shared/dominio.mjs';

const CATALOGO = catalogo();
const ESTACIONES = CATALOGO.estaciones;
const porId = (id) => ESTACIONES.find((e) => e.id === id);
const UTN = porId('b5');

async function abrirBicicletas(page, hash = '#/bicicletas') {
  await irA(page, hash);
  await expect(page.getByTestId('pantalla-bicicletas')).toBeVisible();
  await expect(page.locator('[data-testid^="estacion-b"]')).toHaveCount(ESTACIONES.length);
}

/** testID de las tarjetas de estación en el orden en que se ven. */
async function ordenVisible(page) {
  return page.locator('[data-testid^="estacion-b"]').evaluateAll((nodos) => nodos.map((n) => n.dataset.testid));
}

/** Deja una estación como en el catálogo (las pruebas corren de a una, pero no se asume nada). */
async function restaurarEstacion(adminDb, id) {
  const e = porId(id);
  await adminDb.doc(`estaciones/${id}`).update({ bicicletas: e.bicicletas, estado: e.estado, actualizadoEn: Timestamp.now() });
}

test.describe('Bicicletas', () => {
  test('B1: marcadores en el mapa, disponibilidad sembrada y selección', async ({ vecino, adminDb }) => {
    const { page } = vecino;
    await abrirBicicletas(page);

    // Un marcador por estación (circleMarker de Leaflet), sin el de la ubicación.
    const marcadores = page.locator('[data-testid="mapa-estaciones"] path.leaflet-interactive');
    await expect(marcadores).toHaveCount(ESTACIONES.length);

    // Cada tarjeta muestra lo que hay en Firestore ahora.
    const total = { bicis: 0 };
    for (const e of ESTACIONES) {
      const doc = (await adminDb.doc(`estaciones/${e.id}`).get()).data();
      await expect(page.getByTestId(`bicicletas-${e.id}`)).toHaveText(String(doc.bicicletas));
      await expect(page.getByTestId(`anclajes-${e.id}`)).toHaveText(String(doc.capacidad - doc.bicicletas));
      if (doc.estado !== 'fuera_de_servicio') total.bicis += doc.bicicletas;
    }
    await expect(page.getByTestId('bicicletas-total')).toHaveText(String(total.bicis));
    // La estación sin bicicletas del catálogo lo dice con texto, no solo con color.
    const vacia = ESTACIONES.find((e) => e.bicicletas === 0);
    await expect(page.getByTestId(`estado-estacion-${vacia.id}`)).toHaveText('Sin bicicletas');

    // "Ver en mapa" elige la estación debajo del mapa.
    await page.getByTestId('ver-mapa-b4').click();
    await expect(page.getByTestId('mapa-estaciones-seleccion')).toHaveText(porId('b4').nombre);

    // Tocar un marcador también la elige.
    await marcadores.first().click({ force: true });
    await expect(page.getByTestId('mapa-estaciones-seleccion')).not.toHaveText('Seleccioná un punto en el mapa');

    await revisarAccesibilidad(page, 'bicicletas', { excluir: ['.leaflet-tile-pane'] });
  });

  test('B3: con la ubicación simulada, la lista se ordena por cercanía', async ({ vecino }) => {
    const { page, contexto } = vecino;
    await abrirBicicletas(page);
    const antes = await ordenVisible(page);

    const posicion = { lat: UTN.lat + 0.0005, lng: UTN.lng + 0.0005 };
    await geolocalizar(contexto, posicion);
    await page.getByTestId('usar-ubicacion').click();

    const esperado = ordenarPorCercania(ESTACIONES, posicion).map((e) => `estacion-${e.id}`);
    await expect(page.getByTestId('aviso-cercana')).toContainText(UTN.nombre);
    await expect.poll(() => ordenVisible(page)).toEqual(esperado);
    expect(esperado).not.toEqual(antes);
    await expect(page.getByTestId('distancia-b5')).toHaveText(/^Estás a \d+ m$/);
    await expect(page.getByTestId('mapa-estaciones-seleccion')).toHaveText(UTN.nombre);
    await expect(page.getByRole('heading', { name: 'Estaciones por cercanía' })).toBeVisible();
  });

  test('B3: si se niega la ubicación, pide elegir en el mapa', async ({ vecino }) => {
    const { page } = vecino;
    await abrirBicicletas(page);
    // Simula el permiso denegado (código 1 de la API de geolocalización) en los dos motores.
    await page.evaluate(() => {
      const negar = (_ok, error) => setTimeout(() => error({ code: 1, message: 'User denied Geolocation' }), 20);
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: { getCurrentPosition: negar, watchPosition: (ok, error) => { negar(ok, error); return 1; }, clearWatch() {} },
      });
    });
    await page.getByTestId('usar-ubicacion').click();
    const aviso = page.getByTestId('aviso-ubicacion');
    await expect(aviso).toContainText('Elegí una estación en el mapa');
    await expect(aviso).toContainText('Permití el acceso');
    await expect(page.locator('[data-testid^="distancia-"]')).toHaveCount(0);
  });

  test('B2: el cambio de bicicletas se ve en menos de 2 s sin recargar', async ({ vecino, adminDb }) => {
    const { page } = vecino;
    await abrirBicicletas(page);
    const ref = adminDb.doc('estaciones/b2');
    const antes = (await ref.get()).data();
    const nuevo = antes.bicicletas < antes.capacidad ? antes.bicicletas + 1 : antes.bicicletas - 1;
    const totalAntes = Number(await page.getByTestId('bicicletas-total').textContent());
    await expect(page.getByTestId('bicicletas-b2')).toHaveText(String(antes.bicicletas));
    try {
      // Precalentamiento: con el emulador, WebKit usa long polling y un cambio que llega apenas
      // abierta la pantalla (o enseguida de otro) puede tardar ~3 s mientras se reabre la consulta
      // larga. Se espera a que la escucha esté en vivo (la hora de actualización cambia sola), se deja
      // pasar el ciclo como pasaría en la demo y recién ahí se mide el requisito de 2 s.
      await ref.update({ actualizadoEn: Timestamp.now() });
      await expect(page.getByTestId('actualizado-b2')).toHaveText('Actualizado recién', { timeout: 15_000 });
      await page.waitForTimeout(3000);
      await ref.update({ bicicletas: nuevo, actualizadoEn: Timestamp.now() });
      await expect(page.getByTestId('bicicletas-b2')).toHaveText(String(nuevo), { timeout: 2000 });
      await expect(page.getByTestId('anclajes-b2')).toHaveText(String(antes.capacidad - nuevo));
      await expect(page.getByTestId('bicicletas-total')).toHaveText(String(totalAntes + nuevo - antes.bicicletas));
      await expect(page.getByTestId('actualizado-b2')).toHaveText('Actualizado recién');

      // Fuera de servicio: etiqueta con texto y marcador en otro tono.
      await adminDb.doc('estaciones/b4').update({ estado: 'fuera_de_servicio', actualizadoEn: Timestamp.now() });
      await expect(page.getByTestId('estado-estacion-b4')).toHaveText('Fuera de servicio');
    } finally {
      await restaurarEstacion(adminDb, 'b2');
      await restaurarEstacion(adminDb, 'b4');
    }
    await expect(page.getByTestId('bicicletas-b2')).toHaveText(String(porId('b2').bicicletas));
  });

  test('B4: "Reportar problema" abre el reclamo con la estación precargada', async ({ vecino }) => {
    const { page } = vecino;
    await abrirBicicletas(page);
    await page.getByTestId('reportar-b2').click();
    await expect(page).toHaveURL(/#\/reclamos\/nuevo\?estacion=b2$/);
    // Precarga del formulario de Reclamos (S5, sección 8.8).
    await expect(page.getByTestId('pantalla-reclamos')).toBeVisible();
    await expect(page.getByTestId('campo-categoria-bicicletas')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('campo-direccion')).toHaveValue(/Municipalidad/);
  });

  test('buscador, estado vacío y enlace profundo', async ({ vecino }) => {
    const { page } = vecino;
    await abrirBicicletas(page, '#/bicicletas/b3');
    await expect(page.getByTestId('mapa-estaciones-seleccion')).toHaveText(porId('b3').nombre);

    const buscador = page.getByTestId('buscar-estacion');
    await buscador.fill('utn');
    await expect(page.locator('[data-testid^="estacion-b"]')).toHaveCount(1);
    await expect(page.getByTestId('estacion-b5')).toBeVisible();
    // Sin tildes también encuentra ("ómnibus" está en la referencia de la Terminal).
    await buscador.fill('omnibus');
    await expect(page.getByTestId('estacion-b4')).toBeVisible();

    await buscador.fill('zzz');
    await expect(page.getByTestId('estaciones-sin-resultados')).toContainText('No encontramos estaciones');
    await page.getByTestId('limpiar-busqueda').click();
    await expect(page.locator('[data-testid^="estacion-b"]')).toHaveCount(ESTACIONES.length);
    await revisarAccesibilidad(page, 'bicicletas-busqueda', { excluir: ['.leaflet-tile-pane'] });
  });
});
