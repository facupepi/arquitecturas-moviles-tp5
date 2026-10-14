// Alarmas comunitarias (S3, secciones 8.6 y 10.3): A1 mapa, A2 estado en vivo con un solo aviso
// flotante, A3 cercanía (guarda ids y no coordenadas, y sigue activa al volver de otra pantalla)
// y A4 zonas que sigue el vecino. Los datos salen del catálogo de shared/ y del emulador.
import { Timestamp } from 'firebase-admin/firestore';
import { test, expect, irA, geolocalizar, esperarListo } from './fixtures.mjs';
import { revisarAccesibilidad } from './accesibilidad.mjs';
import { catalogo } from '../../shared/catalogo.mjs';
import { alarmasCercanas } from '../../shared/notificaciones.mjs';
import { LIMITES } from '../../shared/constantes.mjs';

const CATALOGO = catalogo();
const ALARMAS = CATALOGO.alarmas;
const porId = (id) => ALARMAS.find((a) => a.id === id);
const PARQUE = porId('a2');

async function abrirAlarmas(page, hash = '#/alarmas') {
  await irA(page, hash);
  await expect(page.getByTestId('pantalla-alarmas')).toBeVisible();
  await expect(page.locator('[data-testid^="alarma-a"]')).toHaveCount(ALARMAS.length);
}

async function desactivar(adminDb, id) {
  await adminDb.doc(`alarmas/${id}`).update({ activa: false, activadaEn: null, activacionId: null, actualizadoEn: Timestamp.now() });
}

async function perfil(adminDb, uid) {
  return (await adminDb.doc(`usuarios/${uid}`).get()).data() ?? {};
}

/** Claves de un objeto (a cualquier profundidad), para buscar coordenadas guardadas. */
function claves(valor, salida = []) {
  if (valor && typeof valor === 'object' && !(valor instanceof Timestamp)) {
    for (const [k, v] of Object.entries(valor)) {
      salida.push(k);
      claves(v, salida);
    }
  }
  return salida;
}

