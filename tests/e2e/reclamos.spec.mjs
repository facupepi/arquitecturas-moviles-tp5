// Reclamos (S5, secciones 8.8 y 10.3): R1 errores junto al campo, R2 adjuntos (PNG y PDF) en el
// almacenamiento, envío sin conexión que queda pendiente, R4 búsqueda y "Cargar más", R3 avance del
// admin en vivo y precarga desde Bicicletas (B4). Cada pantalla pasa por axe.
import { deflateSync, crc32 } from 'node:zlib';
import { Timestamp } from 'firebase-admin/firestore';
import { test, expect, irA } from './fixtures.mjs';
import { revisarAccesibilidad } from './accesibilidad.mjs';

// ---------- Archivos de prueba ----------

function trozoPng(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const control = Buffer.alloc(4);
  control.writeUInt32BE(crc32(cuerpo) >>> 0);
  return Buffer.concat([largo, cuerpo, control]);
}

/** PNG RGB de ancho × alto con un degradé (una "foto" de prueba que se ve en la miniatura). */
function crearPng(ancho = 120, alto = 90) {
  const filas = [];
  for (let y = 0; y < alto; y += 1) {
    const fila = Buffer.alloc(1 + ancho * 3);
    for (let x = 0; x < ancho; x += 1) {
      fila[1 + x * 3] = 40 + Math.round((x / ancho) * 160);
      fila[2 + x * 3] = 90 + Math.round((y / alto) * 120);
      fila[3 + x * 3] = 170;
    }
    filas.push(fila);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozoPng('IHDR', ihdr),
    trozoPng('IDAT', deflateSync(Buffer.concat(filas))),
    trozoPng('IEND', Buffer.alloc(0)),
  ]);
}

const PNG = { name: 'bache-en-la-esquina.png', mimeType: 'image/png', buffer: crearPng() };
const PDF = {
  name: 'nota-vecinal.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'),
};
const TEXTO = { name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('esto no es una foto') };

// ---------- Ayudantes ----------

async function abrirReclamos(page, hash = '#/reclamos') {
  await irA(page, hash);
  await expect(page.getByTestId('pantalla-reclamos')).toBeVisible();
  await expect(page.getByTestId('formulario-reclamo')).toBeVisible();
}

async function adjuntar(page, archivos) {
  const [selector] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('adjuntar').click(),
  ]);
  await selector.setFiles(archivos);
}

async function completar(page, { categoria = 'bacheo', direccion, descripcion }) {
  await page.getByTestId(`campo-categoria-${categoria}`).click();
  await page.getByTestId('campo-direccion').fill(direccion);
  await page.getByTestId('campo-descripcion').fill(descripcion);
}

/** Código del reclamo recién enviado, leído del aviso de resultado ("… tu reclamo R-XXXXXX"). */
async function codigoDelResultado(page) {
  const texto = await page.getByTestId('resultado-reclamo').innerText();
  const codigo = texto.match(/R-[A-Z0-9]{6}/)?.[0];
  expect(codigo, `sin código en "${texto}"`).toBeTruthy();
  return codigo;
}

async function sinDesbordeHorizontal(page) {
  const { ancho, contenido } = await page.evaluate(() => ({
    ancho: window.innerWidth,
    contenido: document.documentElement.scrollWidth,
  }));
  expect(contenido, 'la página no se desplaza a los costados').toBeLessThanOrEqual(ancho);
}

// ---------- Pruebas ----------

