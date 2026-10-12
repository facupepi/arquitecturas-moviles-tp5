// Panel municipal (S8, secciones 8.11 y 10.3).
//
// Cada prueba abre dos "celulares": el del vecino (fixture `vecino`) y el del administrador (fixture
// `admin`, cuenta Google con documento en administradores). Lo que el admin cambia en el panel se
// mide del lado del vecino con una escucha del mismo repositorio de la app (mismo SDK y misma
// caché que usan sus pantallas): así se comprueba el objetivo de la demo, "el celular del vecino
// cambia en menos de 2 s sin recargar", sin depender de las pantallas de otros paquetes.
import { Timestamp } from 'firebase-admin/firestore';
import { test, expect, irA, hacerAdmin, PROYECTO } from './fixtures.mjs';
import { PERFILES } from '../../scripts/emuladores.mjs';
import { revisarAccesibilidad } from './accesibilidad.mjs';
import { codigoReclamo } from '../../shared/dominio.mjs';
import { catalogo } from '../../shared/catalogo.mjs';

const MAXIMO_MS = 2000;
const { auth: PUERTO_AUTH, firestore: PUERTO_FIRESTORE, edge: PUERTO_EDGE } = PERFILES.e2e.puertos;

/** Sesión anónima nueva en el emulador de Auth (como la que dejaba la versión con invitados). */
async function sesionAnonima() {
  const r = await fetch(`http://127.0.0.1:${PUERTO_AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-clave`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }),
  });
  const datos = await r.json();
  if (!r.ok || !datos.idToken) throw new Error(`El emulador de Auth no creó la sesión anónima: ${JSON.stringify(datos)}`);
  return { uid: datos.localId, token: datos.idToken };
}

async function abrirPanel(page, pestana) {
  await irA(page, '#/panel');
  await expect(page.getByTestId('pantalla-panel')).toBeVisible();
  if (pestana) {
    const boton = page.getByTestId(`panel-pestana-${pestana}`);
    await boton.click();
    await expect(boton).toHaveAttribute('aria-selected', 'true');
  }
}

/** Espera a que un diálogo esté abierto (en WebKit hay que esperarlo antes de tocarlo). */
async function dialogo(page, testID) {
  const d = page.locator('[role="dialog"]').filter({ has: page.getByTestId(testID) }).first();
  await d.waitFor({ state: 'visible' });
  return d;
}

/**
 * Abre en el celular del vecino una escucha del repositorio y deja en window.__vioCambio una
 * promesa con el instante (Date.now) en que llega el documento con `campo === valor`.
 * Resuelve recién cuando llegó el primer snapshot, así el cambio se mide desde un estado conocido.
 */
async function escucharEnVecino(page, opciones) {
  await page.evaluate(async (o) => {
    const repo = await import('/src/datos/repositorio.js');
    let primero;
    const inicial = new Promise((r) => { primero = r; });
    window.__vioCambio = new Promise((resolver) => {
      const revisar = (lista) => {
        primero();
        const x = (Array.isArray(lista) ? lista : []).find((e) => (!o.id || e.id === o.id) && e[o.campo] === o.valor);
        if (x) resolver({ llegada: Date.now(), escrito: x[o.campoTiempo ?? 'actualizadoEn'] ?? null });
      };
      const fallar = (e) => resolver(`error ${e?.codigo ?? e}`);
      if (o.coleccion === 'estaciones') repo.suscribirEstaciones(revisar, fallar);
      else if (o.coleccion === 'alarmas') repo.suscribirAlarmas(revisar, fallar);
      else if (o.coleccion === 'avisos') repo.suscribirAvisos(50, revisar, fallar);
      else if (o.coleccion === 'reclamos') repo.suscribirReclamos(o.uid, 20, revisar, fallar);
    });
    await inicial;
  }, opciones);
}

// Demora entre la escritura confirmada en el servidor (hora del documento) y su llegada al celular del
// vecino. Se mide desde la escritura y no desde el toque para no contar lo que tarda Playwright en
// tocar el botón en WebKit con varios agentes corriendo a la vez.
async function demoraEnVecino(page, desde) {
  const vio = await page.evaluate(() => window.__vioCambio);
  expect(typeof vio, `el vecino no vio el cambio: ${vio}`).toBe('object');
  const origen = typeof vio.escrito === 'number' ? Math.max(vio.escrito, desde) : desde;
  console.log(`[S8] desde el toque ${vio.llegada - desde} ms; desde la escritura ${vio.llegada - origen} ms`);
  return vio.llegada - origen;
}

