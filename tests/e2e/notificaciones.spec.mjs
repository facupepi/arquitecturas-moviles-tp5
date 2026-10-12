// Notificaciones (S7, secciones 8.10 y 10.3): N1 (un aviso del admin aparece en vivo), N2
// (frecuencia, tipos y zonas se guardan y filtran), N3 (detalle con enlaces, marcar leída por
// toque y por enlace profundo) y "marcar todas" idempotente. Más axe y el ancho de 360 px.
import { Timestamp } from 'firebase-admin/firestore';
import { test, expect, irA } from './fixtures.mjs';
import { revisarAccesibilidad } from './accesibilidad.mjs';

const pantalla = (page) => page.getByTestId('pantalla-notificaciones');
const tarjeta = (page, id) => page.getByTestId(`notificacion-${id}`);
const dialogo = (page) => page.locator('[role="dialog"]');
const noLeidasEnPestana = (page) => page.getByTestId('filtro-no_leidas');

async function abrirNotificaciones(page) {
  await irA(page, '#/notificaciones');
  await expect(pantalla(page)).toBeVisible();
  await expect(page.getByTestId('lista-notificaciones')).toBeVisible();
  // Los dos recordatorios de vecino/alta (T4) y la bienvenida ya están: el historial está completo.
  await expect(tarjeta(page, 'bienvenida')).toBeVisible();
  // El alta no es atómica: los recordatorios pueden llegar en otro snapshot (integración, WebKit con carga).
  await expect(page.locator('[data-testid^="notificacion-tributo-T-1001-"]')).toBeVisible();
  await expect(page.locator('[data-testid^="notificacion-tributo-T-0999-"]')).toBeVisible();
}

async function contadorNoLeidas(page) {
  const etiqueta = await noLeidasEnPestana(page).getAttribute('aria-label');
  return Number(/(\d+)$/.exec(etiqueta ?? '')?.[1] ?? NaN);
}

async function esperarPerfil(adminDb, uid, condicion) {
  await expect.poll(async () => {
    const perfil = (await adminDb.doc(`usuarios/${uid}`).get()).data();
    return condicion(perfil?.preferencias ?? {});
  }, { timeout: 10_000 }).toBe(true);
}