test.describe('Reclamos', () => {
  test('R1: con el formulario vacío cada error aparece debajo de su campo', async ({ vecino }) => {
    const { page } = vecino;
    await abrirReclamos(page);
    await revisarAccesibilidad(page, 'reclamos');

    await page.getByTestId('enviar-reclamo').click();

    const direccion = page.getByTestId('campo-direccion');
    const descripcion = page.getByTestId('campo-descripcion');
    await expect(direccion).toHaveAttribute('aria-invalid', 'true');
    await expect(descripcion).toHaveAttribute('aria-invalid', 'true');
    // El mensaje está debajo del campo y el campo lo anuncia con aria-describedby.
    await expect(page.locator('#reclamo-direccion-error')).toHaveText('Indicá dónde es: calle y altura, una esquina o un lugar conocido.');
    await expect(page.locator('#reclamo-descripcion-error')).toHaveText('Contanos qué pasa (al menos 10 caracteres).');
    await expect(direccion).toHaveAttribute('aria-describedby', /reclamo-direccion-error/);
    await expect(page.getByTestId('formulario-reclamo').getByText('Elegí de qué se trata tu reclamo.')).toBeVisible();
    await expect(page.getByTestId('resumen-errores')).toHaveText('Revisá los 3 campos marcados arriba.');
    // El foco salta al primer campo con error (la primera opción de la categoría).
    await expect(page.getByTestId('campo-categoria').locator('[role="radio"]').first()).toBeFocused();
    const cajaCampo = await direccion.boundingBox();
    const cajaError = await page.locator('#reclamo-direccion-error').boundingBox();
    expect(cajaError.y).toBeGreaterThan(cajaCampo.y + cajaCampo.height - 1);

    // Al corregir, cada error se va solo, sin volver a enviar.
    await page.getByTestId('campo-categoria-alumbrado').click();
    await direccion.fill('Bv. 25 de Mayo 1500');
    await descripcion.fill('Corta');
    await expect(page.locator('#reclamo-direccion-error')).toHaveCount(0);
    await expect(page.locator('#reclamo-descripcion-error')).toHaveText('Contanos un poco más: escribí al menos 10 caracteres.');
    await expect(page.getByTestId('resumen-errores')).toHaveText('Revisá el campo marcado arriba.');
    await revisarAccesibilidad(page, 'reclamos-errores');

    // A 360 px de ancho no hay desplazamiento lateral.
    await page.setViewportSize({ width: 360, height: 740 });
    await sinDesbordeHorizontal(page);
  });

  test('R2: reclamo con una foto PNG y un PDF queda Recibido y los archivos se pueden ver', async ({ vecino, adminDb }) => {
    const { page, uid } = vecino;
    await abrirReclamos(page);
    await completar(page, {
      categoria: 'bacheo',
      direccion: 'Belgrano y Pellegrini',
      descripcion: 'Hay un pozo grande en la esquina que junta agua cuando llueve.',
    });

    // Un archivo que no es foto ni PDF se rechaza debajo de los adjuntos.
    await adjuntar(page, [TEXTO]);
    await expect(page.getByTestId('error-adjuntos')).toContainText('Adjuntá imágenes JPG o PNG, o documentos PDF.');
    await expect(page.getByTestId('lista-adjuntos')).toHaveCount(0);

    await adjuntar(page, [PNG, PDF]);
    await expect(page.getByTestId('adjunto-0')).toContainText('bache-en-la-esquina');
    await expect(page.getByTestId('adjunto-1')).toContainText('nota-vecinal.pdf');
    await expect(page.getByTestId('error-adjuntos')).toHaveCount(0);
    await revisarAccesibilidad(page, 'reclamos-adjuntos');

    await page.getByTestId('enviar-reclamo').click();
    await expect(page.getByTestId('resultado-reclamo')).toContainText('Recibimos tu reclamo', { timeout: 20_000 });
    const codigo = await codigoDelResultado(page);
    await expect(page.getByTestId('lista-adjuntos')).toHaveCount(0);   // el formulario quedó limpio
    await expect(page.getByTestId(`estado-reclamo-${codigo}`)).toHaveText('Recibido');

    // Quedó guardado con las rutas del almacenamiento propias del vecino.
    const snap = await adminDb.collection(`usuarios/${uid}/reclamos`).where('codigo', '==', codigo).get();
    expect(snap.size).toBe(1);
    const adjuntos = snap.docs[0].get('adjuntos');
    // La foto se comprimió en el celular a JPEG 0,8 (pesa menos que el PNG original); el PDF va tal cual.
    expect(adjuntos.map((a) => [a.nombre, a.tipo])).toEqual([
      ['bache-en-la-esquina.jpg', 'image/jpeg'],
      ['nota-vecinal.pdf', 'application/pdf'],
    ]);
    for (const a of adjuntos) expect(a.ruta.startsWith(`${uid}/${snap.docs[0].id}/`)).toBe(true);

    // Detalle: los adjuntos con "Ver" abren la URL firmada.
    await page.getByTestId(`reclamo-${codigo}`).click();
    await expect(page.getByTestId('titulo-pantalla')).toHaveText(`Reclamo ${codigo}`);
    await expect(page.getByTestId('detalle-reclamo')).toBeVisible();
    await expect(page.getByTestId('adjunto-detalle-0')).toContainText('bache-en-la-esquina');
    await expect(page.getByTestId('adjunto-detalle-1')).toContainText('nota-vecinal.pdf');
    await expect(page.getByTestId('paso-recibido')).toHaveAttribute('data-hecho', 'si');
    await revisarAccesibilidad(page, 'reclamo-detalle');
    // Se espía window.open (Linking.openURL en RNW) y se descarga la URL firmada que abrió "Ver".
    await page.evaluate(() => {
      window.__abiertas = [];
      window.open = (url) => { window.__abiertas.push(String(url)); return null; };
    });
    await page.getByTestId('ver-adjunto-1').click();
    await expect.poll(() => page.evaluate(() => window.__abiertas.length)).toBe(1);
    const url = await page.evaluate(() => window.__abiertas[0]);
    expect(url).toMatch(/\/archivos\/.+\.pdf\?vence=\d+/);
    const respuesta = await page.request.get(url);
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()['content-type']).toBe('application/pdf');
  });

  test('sin conexión el reclamo queda pendiente y se envía solo al volver la red', async ({ vecino }) => {
    const { page, contexto } = vecino;
    await abrirReclamos(page);

    // El vecino arma el reclamo con una foto y se queda sin señal antes de enviarlo.
    await completar(page, {
      categoria: 'limpieza',
      direccion: 'Plaza Vélez Sarsfield',
      descripcion: 'Los cestos de basura están desbordados desde el fin de semana.',
    });
    await adjuntar(page, [PNG]);
    await expect(page.getByTestId('adjunto-0')).toBeVisible();
    await contexto.setOffline(true);

    // Con adjuntos y sin red: error junto al botón, sin perder lo cargado.
    await page.getByTestId('enviar-reclamo').click();
    await expect(page.getByTestId('error-envio')).toContainText('necesitás conexión');
    await expect(page.getByTestId('adjunto-0')).toBeVisible();

    // Sin adjuntos el reclamo se guarda en el teléfono y el control vuelve en menos de 3 s.
    await page.getByTestId('quitar-adjunto-0').click();
    const inicio = Date.now();
    await page.getByTestId('enviar-reclamo').click();
    await expect(page.getByTestId('resultado-reclamo')).toContainText('tu reclamo se enviará cuando vuelvas a estar en línea', { timeout: 3000 });
    expect(Date.now() - inicio).toBeLessThan(3000);
    const codigo = await codigoDelResultado(page);
    await expect(page.getByTestId(`estado-reclamo-${codigo}`)).toHaveText('Pendiente de envío');
    await revisarAccesibilidad(page, 'reclamos-sin-conexion');

    await contexto.setOffline(false);
    await expect(page.getByTestId(`estado-reclamo-${codigo}`)).toHaveText('Recibido', { timeout: 30_000 });
    // El aviso de resultado también se actualiza solo.
    await expect(page.getByTestId('resultado-reclamo')).toContainText(`Recibimos tu reclamo`);
  });

  test('R4: búsqueda por código, dirección o descripción y "Cargar más"', async ({ vecino, adminDb }) => {
    const { page, uid } = vecino;
    // 21 reclamos viejos además del de ejemplo: la primera página trae 20.
    const ahora = Date.now();
    const lote = adminDb.batch();
    for (let i = 1; i <= 21; i += 1) {
      const n = String(i).padStart(2, '0');
      const creado = Timestamp.fromMillis(ahora - (10 + i) * 24 * 3600_000);
      lote.set(adminDb.doc(`usuarios/${uid}/reclamos/historico-${n}`), {
        codigo: `R-HIS0${n}`, categoria: 'alumbrado', direccion: `Calle Histórica ${100 + i}`,
        descripcion: `Reclamo histórico número ${n} para probar la paginación.`, estacionId: null, adjuntos: [],
        estado: 'resuelto', cronologia: { recibido: creado, en_proceso: creado, resuelto: creado },
        notaMunicipal: null, creadoEn: creado, actualizadoEn: creado, ultimoEventoId: null,
      });
    }
    await lote.commit();

    await abrirReclamos(page);
    const tarjetas = page.locator('[data-testid^="reclamo-R-"]');
    await expect(tarjetas).toHaveCount(20);
    await expect(page.getByTestId('cargar-mas-reclamos')).toBeVisible();

    const buscador = page.getByTestId('buscar-reclamos');
    await buscador.fill('luminaria');                     // descripción del reclamo de ejemplo
    await expect(tarjetas).toHaveCount(1);
    await expect(page.getByTestId('reclamo-R-000001')).toBeVisible();

    await buscador.fill('r-his005');                      // código, sin importar mayúsculas
    await expect(tarjetas).toHaveCount(1);
    await buscador.fill('calle historica 121');           // dirección, sin tildes
    await expect(tarjetas).toHaveCount(0);                // el 21 todavía no se cargó
    await expect(page.getByTestId('busqueda-vacia')).toBeVisible();
    await revisarAccesibilidad(page, 'reclamos-busqueda-vacia');

    await page.getByTestId('cargar-mas-reclamos').click();
    await expect(page.getByTestId('reclamo-R-HIS021')).toBeVisible();
    await expect(page.getByTestId('cargar-mas-reclamos')).toHaveCount(0);
    await buscador.fill('');
    await expect(tarjetas).toHaveCount(22);
  });

  test('R3: el avance del admin se ve en vivo en la línea de tiempo', async ({ vecino, admin }) => {
    const { page, uid } = vecino;
    await abrirReclamos(page);
    await completar(page, {
      categoria: 'alumbrado',
      direccion: 'Iturraspe 1960',
      descripcion: 'La luminaria de la vereda parpadea toda la noche.',
    });
    await page.getByTestId('enviar-reclamo').click();
    await expect(page.getByTestId('resultado-reclamo')).toContainText('Recibimos tu reclamo', { timeout: 20_000 });
    const codigo = await codigoDelResultado(page);
    await page.getByTestId('ver-reclamo-creado').click();
    await expect(page.getByTestId('titulo-pantalla')).toHaveText(`Reclamo ${codigo}`);
    await expect(page.getByTestId('detalle-reclamo')).toBeVisible();
    await expect(page.getByTestId('paso-en_proceso')).toHaveAttribute('data-hecho', 'no');
    const reclamoId = (await page.evaluate(() => window.location.hash)).split('/')[2];

    // El admin lo avanza con el mismo comando que usa el panel municipal.
    const avanzar = (estadoActual, nota) => admin.page.evaluate(async ([u, id, e, n]) => {
      const repo = await import('/src/datos/repositorio.js');
      await repo.avanzarReclamo({ uid: u, reclamoId: id, estadoActual: e, nota: n }, crypto.randomUUID());
    }, [uid, reclamoId, estadoActual, nota]);

    await avanzar('recibido', 'Una cuadrilla de alumbrado va mañana a la mañana.');
    await expect(page.getByTestId('paso-en_proceso')).toHaveAttribute('data-hecho', 'si', { timeout: 5000 });
    await expect(page.getByTestId('estado-detalle')).toHaveText('En proceso');
    await expect(page.getByTestId('fecha-en_proceso')).toHaveText(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
    await expect(page.getByTestId('nota-municipal')).toContainText('cuadrilla de alumbrado');
    await expect(page.getByText(`Tu reclamo ${codigo} pasó a En proceso`).first()).toBeVisible();

    await avanzar('en_proceso', 'Se cambió la luminaria.');
    await expect(page.getByTestId('paso-resuelto')).toHaveAttribute('data-hecho', 'si', { timeout: 5000 });
    await expect(page.getByTestId('estado-detalle')).toHaveText('Resuelto');
    await revisarAccesibilidad(page, 'reclamo-resuelto');

    await page.getByTestId('volver-reclamos').click();
    await expect(page.getByTestId(`estado-reclamo-${codigo}`)).toHaveText('Resuelto');
  });

  test('B4: "Reportar problema" precarga la categoría Bicicletas y la estación', async ({ vecino, adminDb }) => {
    const { page, uid } = vecino;
    await abrirReclamos(page, '#/reclamos/nuevo?estacion=b2');
    await expect(page.getByTestId('campo-categoria-bicicletas')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('campo-direccion')).toHaveValue(/Estación Municipalidad/);
    await expect(page.getByTestId('aviso-estacion')).toContainText('Estación Municipalidad');

    await page.getByTestId('campo-descripcion').fill('Un anclaje no libera la bicicleta.');
    await page.getByTestId('enviar-reclamo').click();
    await expect(page.getByTestId('resultado-reclamo')).toContainText('Recibimos tu reclamo', { timeout: 20_000 });
    const codigo = await codigoDelResultado(page);
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/reclamos');
    const snap = await adminDb.collection(`usuarios/${uid}/reclamos`).where('codigo', '==', codigo).get();
    expect(snap.docs[0].get('estacionId')).toBe('b2');
    expect(snap.docs[0].get('categoria')).toBe('bicicletas');
  });

  test('un enlace a un reclamo que no existe muestra cómo seguir', async ({ vecino }) => {
    const { page } = vecino;
    await irA(page, '#/reclamos/no-existe-123');
    await expect(page.getByTestId('reclamo-no-encontrado')).toBeVisible();
    await revisarAccesibilidad(page, 'reclamo-no-encontrado');
    await page.getByTestId('ir-mis-reclamos').click();
    await expect(page.getByTestId('formulario-reclamo')).toBeVisible();
  });
});