test.describe('Alarmas', () => {
  test('A1 y A2: activar una alarma cambia la etiqueta en vivo y muestra un solo aviso flotante', async ({ vecino, adminDb }) => {
    const { page } = vecino;
    await abrirAlarmas(page);
    await expect(page.locator('[data-testid="mapa-alarmas"] path.leaflet-interactive')).toHaveCount(ALARMAS.length);
    for (const a of ALARMAS) await expect(page.getByTestId(`estado-alarma-${a.id}`)).toHaveText('Desactivada');
    await expect(page.getByTestId('aviso-sin-alarmas')).toBeVisible();
    await revisarAccesibilidad(page, 'alarmas', { excluir: ['.leaflet-tile-pane'] });

    try {
      // Precalentamiento (como en B2): con el emulador, WebKit usa long polling y un cambio que llega
      // mientras se reabre la consulta larga puede tardar ~3 s, sobre todo con varias pruebas a la vez.
      // Se comprueba que la escucha está en vivo con una marca visible propia ("hace 30 min"; la
      // pantalla refresca su reloj por minuto, por eso 29 o 30), se deja pasar el ciclo y recién ahí
      // se mide el requisito de 2 s (integración). Entre el número y "min" va un espacio duro (\s).
      await adminDb.doc(`alarmas/${PARQUE.id}`).update({ actualizadoEn: Timestamp.fromMillis(Date.now() - 30 * 60_000) });
      await expect(page.getByTestId(`alarma-${PARQUE.id}`)).toContainText(/Actualizada hace (29|30)\smin/, { timeout: 15_000 });
      await page.waitForTimeout(3000);
      await adminDb.doc(`alarmas/${PARQUE.id}`).update({
        activa: true,
        activadaEn: Timestamp.now(),
        activacionId: `ev-e2e-${Date.now()}`,
        actualizadoEn: Timestamp.now(),
      });
      await expect(page.getByTestId(`estado-alarma-${PARQUE.id}`)).toHaveText('Activada', { timeout: 2000 });
      await expect(page.getByTestId('aviso-alarmas-activas')).toContainText(PARQUE.nombre);
      // La activada queda primera en la lista.
      await expect(page.locator('[data-testid^="alarma-a"]').first()).toHaveAttribute('data-testid', `alarma-${PARQUE.id}`);

      // Un solo aviso flotante, aunque la alarma y su estado lleguen en varios snapshots.
      const flotante = page.getByTestId('aviso-flotante');
      await expect(flotante).toHaveCount(1);
      await expect(flotante).toContainText(PARQUE.nombre);
      await page.waitForTimeout(1500);
      await expect(flotante).toHaveCount(1);
      // "Ver" lleva al enlace profundo de la alarma y el aviso no vuelve a aparecer.
      await page.getByTestId('aviso-flotante-ver').click();
      await expect(page).toHaveURL(new RegExp(`#/alarmas/${PARQUE.id}$`));
      await expect(page.getByTestId('mapa-alarmas-seleccion')).toHaveText(PARQUE.nombre);
      await page.waitForTimeout(2500);
      await expect(flotante).toHaveCount(0);
      await revisarAccesibilidad(page, 'alarmas-activada', { excluir: ['.leaflet-tile-pane'] });
    } finally {
      await desactivar(adminDb, PARQUE.id);
    }
    await expect(page.getByTestId(`estado-alarma-${PARQUE.id}`)).toHaveText('Desactivada', { timeout: 2000 });
  });

  test('A4: seguir una zona guarda la preferencia', async ({ vecino, adminDb }) => {
    const { page, uid } = vecino;
    await abrirAlarmas(page);
    const zonasIniciales = (await perfil(adminDb, uid)).preferencias.zonas;
    for (const z of ['centro', 'parque', 'norte', 'sur']) {
      await expect(page.getByTestId(`zona-${z}`)).toHaveAttribute('aria-checked', String(zonasIniciales.includes(z)));
    }

    await page.getByTestId('zona-norte').click();
    await expect(page.getByTestId('zona-norte')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('zonas-guardadas')).toBeVisible();
    await expect.poll(async () => (await perfil(adminDb, uid)).preferencias.zonas).toContain('norte');
    // La tarjeta de la alarma de esa zona lo dice.
    await expect(page.getByTestId('alarma-a4')).toContainText('Seguís esta zona');

    // Dos toques seguidos: se guarda la última elección (no se pierde ninguno).
    await page.getByTestId('zona-sur').click();
    await page.getByTestId('zona-centro').click();
    const elegidas = new Set(zonasIniciales);
    for (const z of ['norte', 'sur', 'centro']) {
      if (elegidas.has(z)) elegidas.delete(z); else elegidas.add(z);
    }
    const esperadas = ['centro', 'parque', 'norte', 'sur'].filter((z) => elegidas.has(z));
    await expect.poll(async () => (await perfil(adminDb, uid)).preferencias.zonas, { timeout: 10_000 }).toEqual(esperadas);

    // Persiste al recargar.
    await page.reload();
    await esperarListo(page);
    await expect(page.getByTestId('pantalla-alarmas')).toBeVisible();
    for (const z of ['centro', 'parque', 'norte', 'sur']) {
      await expect(page.getByTestId(`zona-${z}`)).toHaveAttribute('aria-checked', String(esperadas.includes(z)));
    }
  });

  test('A3: la cercanía guarda ids y no coordenadas, y sigue activa al volver', async ({ vecino, adminDb }) => {
    const { page, uid, contexto } = vecino;
    const posicion = { lat: PARQUE.lat + 0.001, lng: PARQUE.lng - 0.001 };
    await geolocalizar(contexto, posicion);
    await abrirAlarmas(page);
    const interruptor = page.getByTestId('interruptor-cercania');
    await expect(interruptor).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('privacidad-cercania')).toContainText('Tu ubicación no se guarda');

    const antes = Date.now();
    await interruptor.click();
    await expect(interruptor).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('cercania-activa')).toContainText(PARQUE.nombre);
    await expect(page.getByTestId(`cerca-${PARQUE.id}`)).toBeVisible();

    const esperadas = alarmasCercanas(ALARMAS, posicion, LIMITES.radioAlarmaKm);
    await expect.poll(async () => (await perfil(adminDb, uid)).cercania?.alarmas ?? null).toEqual(esperadas);
    const doc = await perfil(adminDb, uid);
    expect(Object.keys(doc.cercania).sort()).toEqual(['alarmas', 'vence']);
    const vence = doc.cercania.vence.toMillis();
    expect(vence).toBeGreaterThan(antes + 20 * 60_000);
    expect(vence).toBeLessThanOrEqual(Date.now() + 61 * 60_000);
    // Ninguna coordenada en todo el perfil.
    const nombres = claves(doc).map((k) => k.toLowerCase());
    for (const prohibida of ['lat', 'lng', 'latitud', 'longitud', 'latitude', 'longitude', 'posicion', 'ubicacion', 'coords']) {
      expect(nombres).not.toContain(prohibida);
    }
    expect(JSON.stringify(doc)).not.toContain(String(posicion.lat).slice(0, 7));

    // Sigue activa al ir a otra pantalla y volver (el estado vive en el almacén).
    await irA(page, '#/bicicletas');
    await expect(page.getByTestId('pantalla-bicicletas')).toBeVisible();
    await irA(page, '#/alarmas');
    await expect(page.getByTestId('pantalla-alarmas')).toBeVisible();
    await expect(page.getByTestId('interruptor-cercania')).toHaveAttribute('aria-checked', 'true');
    await revisarAccesibilidad(page, 'alarmas-cercania', { excluir: ['.leaflet-tile-pane'] });

    // Apagarla borra el registro.
    await page.getByTestId('interruptor-cercania').click();
    await expect(page.getByTestId('interruptor-cercania')).toHaveAttribute('aria-checked', 'false');
    await expect.poll(async () => (await perfil(adminDb, uid)).cercania ?? null).toBeNull();
  });

  test('A3: sin permiso de ubicación explica qué pasó y no queda prendida', async ({ vecino }) => {
    const { page } = vecino;
    await abrirAlarmas(page);
    await page.evaluate(() => {
      const negar = (_ok, error) => setTimeout(() => error({ code: 1, message: 'User denied Geolocation' }), 20);
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: { getCurrentPosition: negar, watchPosition: (ok, error) => { negar(ok, error); return 1; }, clearWatch() {} },
      });
    });
    await page.getByTestId('interruptor-cercania').click();
    await expect(page.getByTestId('error-cercania')).toContainText('Permití el acceso');
    await expect(page.getByTestId('interruptor-cercania')).toHaveAttribute('aria-checked', 'false');
  });

  test('enlace profundo a una alarma de la zona Sur', async ({ vecino }) => {
    const { page } = vecino;
    const sur = ALARMAS.find((a) => a.zona === 'sur');
    await abrirAlarmas(page, `#/alarmas/${sur.id}`);
    await expect(page.getByTestId('mapa-alarmas-seleccion')).toHaveText(sur.nombre);
    await expect(page.getByTestId(`alarma-${sur.id}`)).toContainText('Zona Sur');
    await page.getByTestId('ver-mapa-a1').click();
    await expect(page.getByTestId('mapa-alarmas-seleccion')).toHaveText(porId('a1').nombre);
  });
});