test.describe('Notificaciones', () => {
  // Los avisos son del catálogo del proyecto: los que crea una prueba se borran al terminar.
  test.afterEach(async ({ adminDb }) => {
    const creados = await adminDb.collection('avisos').where('detalle', '==', 'Aviso de prueba e2e.').get();
    await Promise.all(creados.docs.map((d) => d.ref.delete()));
  });

  test('historial con avisos de la ciudad, trámites y recordatorios de vencimiento', async ({ vecino }) => {
    const { page } = vecino;
    await abrirNotificaciones(page);
    // Avisos semilla de las zonas por defecto (centro y parque) y de toda la ciudad.
    await expect(tarjeta(page, 'av-obras-centro')).toBeVisible();
    await expect(tarjeta(page, 'av-evento-parque')).toBeVisible();
    await expect(tarjeta(page, 'av-servicios-todas')).toBeVisible();
    // El corte de agua es de la zona Sur, que no sigue por defecto.
    await expect(tarjeta(page, 'av-corte-sur')).toHaveCount(0);
    // T4: las notificaciones de vencimiento llegan con el alta, sin esperar la tarea diaria.
    await expect(page.locator('[data-testid^="notificacion-tributo-T-1001-"]')).toBeVisible();
    await expect(page.locator('[data-testid^="notificacion-tributo-T-0999-"]')).toBeVisible();

    // Filtros por pestaña.
    await page.getByTestId('filtro-tramites').click();
    await expect(tarjeta(page, 'av-obras-centro')).toHaveCount(0);
    await expect(tarjeta(page, 'bienvenida')).toBeVisible();
    await page.getByTestId('filtro-ciudad').click();
    await expect(tarjeta(page, 'bienvenida')).toHaveCount(0);
    await expect(tarjeta(page, 'av-obras-centro')).toBeVisible();

    await page.getByTestId('filtro-todas').click();
    await revisarAccesibilidad(page, 'notificaciones');
  });

  test('un aviso que publica el municipio aparece en vivo con un aviso flotante (N1)', async ({ vecino, adminDb }) => {
    const { page } = vecino;
    await abrirNotificaciones(page);
    const antes = await contadorNoLeidas(page);

    const id = `e2e-aviso-${Date.now()}`;
    // Lo mismo que escribe publicarAviso desde el panel (el lote con el evento lo prueba S8).
    await adminDb.doc(`avisos/${id}`).set({
      titulo: 'Corte de tránsito por obras en Bv. 25 de Mayo',
      cuerpo: 'Desvío por calle Belgrano entre las 8 y las 14 h.',
      detalle: 'Aviso de prueba e2e.',
      tipo: 'obras', zona: 'centro', destino: '#/bicicletas', enlace: 'https://www.sanfrancisco.gov.ar',
      creadoEn: Timestamp.now(), autor: 'municipalidad', eventoId: `ev-${id}`, vigenteHasta: null,
    });

    await expect(tarjeta(page, id)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('aviso-flotante')).toContainText('Corte de tránsito por obras');
    await expect.poll(() => contadorNoLeidas(page)).toBe(antes + 1);

    // N3: el detalle tiene "Más información" (externo) e "Ir al servicio" (interno).
    await tarjeta(page, id).click();
    await expect(dialogo(page)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`#/notificaciones/${id}$`));
    await expect(page.getByTestId('detalle-mas-info')).toHaveAttribute('role', 'link');
    await expect(page.getByTestId('detalle-ir-servicio')).toHaveText(/Ir a Bicicletas/);
    await revisarAccesibilidad(page, 'notificaciones-detalle');
    await page.getByTestId('detalle-ir-servicio').click();
    await expect(page.getByTestId('pantalla-bicicletas')).toBeVisible();
    await expect(page).toHaveURL(/#\/bicicletas$/);
  });

  test('abrir una notificación la marca leída y baja el contador (N3)', async ({ vecino, adminDb }) => {
    const { page, uid } = vecino;
    await abrirNotificaciones(page);
    const antes = await contadorNoLeidas(page);
    expect(antes).toBeGreaterThan(0);
    await expect(page.getByTestId('no-leida-bienvenida')).toBeVisible();

    await tarjeta(page, 'bienvenida').click();
    await expect(dialogo(page)).toBeVisible();
    await expect(dialogo(page)).toContainText('Te damos la bienvenida');
    await expect.poll(() => contadorNoLeidas(page)).toBe(antes - 1);
    await expect.poll(async () => (await adminDb.doc(`usuarios/${uid}/notificaciones/bienvenida`).get()).get('leida')).toBe(true);

    // Cerrar vuelve al historial, que ya la muestra leída.
    await page.getByTestId('detalle-volver').click();
    await expect(dialogo(page)).toHaveCount(0);
    await expect(page).toHaveURL(/#\/notificaciones$/);
    await expect(page.getByTestId('no-leida-bienvenida')).toHaveCount(0);

    // Enlace profundo a un aviso de la ciudad: se abre y queda en avisosLeidos.
    await irA(page, '#/notificaciones/av-obras-centro');
    await expect(dialogo(page)).toBeVisible();
    await expect(dialogo(page)).toContainText('Mejoras en el espacio público');
    await expect.poll(async () => (await adminDb.doc(`usuarios/${uid}/avisosLeidos/av-obras-centro`).get()).exists).toBe(true);
    await expect.poll(() => contadorNoLeidas(page)).toBe(antes - 2);
    await page.keyboard.press('Escape');
    await expect(dialogo(page)).toHaveCount(0);

    // Un id que no existe explica qué pasó en lugar de quedar en blanco.
    await irA(page, '#/notificaciones/no-existe');
    await expect(dialogo(page)).toContainText('No encontramos esa notificación');
  });

  test('marcar todas como leídas dos veces no falla', async ({ vecino, adminDb }) => {
    const { page, uid } = vecino;
    await abrirNotificaciones(page);
    expect(await contadorNoLeidas(page)).toBeGreaterThan(0);

    // Doble toque: una sola escritura, sin error.
    await page.getByTestId('marcar-todas').dblclick();
    await expect.poll(() => contadorNoLeidas(page)).toBe(0);
    await expect(page.getByTestId('resumen-no-leidas')).toHaveText('Tenés todo leído');
    await expect(page.getByTestId('insignia-no-leidas')).toHaveCount(0);

    // Con todo leído el botón ya no se ofrece.
    await expect(page.getByTestId('marcar-todas')).toHaveCount(0);
    await expect(page.getByTestId('error-marcar-todas')).toHaveCount(0);

    // En el servidor: personales con leida y avisos visibles en avisosLeidos.
    await expect.poll(async () => {
      const personales = await adminDb.collection(`usuarios/${uid}/notificaciones`).get();
      return personales.docs.every((d) => d.get('leida') === true);
    }).toBe(true);
    const leidos = await adminDb.collection(`usuarios/${uid}/avisosLeidos`).get();
    const ids = leidos.docs.map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(['av-evento-parque', 'av-obras-centro', 'av-servicios-todas']));
    // El corte de la zona Sur no se ve con las preferencias por defecto: no se marca.
    expect(ids).not.toContain('av-corte-sur');

    await page.getByTestId('filtro-no_leidas').click();
    await expect(page.getByTestId('vacio-notificaciones')).toContainText('Estás al día');
  });

  test('cambiar la frecuencia se guarda y sobrevive a la recarga (N2)', async ({ vecino, adminDb }) => {
    const { page, uid } = vecino;
    await abrirNotificaciones(page);
    await page.getByTestId('ir-preferencias').click();
    await expect(page.getByTestId('frecuencia-inmediata')).toHaveAttribute('aria-checked', 'true');

    await page.getByTestId('frecuencia-resumen_diario').click();
    await expect(page.getByTestId('frecuencia-resumen_diario')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('explicacion-frecuencia')).toContainText('a las 20');
    await expect(page.getByTestId('estado-preferencias')).toHaveText('Cambios guardados.');
    await esperarPerfil(adminDb, uid, (p) => p.frecuencia === 'resumen_diario');

    await page.reload();
    await expect(pantalla(page)).toBeVisible();
    await expect(page.getByTestId('frecuencia-resumen_diario')).toHaveAttribute('aria-checked', 'true');

    // En este navegador de prueba el push no está disponible: el interruptor lo explica.
    await expect(page.getByTestId('interruptor-push')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('push-no-disponible')).toContainText(/no están disponibles|no admite|instalada/);
    await revisarAccesibilidad(page, 'notificaciones-preferencias');
  });

  test('las preferencias filtran el historial y "Ver todos" lo muestra completo (N2, A4)', async ({ vecino, adminDb }) => {
    const { page, uid } = vecino;
    await abrirNotificaciones(page);
    await expect(tarjeta(page, 'av-corte-sur')).toHaveCount(0);

    // Seguir la zona Sur muestra el corte de agua; dejar de seguirla lo oculta.
    await page.getByTestId('zona-sur').click();
    await expect(page.getByTestId('zona-sur')).toHaveAttribute('aria-checked', 'true');
    await expect(tarjeta(page, 'av-corte-sur')).toBeVisible();
    await esperarPerfil(adminDb, uid, (p) => p.zonas?.includes('sur'));
    await page.getByTestId('zona-sur').click();
    await expect(tarjeta(page, 'av-corte-sur')).toHaveCount(0);

    // Sin el tema Eventos desaparece la feria del Parque.
    await page.getByTestId('tipo-eventos').click();
    await expect(tarjeta(page, 'av-evento-parque')).toHaveCount(0);
    await esperarPerfil(adminDb, uid, (p) => !p.tipos?.includes('eventos') && p.zonas?.includes('centro') && !p.zonas?.includes('sur'));

    // "Ver todos los avisos de la ciudad" ignora las preferencias sin cambiarlas.
    await page.getByTestId('interruptor-todos').click();
    await expect(page.getByTestId('interruptor-todos')).toHaveAttribute('aria-checked', 'true');
    await expect(tarjeta(page, 'av-corte-sur')).toBeVisible();
    await expect(tarjeta(page, 'av-evento-parque')).toBeVisible();
    await page.getByTestId('interruptor-todos').click();
    await expect(tarjeta(page, 'av-corte-sur')).toHaveCount(0);
    await esperarPerfil(adminDb, uid, (p) => !p.tipos?.includes('eventos'));
  });

  test('se ve bien a 360 px: sin desborde horizontal', async ({ vecino }) => {
    const { page } = vecino;
    await page.setViewportSize({ width: 360, height: 740 });
    await abrirNotificaciones(page);
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(desborde).toBeLessThanOrEqual(0);
    await expect(page.getByTestId('marcar-todas')).toBeInViewport();
  });
});