async function esperarEventoEnviado(adminDb, eventoId) {
  await expect.poll(async () => (await adminDb.doc(`eventos/${eventoId}`).get()).get('estado'), { timeout: 10_000 }).toBe('enviado');
}

async function crearReclamo(adminDb, uid, id) {
  const ahora = Timestamp.now();
  await adminDb.doc(`usuarios/${uid}/reclamos/${id}`).set({
    codigo: codigoReclamo(id), categoria: 'alumbrado', direccion: 'Belgrano 1500',
    descripcion: 'Prueba del panel: la luminaria de la esquina parpadea toda la noche.',
    estacionId: null, adjuntos: [], estado: 'recibido', cronologia: { recibido: ahora },
    notaMunicipal: null, creadoEn: ahora, actualizadoEn: ahora, ultimoEventoId: null,
  });
  return codigoReclamo(id);
}

test.describe('Panel municipal', () => {
  // Cada prueba abre dos contextos (vecino y admin) y revisa accesibilidad: en WebKit, con varios
  // agentes corriendo a la vez, el minuto por defecto queda justo.
  test.describe.configure({ timeout: 120_000 });

  // El proyecto demo-conecta-tp5-s8 es solo de este spec: cada corrida suma vecinos con su reclamo
  // de ejemplo. Se vacían reclamos y eventos al empezar para que el panel cargue liviano y las
  // pruebas no dependan de lo que dejaron corridas anteriores.
  test.beforeAll(async ({ adminDb }) => {
    for (const consulta of [adminDb.collectionGroup('reclamos'), adminDb.collection('eventos')]) {
      const snap = await consulta.get();
      for (let i = 0; i < snap.docs.length; i += 400) {
        const lote = adminDb.batch();
        for (const d of snap.docs.slice(i, i + 400)) lote.delete(d.ref);
        await lote.commit();
      }
    }
  });

  test.afterEach(async ({ restablecerCatalogo }) => {
    await restablecerCatalogo();
  });

  test('un vecino sin permiso que abre #/panel vuelve a inicio', async ({ vecino }) => {
    const { page } = vecino;
    await irA(page, '#/panel');
    await expect.poll(() => page.evaluate(() => window.location.hash), { timeout: 10_000 }).toBe('#/inicio');
    await expect(page.getByTestId('pantalla-panel')).toHaveCount(0);
  });

  test('una sesión anónima con documento de administrador es rechazada por las reglas y las funciones', async ({ adminDb, adminAuth }) => {
    const { uid, token } = await sesionAnonima();
    await hacerAdmin(adminDb, uid, 'Anónimo con documento');
    try {
      const encabezados = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      // Reglas de Firestore (API REST del emulador con el token anónimo): ni su propio documento de
      // administrador, ni su perfil, ni la bandeja de eventos.
      const documentos = `http://127.0.0.1:${PUERTO_FIRESTORE}/v1/projects/${PROYECTO}/databases/(default)/documents`;
      for (const ruta of [`administradores/${uid}`, `usuarios/${uid}`, 'eventos']) {
        const r = await fetch(`${documentos}/${ruta}`, { headers: encabezados });
        expect(r.status, ruta).toBe(403);
      }
      // Edge Functions (edge-simulado, mismo criterio que verificarUsuario de Supabase): 403 permiso.
      const funciones = `http://127.0.0.1:${PUERTO_EDGE}/p/${PROYECTO}/functions/v1`;
      for (const [ruta, cuerpo] of [['tareas', { tarea: 'diaria' }], ['despachar', {}], ['vecino/alta', {}]]) {
        const r = await fetch(`${funciones}/${ruta}`, { method: 'POST', headers: encabezados, body: JSON.stringify(cuerpo) });
        expect(r.status, ruta).toBe(403);
        expect((await r.json()).error?.codigo, ruta).toBe('permiso');
      }
      expect((await adminDb.doc(`usuarios/${uid}`).get()).exists).toBe(false);
    } finally {
      await adminDb.doc(`administradores/${uid}`).delete();
      await adminAuth.deleteUser(uid).catch(() => {});
    }
  });

  test('avanzar un reclamo: el vecino lo ve en menos de 2 s y se registra el evento', async ({ vecino, admin, adminDb }) => {
    const id = `e2e-s8-${Date.now()}`;
    const codigo = await crearReclamo(adminDb, vecino.uid, id);
    const { page } = admin;
    await abrirPanel(page);
    const tarjeta = page.getByTestId(`reclamo-panel-${id}`);
    await expect(tarjeta).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId(`estado-panel-${id}`)).toHaveText('Recibido');
    await revisarAccesibilidad(page, 'panel-reclamos');

    // Filtro por estado y búsqueda, en el cliente.
    await page.getByTestId('filtro-reclamos-resuelto').click();
    await expect(tarjeta).toHaveCount(0);
    await page.getByTestId('filtro-reclamos-recibido').click();
    await expect(tarjeta).toBeVisible();
    await page.getByTestId('buscar-reclamos-panel').fill(codigo);
    await expect(page.locator('[data-testid^="reclamo-panel-"]')).toHaveCount(1);
    await page.getByTestId('filtro-reclamos-todos').click();

    // Recibido → En proceso con una nota.
    await escucharEnVecino(vecino.page, { coleccion: 'reclamos', uid: vecino.uid, id, campo: 'estado', valor: 'en_proceso' });
    await page.getByTestId(`avanzar-${id}`).click();
    const d = await dialogo(page, 'confirmar-avance');
    await expect(d).toContainText(codigo);
    await page.getByTestId('nota-reclamo').fill('La cuadrilla pasa mañana a la mañana.');
    await revisarAccesibilidad(page, 'panel-dialogo-avance');
    const desde = Date.now();
    await page.getByTestId('confirmar-avance').click();
    await expect(page.getByTestId(`estado-panel-${id}`)).toHaveText('En proceso');
    expect(await demoraEnVecino(vecino.page, desde)).toBeLessThan(MAXIMO_MS);
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);

    const reclamo = (await adminDb.doc(`usuarios/${vecino.uid}/reclamos/${id}`).get()).data();
    expect(reclamo.estado).toBe('en_proceso');
    expect(reclamo.cronologia.en_proceso).toBeTruthy();
    expect(reclamo.notaMunicipal).toBe('La cuadrilla pasa mañana a la mañana.');
    expect(reclamo.ultimoEventoId).toMatch(/^ev-/);
    const evento = (await adminDb.doc(`eventos/${reclamo.ultimoEventoId}`).get()).data();
    expect(evento).toMatchObject({ tipo: 'reclamo', refId: id, uid: vecino.uid, origen: 'panel' });
    await esperarEventoEnviado(adminDb, reclamo.ultimoEventoId);
    await expect(page.getByTestId(`envio-reclamo-${id}`)).toContainText('Avisado');

    // En proceso → Resuelto: ya no queda botón para avanzar.
    await page.getByTestId(`avanzar-${id}`).click();
    await dialogo(page, 'confirmar-avance');
    await page.getByTestId('confirmar-avance').click();
    await expect(page.getByTestId(`estado-panel-${id}`)).toHaveText('Resuelto');
    await expect(page.getByTestId(`avanzar-${id}`)).toHaveCount(0);
    // La interfaz ya muestra el lote aplicado en local; el servidor lo confirma enseguida.
    await expect.poll(async () => (await adminDb.doc(`usuarios/${vecino.uid}/reclamos/${id}`).get()).get('estado')).toBe('resuelto');
  });

  test('activar y desactivar una alarma: el vecino la ve en menos de 2 s', async ({ vecino, admin, adminDb }) => {
    const { page } = admin;
    await abrirPanel(page, 'alarmas');
    const interruptor = page.getByTestId('alarma-panel-a5');
    await expect(interruptor).toHaveAttribute('aria-checked', 'false');
    await revisarAccesibilidad(page, 'panel-alarmas');

    await escucharEnVecino(vecino.page, { coleccion: 'alarmas', id: 'a5', campo: 'activa', valor: true, campoTiempo: 'actualizadoEn' });
    const desde = Date.now();
    await interruptor.click();
    await expect(interruptor).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('estado-alarma-panel-a5')).toHaveText('Activada');
    expect(await demoraEnVecino(vecino.page, desde)).toBeLessThan(MAXIMO_MS);
    await expect(page.getByTestId('panel-pestana-alarmas')).toHaveAttribute('aria-label', 'Alarmas, 1');

    const alarma = (await adminDb.doc('alarmas/a5').get()).data();
    expect(alarma.activa).toBe(true);
    expect(alarma.activacionId).toMatch(/^ev-/);
    expect((await adminDb.doc(`eventos/${alarma.activacionId}`).get()).data()).toMatchObject({ tipo: 'alarma', refId: 'a5', origen: 'panel' });
    await esperarEventoEnviado(adminDb, alarma.activacionId);
    await expect(page.getByTestId('envio-alarma-a5')).toContainText('Avisado');

    await escucharEnVecino(vecino.page, { coleccion: 'alarmas', id: 'a5', campo: 'activa', valor: false });
    const desde2 = Date.now();
    await interruptor.click();
    await expect(interruptor).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('estado-alarma-panel-a5')).toHaveText('Desactivada');
    expect(await demoraEnVecino(vecino.page, desde2)).toBeLessThan(MAXIMO_MS);
    await expect.poll(async () => (await adminDb.doc('alarmas/a5').get()).get('activa')).toBe(false);
  });

  test('mover bicicletas y marcar una estación fuera de servicio', async ({ vecino, admin, adminDb }) => {
    const { page } = admin;
    await abrirPanel(page, 'bicicletas');
    const inicial = (await adminDb.doc('estaciones/b7').get()).get('bicicletas');
    const numero = page.getByTestId('bicicletas-panel-b7');
    await expect(numero).toHaveText(String(inicial));
    await revisarAccesibilidad(page, 'panel-bicicletas');

    await escucharEnVecino(vecino.page, { coleccion: 'estaciones', id: 'b7', campo: 'bicicletas', valor: inicial + 1 });
    const desde = Date.now();
    await page.getByTestId('mas-b7').click();
    await expect(numero).toHaveText(String(inicial + 1));
    expect(await demoraEnVecino(vecino.page, desde)).toBeLessThan(MAXIMO_MS);
    expect((await adminDb.doc('estaciones/b7').get()).get('bicicletas')).toBe(inicial + 1);

    await expect(page.getByTestId('menos-b7')).not.toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('menos-b7').click();
    await expect(numero).toHaveText(String(inicial));
    await expect.poll(async () => (await adminDb.doc('estaciones/b7').get()).get('bicicletas')).toBe(inicial);

    // b6 arranca sin bicicletas: no se puede quitar.
    await expect(page.getByTestId('menos-b6')).toHaveAttribute('aria-disabled', 'true');

    await escucharEnVecino(vecino.page, { coleccion: 'estaciones', id: 'b7', campo: 'estado', valor: 'fuera_de_servicio' });
    await page.getByTestId('fuera-servicio-b7').click();
    await expect(page.getByTestId('estado-estacion-panel-b7')).toHaveText('Fuera de servicio');
    expect(typeof await vecino.page.evaluate(() => window.__vioCambio)).toBe('object');
    expect((await adminDb.doc('estaciones/b7').get()).get('estado')).toBe('fuera_de_servicio');
  });

  test('publicar un aviso: errores junto al campo y el vecino lo recibe en menos de 2 s', async ({ vecino, admin, adminDb }) => {
    const { page } = admin;
    await abrirPanel(page, 'avisos');

    // Formulario vacío: cada error queda debajo de su campo.
    await page.getByTestId('publicar-aviso').click();
    await expect(page.getByTestId('campo-aviso-titulo')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Escribí un título de al menos 3 letras.')).toBeVisible();
    await expect(page.getByText('Escribí el aviso con al menos 10 caracteres.')).toBeVisible();
    await expect(page.getByText('Elegí de qué se trata el aviso.')).toBeVisible();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await revisarAccesibilidad(page, 'panel-avisos-errores');

    const titulo = `Corte de agua e2e ${Date.now()}`;
    await page.getByTestId('campo-aviso-titulo').fill(titulo);
    await page.getByTestId('campo-aviso-cuerpo').fill('Mañana de 8 a 12 h no hay agua en barrio Bouchard por obras en la red.');
    await page.getByTestId('aviso-tipo-cortes').click();
    await page.getByTestId('aviso-zona-sur').click();
    await page.getByTestId('aviso-destino').click();
    await dialogo(page, 'aviso-destino-reclamos');
    await page.getByTestId('aviso-destino-reclamos').click();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await page.getByTestId('campo-aviso-enlace').fill('http://sin-https.example');
    await page.getByTestId('publicar-aviso').click();
    await expect(page.getByTestId('campo-aviso-enlace')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText(/El enlace tiene que empezar con https:\/\//)).toBeVisible();
    await page.getByTestId('campo-aviso-enlace').fill('https://www.sanfrancisco.gov.ar');
    await expect(page.getByTestId('vista-previa-aviso')).toContainText(titulo);

    await page.getByTestId('publicar-aviso').click();
    const d = await dialogo(page, 'confirmar-publicacion');
    await expect(d).toContainText(titulo);
    await expect(d).toContainText('Sur');
    await escucharEnVecino(vecino.page, { coleccion: 'avisos', campo: 'titulo', valor: titulo, campoTiempo: 'creadoEn' });
    const desde = Date.now();
    await page.getByTestId('confirmar-publicacion').click();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    expect(await demoraEnVecino(vecino.page, desde)).toBeLessThan(MAXIMO_MS);
    await expect(page.getByTestId('campo-aviso-titulo')).toHaveValue('');

    const snap = await adminDb.collection('avisos').where('titulo', '==', titulo).get();
    expect(snap.size).toBe(1);
    const aviso = snap.docs[0].data();
    expect(aviso).toMatchObject({
      tipo: 'cortes', zona: 'sur', destino: '#/reclamos', enlace: 'https://www.sanfrancisco.gov.ar', autor: 'municipalidad',
    });
    expect(aviso.eventoId).toBe(`ev-${snap.docs[0].id}`);
    await esperarEventoEnviado(adminDb, aviso.eventoId);
    await expect(page.getByTestId(`aviso-panel-${snap.docs[0].id}`)).toContainText(titulo);
    await expect(page.getByTestId(`envio-aviso-${snap.docs[0].id}`)).toContainText('Avisado');
  });

  test('demo: recordatorios, resumen, simulador, configuración y restablecer', async ({ vecino, admin, adminDb }) => {
    // Se borra el recordatorio de T-1001 del vecino para que "Enviar recordatorios ahora" lo vuelva a crear (T4).
    const notificaciones = adminDb.collection(`usuarios/${vecino.uid}/notificaciones`);
    const previos = (await notificaciones.get()).docs.filter((d) => d.id.startsWith('tributo-T-1001-'));
    expect(previos.length).toBeGreaterThan(0);
    for (const d of previos) await d.ref.delete();

    const { page } = admin;
    await abrirPanel(page, 'demo');
    await expect(page.getByTestId('lista-eventos').or(page.getByTestId('vacio-eventos'))).toBeVisible({ timeout: 30_000 });
    await revisarAccesibilidad(page, 'panel-demo');

    await page.getByTestId('recordatorios-ahora').click();
    await expect(page.getByTestId('resultado-recordatorios')).toContainText(/Se crearon \d+ recordatorios? de vencimiento/);
    await expect.poll(async () => (await notificaciones.get()).docs.filter((d) => d.id.startsWith('tributo-T-1001-')).length).toBeGreaterThan(0);

    await page.getByTestId('resumen-ahora').click();
    await expect(page.getByTestId('resultado-resumen')).toBeVisible();

    await page.getByTestId('simulador-ahora').click();
    await expect(page.getByTestId('resultado-simulador')).toContainText(/simulador|Este paso/);
    await expect.poll(async () => (await adminDb.doc('municipal/config').get()).get('ultimaSimulacion')).toBeTruthy();

    // Aviso de estacionamiento a los 14 minutos del fin (valor de la clase).
    await page.getByTestId('aviso-estacionamiento-min').click();
    await dialogo(page, 'aviso-estacionamiento-min-14');
    await page.getByTestId('aviso-estacionamiento-min-14').click();
    await expect.poll(async () => (await adminDb.doc('municipal/config').get()).get('avisoEstacionamientoMin')).toBe(14);
    await expect(page.getByTestId('aviso-estacionamiento-min')).toHaveAttribute('aria-label', /14 minutos/);

    const horario = page.getByTestId('interruptor-horario');
    const antes = (await adminDb.doc('municipal/config').get()).get('horarioEstricto');
    await horario.click();
    await expect.poll(async () => (await adminDb.doc('municipal/config').get()).get('horarioEstricto')).toBe(!antes);
    await expect(horario).toHaveAttribute('aria-checked', String(!antes));

    const simulador = page.getByTestId('interruptor-simulador');
    await simulador.click();
    await expect.poll(async () => (await adminDb.doc('municipal/config').get()).get('simuladorActivo')).toBe(true);
    await page.getByTestId('simulador-cada-5').click();
    await expect.poll(async () => (await adminDb.doc('municipal/config').get()).get('simuladorCadaMin')).toBe(5);

    // Restablecer: con una alarma activada y bicicletas movidas, todo vuelve al catálogo.
    await adminDb.doc('alarmas/a2').update({ activa: true });
    await adminDb.doc('estaciones/b1').update({ bicicletas: 1 });
    await page.getByTestId('restablecer-demo').click();
    await dialogo(page, 'confirmar-restablecer');
    await page.getByTestId('confirmar-restablecer').click();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await expect.poll(async () => (await adminDb.doc('municipal/config').get()).data()).toMatchObject({
      simuladorActivo: false, avisoEstacionamientoMin: 5, simuladorCadaMin: 2,
    });
    expect((await adminDb.doc('alarmas/a2').get()).get('activa')).toBe(false);
    expect((await adminDb.doc('estaciones/b1').get()).get('bicicletas')).toBe(catalogo().estaciones.find((e) => e.id === 'b1').bicicletas);
  });
});
