// Dominio compartido de shared/dominio.mjs: validaciones, tarifas, horarios, estados de cedulones y
// reclamos, tarjetas y comprobantes. Comprueba también que shared/ sea puro, sin nada del navegador (WP2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import {
  ErrorDominio, requerido, miembro, minutosValidos, normalizarPatente, costoEstacionamiento, distanciaKm,
  ordenarPorCercania, enHorario, estadoTributo, siguienteEstadoReclamo, validarReclamo, validarArchivo,
  recortarNombreArchivo, tipoPorFirma, validarPreferencias, codigoReclamo, comprobante, codigoPagoTributo,
  nuevoIdSolicitud, finSesion, diaCordoba, digitoLuhn, luhnValido, inicioDiaCordoba, inicioMesCordoba,
  tarjetaVencida, pagoConTarjeta,
} from '../../shared/dominio.mjs';
import { digitosTarjeta, redTarjeta, normalizarVence, revisarTarjeta, validarTarjeta } from '../../shared/tarjetas.mjs';
import { catalogo } from '../../shared/catalogo.mjs';
import { TIPOS_NOTIFICACION } from '../../shared/constantes.mjs';

const MIN = 60 * 1000;
const DIA = 24 * 60 * MIN;
// Hora de Córdoba (UTC−3) → ms
const cordoba = (iso) => Date.parse(`${iso}-03:00`);

// Lanza ErrorDominio con el campo esperado.
function lanzaEn(fn, campo) {
  assert.throws(fn, (e) => e instanceof ErrorDominio && e.campo === campo);
}

test('shared es puro: sin Buffer, window, document, navigator, Deno, process ni require', () => {
  const carpeta = new URL('../../shared/', import.meta.url);
  const archivos = readdirSync(carpeta).filter((f) => f.endsWith('.mjs'));
  assert.ok(archivos.length >= 8);
  for (const f of archivos) {
    const codigo = readFileSync(new URL(f, carpeta), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // sin comentarios
    for (const prohibido of ['Buffer', 'window', 'document', 'navigator', 'Deno', 'process', 'require', 'localStorage']) {
      assert.ok(!new RegExp(`\\b${prohibido}\\b`).test(codigo), `${f} usa ${prohibido}`);
    }
    assert.ok(!/\bfrom\s+['"](?!\.\/)/.test(codigo) && !/\bimport\s*\(/.test(codigo), `${f} importa algo fuera de shared/`);
  }
});

test('ErrorDominio lleva mensaje y campo', () => {
  const e = new ErrorDominio('Mensaje', 'patente');
  assert.ok(e instanceof Error);
  assert.equal(e.name, 'ErrorDominio');
  assert.equal(e.message, 'Mensaje');
  assert.equal(e.campo, 'patente');
  assert.equal(new ErrorDominio('x').campo, null);
});

test('requerido recorta y controla el largo; miembro controla la lista', () => {
  assert.equal(requerido('  hola  ', 'Nombre'), 'hola');
  lanzaEn(() => requerido('   ', 'Nombre', 1, 10, 'nombre'), 'nombre');
  lanzaEn(() => requerido('abc', 'Nombre', 5, 10, 'nombre'), 'nombre');
  lanzaEn(() => requerido('x'.repeat(11), 'Nombre', 1, 10, 'nombre'), 'nombre');
  lanzaEn(() => requerido(42, 'Nombre', 1, 10, 'nombre'), 'nombre');
  assert.equal(requerido('', 'Nota', 0, 10), '');
  assert.equal(miembro('b', ['a', 'b'], 'Letra'), 'b');
  lanzaEn(() => miembro('c', ['a', 'b'], 'Letra', 'letra'), 'letra');
});

test('tarifa proporcional y bloques de tiempo (heredado)', () => {
  assert.equal(costoEstacionamiento(800, 15), 200);
  assert.equal(costoEstacionamiento(500, 90), 750);
  assert.equal(costoEstacionamiento(600, 240), 2400);
  for (const n of [-15, 0, 16, 241, 255, '60', NaN, 15.5]) {
    lanzaEn(() => costoEstacionamiento(800, n), 'minutos');
    lanzaEn(() => minutosValidos(n), 'minutos');
  }
  for (const n of [15, 30, 45, 60, 120, 240]) assert.equal(minutosValidos(n), n);
  assert.throws(() => costoEstacionamiento(-4, 15), ErrorDominio);
  // Con tarifas múltiplo de 4, el importe es entero en todos los bloques (lo que exigen las reglas).
  for (const z of catalogo(0).zonasEstacionamiento) {
    for (let m = 15; m <= 240; m += 15) assert.equal((z.tarifaHora * m) % 60, 0, `${z.id} ${m}`);
  }
  assert.equal(finSesion(1000, 15), 1000 + 15 * MIN);
});

test('validación de patentes argentinas (heredado, con normalización)', () => {
  assert.equal(normalizarPatente(' ab123cd '), 'AB123CD');
  assert.equal(normalizarPatente('abc123'), 'ABC123');
  assert.equal(normalizarPatente('AB 123 CD'), 'AB123CD');
  assert.equal(normalizarPatente('abc-123'), 'ABC123');
  for (const x of ['123456', 'AB123C', '<script>', '', '   ', 'ABCD123', 'A1B2C3', null, 123456]) {
    lanzaEn(() => normalizarPatente(x), 'patente');
  }
  // Cumple el patrón de firestore.rules
  assert.match(normalizarPatente('ab123cd'), /^([A-Z]{3}[0-9]{3}|[A-Z]{2}[0-9]{3}[A-Z]{2})$/);
});

test('distancia geográfica: mismo punto, simetría y valor conocido (heredado)', () => {
  const a = { lat: -31.428, lng: -62.084 };
  const b = { lat: -31.416, lng: -62.09 };
  assert.equal(distanciaKm(a, a), 0);
  assert.ok(distanciaKm(a, b) > 1);
  assert.equal(distanciaKm(a, b), distanciaKm(b, a));
  // 0,01° de latitud ≈ 1,112 km
  assert.ok(Math.abs(distanciaKm({ lat: 0, lng: 0 }, { lat: 0.01, lng: 0 }) - 1.112) < 0.001);
});

test('ordenarPorCercania agrega la distancia y, sin posición, conserva el orden', () => {
  const items = [
    { id: 'lejos', lat: -31.40, lng: -62.08 },
    { id: 'sin', lat: null, lng: null },
    { id: 'cerca', lat: -31.43, lng: -62.08 },
  ];
  const pos = { lat: -31.431, lng: -62.08 };
  const ordenados = ordenarPorCercania(items, pos);
  assert.deepEqual(ordenados.map((i) => i.id), ['cerca', 'lejos', 'sin']);
  assert.ok(ordenados[0].distanciaKm < ordenados[1].distanciaKm);
  assert.equal(ordenados[2].distanciaKm, null);
  const sinPos = ordenarPorCercania(items, null);
  assert.deepEqual(sinPos.map((i) => i.id), ['lejos', 'sin', 'cerca']);
  assert.ok(sinPos.every((i) => i.distanciaKm === null));
  assert.equal(items[0].distanciaKm, undefined, 'no modifica los originales');
  assert.deepEqual(ordenarPorCercania(undefined, pos), []);
});

test('enHorario con la hora de Córdoba (UTC−3) y día ISO', () => {
  const zonas = Object.fromEntries(catalogo(0).zonasEstacionamiento.map((z) => [z.id, z]));
  const p1 = zonas.p1.horario; // lunes a viernes 8 a 20
  const p3 = zonas.p3.horario; // lunes a sábado 8 a 13
  // 2026-10-05 es lunes; 2026-10-10 es sábado; 2026-10-11 es domingo
  assert.equal(enHorario(p1, cordoba('2026-10-05T08:00:00')), true);
  assert.equal(enHorario(p1, cordoba('2026-10-05T19:59:59')), true);
  assert.equal(enHorario(p1, cordoba('2026-10-05T20:00:00')), false);
  assert.equal(enHorario(p1, cordoba('2026-10-05T07:59:59')), false);
  assert.equal(enHorario(p1, cordoba('2026-10-10T09:00:00')), false, 'sábado no en p1');
  assert.equal(enHorario(p3, cordoba('2026-10-10T09:00:00')), true, 'sábado 9:00 sí en p3');
  assert.equal(enHorario(p3, cordoba('2026-10-10T13:00:00')), false);
  assert.equal(enHorario(p3, cordoba('2026-10-11T09:00:00')), false, 'domingo no');
  // Lunes 02:00 UTC es todavía domingo 23:00 en Córdoba: el día lo decide la hora local.
  assert.equal(enHorario({ dias: [7], desde: 0, hasta: 24 }, Date.parse('2026-10-05T02:00:00Z')), true, 'domingo 23 h en Córdoba');
  assert.equal(enHorario(null, Date.now()), false);
  assert.equal(diaCordoba(Date.parse('2026-10-09T02:00:00Z')), '2026-10-08');
});

test('estadoTributo: pagado, vencido, por vencer a 3 días y pendiente', () => {
  const ahora = cordoba('2026-10-07T12:00:00');
  const t = (venceDias, pagadoEn = null) => ({ vence: ahora + venceDias * DIA, pagadoEn });
  assert.equal(estadoTributo(t(-5, ahora - DIA), ahora), 'pagado');
  assert.equal(estadoTributo(t(5, ahora), ahora), 'pagado');
  assert.equal(estadoTributo(t(-1), ahora), 'vencido');
  assert.equal(estadoTributo(t(0), ahora), 'vencido');
  assert.equal(estadoTributo(t(2), ahora), 'por_vencer');
  assert.equal(estadoTributo(t(3), ahora), 'por_vencer');
  assert.equal(estadoTributo(t(3.01), ahora), 'pendiente');
  assert.equal(estadoTributo(t(8), ahora), 'pendiente');
  assert.equal(estadoTributo(t(5), ahora, 7), 'por_vencer');
});

test('siguienteEstadoReclamo avanza un paso', () => {
  assert.equal(siguienteEstadoReclamo('recibido'), 'en_proceso');
  assert.equal(siguienteEstadoReclamo('en_proceso'), 'resuelto');
  assert.equal(siguienteEstadoReclamo('resuelto'), null);
  assert.equal(siguienteEstadoReclamo('otro'), null);
});

test('validarReclamo normaliza y marca el campo con error', () => {
  const ok = validarReclamo({ categoria: 'bacheo', direccion: '  Belgrano 1500 ', descripcion: 'Pozo grande en la calzada.' });
  assert.deepEqual(ok, { categoria: 'bacheo', direccion: 'Belgrano 1500', descripcion: 'Pozo grande en la calzada.', estacionId: null });
  assert.equal(validarReclamo({ ...ok, estacionId: 'b2' }).estacionId, 'b2');
  assert.equal(validarReclamo({ ...ok, estacionId: '' }).estacionId, null);
  lanzaEn(() => validarReclamo({ ...ok, categoria: 'Bacheo' }), 'categoria');
  lanzaEn(() => validarReclamo({ ...ok, direccion: 'abc' }), 'direccion');
  lanzaEn(() => validarReclamo({ ...ok, direccion: 'x'.repeat(161) }), 'direccion');
  lanzaEn(() => validarReclamo({ ...ok, descripcion: 'corto' }), 'descripcion');
  lanzaEn(() => validarReclamo({ ...ok, descripcion: 'x'.repeat(1501) }), 'descripcion');
  lanzaEn(() => validarReclamo({ ...ok, estacionId: 'x'.repeat(41) }), 'estacionId');
  lanzaEn(() => validarReclamo({}), 'categoria');
});

test('validarArchivo controla tipo y peso', () => {
  assert.deepEqual(validarArchivo({ nombre: 'foto.jpg', tipo: 'image/jpeg', tamano: 1000 }),
    { nombre: 'foto.jpg', tipo: 'image/jpeg', tamano: 1000 });
  assert.ok(validarArchivo({ nombre: 'doc.pdf', tipo: 'application/pdf', tamano: 2 * 1024 * 1024 }));
  lanzaEn(() => validarArchivo({ nombre: 'doc.pdf', tipo: 'application/pdf', tamano: 2 * 1024 * 1024 + 1 }), 'adjuntos');
  lanzaEn(() => validarArchivo({ nombre: 'a.gif', tipo: 'image/gif', tamano: 10 }), 'adjuntos');
  lanzaEn(() => validarArchivo({ nombre: 'vacio.png', tipo: 'image/png', tamano: 0 }), 'adjuntos');
});

test('recortarNombreArchivo: sin rutas ni control, 100 caracteres y extensión conservada', () => {
  assert.equal(recortarNombreArchivo('C:\\Users\\vecino\\foto.jpg'), 'foto.jpg');
  assert.equal(recortarNombreArchivo('../../etc/passwd'), 'passwd');
  assert.equal(recortarNombreArchivo('ma\u0000l\u001fo\u007f.png'), 'malo.png');
  assert.equal(recortarNombreArchivo(''), 'archivo');
  assert.equal(recortarNombreArchivo(null), 'archivo');
  const largo = `${'a'.repeat(150)}.jpeg`;
  const r = recortarNombreArchivo(largo);
  assert.equal(r.length, 100);
  assert.ok(r.endsWith('.jpeg'));
  assert.equal(recortarNombreArchivo('b'.repeat(101)).length, 100);
  assert.equal(recortarNombreArchivo('c'.repeat(100)), 'c'.repeat(100));
  // No parte un emoji (par sustituto) al recortar
  const emojis = recortarNombreArchivo(`${'😀'.repeat(60)}.png`);
  assert.ok(emojis.length <= 100 && emojis.endsWith('.png'));
  assert.ok(!/[\ud800-\udbff](?![\udc00-\udfff])/.test(emojis));
  // Todo resultado cumple texto(nombre, 1, 100) de las reglas
  for (const n of ['x', largo, '  .pdf', '\u0001'.repeat(5)]) {
    const s = recortarNombreArchivo(n);
    assert.ok(s.length >= 1 && s.length <= 100, JSON.stringify(s));
  }
});

test('tipoPorFirma reconoce PDF, PNG y JPEG con Uint8Array (sin Buffer)', () => {
  const texto = (s) => new TextEncoder().encode(s);
  assert.equal(tipoPorFirma(texto('%PDF-1.7 demo')), 'application/pdf');
  assert.equal(tipoPorFirma(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0])), 'image/png');
  assert.equal(tipoPorFirma(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0])), 'image/jpeg');
  assert.equal(tipoPorFirma(new Uint8Array([0xff, 0xd8, 0xff]).buffer), 'image/jpeg', 'acepta ArrayBuffer');
  assert.equal(tipoPorFirma(texto('abc')), null);
  assert.equal(tipoPorFirma(texto('%PDF')), null, 'firma incompleta');
  assert.equal(tipoPorFirma(new Uint8Array([137, 80, 78, 71, 13, 10, 26])), null, 'PNG de 7 bytes');
  assert.equal(tipoPorFirma(new Uint8Array([0x47, 0x49, 0x46, 0x38])), null, 'GIF');
  assert.equal(tipoPorFirma(new Uint8Array(0)), null);
  assert.equal(tipoPorFirma('no son bytes'), null);
});

test('validarPreferencias normaliza sin duplicados y rechaza valores inválidos', () => {
  const p = validarPreferencias({ tipos: ['tributos', 'obras', 'obras'], zonas: ['sur', 'centro', 'sur'], frecuencia: 'resumen_diario', push: true });
  assert.deepEqual(p, { tipos: ['obras', 'tributos'], zonas: ['centro', 'sur'], frecuencia: 'resumen_diario', push: true });
  assert.deepEqual(validarPreferencias({ tipos: [], zonas: [], frecuencia: 'solo_historial', push: false }).tipos, []);
  const todos = validarPreferencias({ tipos: [...TIPOS_NOTIFICACION, ...TIPOS_NOTIFICACION], zonas: ['norte'], frecuencia: 'inmediata', push: false });
  assert.equal(todos.tipos.length, 9, 'entra en el tope de 9 de las reglas');
  const base = { tipos: ['obras'], zonas: ['centro'], frecuencia: 'inmediata', push: false };
  lanzaEn(() => validarPreferencias({ ...base, tipos: ['Obras'] }), 'tipos');
  lanzaEn(() => validarPreferencias({ ...base, tipos: 'obras' }), 'tipos');
  lanzaEn(() => validarPreferencias({ ...base, zonas: ['oeste'] }), 'zonas');
  lanzaEn(() => validarPreferencias({ ...base, frecuencia: 'semanal' }), 'frecuencia');
  lanzaEn(() => validarPreferencias({ ...base, push: undefined }), 'push');
  lanzaEn(() => validarPreferencias(null), 'preferencias');
});

test('codigoReclamo y comprobante cumplen las expresiones de las reglas', () => {
  const id = '3f2a9c1e-7b4d-4e8a-9c0f-123456789abc';
  assert.equal(codigoReclamo(id), 'R-3F2A9C');
  assert.match(codigoReclamo(id), /^R-[A-Z0-9]{6}$/);
  assert.match(codigoReclamo('a_b-c'), /^R-[A-Z0-9]{6}$/, 'rellena si faltan caracteres');
  assert.equal(comprobante('REC', id), 'REC-3F2A9C1E');
  for (const pref of ['REC', 'EST', 'EXT']) {
    assert.match(comprobante(pref, nuevoIdSolicitud()), new RegExp(`^${pref}-[A-Z0-9]{8}$`));
  }
  assert.throws(() => comprobante('XXX', id), ErrorDominio);
  assert.throws(() => codigoReclamo(undefined), ErrorDominio);
  assert.equal(comprobante('EST', id), comprobante('EST', id), 'determinista: un reintento da lo mismo');
});

test('codigoPagoTributo: solo dígitos, con dígito verificador Luhn', () => {
  const vence = cordoba('2026-10-09T12:00:00');
  const codigo = codigoPagoTributo({ id: 'T-1001', importe: 18500, vence });
  assert.match(codigo, /^[0-9]{24}$/);
  assert.equal(codigo.slice(0, 23), '001001' + '000018500' + '20261009');
  assert.ok(luhnValido(codigo));
  // Cambiar un dígito rompe la verificación
  const alterado = codigo.slice(0, 5) + String((Number(codigo[5]) + 1) % 10) + codigo.slice(6);
  assert.equal(luhnValido(alterado), false);
  // Vectores conocidos de Luhn
  assert.equal(digitoLuhn('7992739871'), '3');
  assert.ok(luhnValido('79927398713'));
  assert.ok(luhnValido('4111111111111111'));
  assert.equal(luhnValido('4111111111111112'), false);
  assert.ok(luhnValido(codigoPagoTributo({ id: 'T-0999', importe: 24750, vence: 0 })));
});

test('nuevoIdSolicitud: UUID v4 único, también sin randomUUID', () => {
  const v4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const ids = new Set(Array.from({ length: 200 }, () => nuevoIdSolicitud()));
  assert.equal(ids.size, 200);
  for (const id of ids) assert.match(id, v4);
  // Cumple idSolicitud() de las reglas
  assert.match(nuevoIdSolicitud(), /^[A-Za-z0-9_-]{8,80}$/);

  // Respaldo con getRandomValues (contexto no seguro: http en la red local)
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const real = globalThis.crypto;
  try {
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: (b) => real.getRandomValues(b) }, configurable: true, writable: true,
    });
    const respaldo = new Set(Array.from({ length: 100 }, () => nuevoIdSolicitud()));
    assert.equal(respaldo.size, 100);
    for (const id of respaldo) assert.match(id, v4);
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
    assert.match(nuevoIdSolicitud(), v4);
  } finally {
    Object.defineProperty(globalThis, 'crypto', original);
  }
});

test('inicioDiaCordoba e inicioMesCordoba cortan a la medianoche de Córdoba (UTC-3)', () => {
  // 9/10/2026 01:30 en Córdoba (04:30 UTC): el día empezó a las 03:00 UTC.
  assert.equal(inicioDiaCordoba(Date.parse('2026-10-09T04:30:00Z')), Date.parse('2026-10-09T03:00:00Z'));
  // 8/10/2026 23:00 en Córdoba (9/10 02:00 UTC): todavía es el día 8.
  assert.equal(inicioDiaCordoba(Date.parse('2026-10-09T02:00:00Z')), Date.parse('2026-10-08T03:00:00Z'));
  assert.equal(inicioMesCordoba(Date.parse('2026-10-09T04:30:00Z')), Date.parse('2026-10-01T03:00:00Z'));
  // 31/10 22:00 en Córdoba (1/11 01:00 UTC): sigue siendo octubre.
  assert.equal(inicioMesCordoba(Date.parse('2026-11-01T01:00:00Z')), Date.parse('2026-10-01T03:00:00Z'));
  assert.equal(inicioMesCordoba(Date.parse('2026-11-01T03:00:00Z')), Date.parse('2026-11-01T03:00:00Z'));
});

// ---------- Tarjetas guardadas ----------

test('redTarjeta: Visa 4, Mastercard 51–55 y 2221–2720, American Express 34/37; otra → "Tarjeta"', () => {
  assert.equal(redTarjeta('4242 4242 4242 4242'), 'Visa');
  assert.equal(redTarjeta('5100000000000000'), 'Mastercard');
  assert.equal(redTarjeta('5555555555554444'), 'Mastercard');
  assert.equal(redTarjeta('2221000000000009'), 'Mastercard');
  assert.equal(redTarjeta('2720990000000007'), 'Mastercard');
  assert.equal(redTarjeta('2220990000000000'), 'Tarjeta');
  assert.equal(redTarjeta('2721000000000000'), 'Tarjeta');
  assert.equal(redTarjeta('5600000000000000'), 'Tarjeta');
  assert.equal(redTarjeta('341111111111111'), 'American Express');
  assert.equal(redTarjeta('378282246310005'), 'American Express');
  assert.equal(redTarjeta('6011111111111117'), 'Tarjeta');
  assert.equal(redTarjeta(''), 'Tarjeta');
});

test('normalizarVence y tarjetaVencida (vale hasta el último día del mes, en Córdoba)', () => {
  assert.equal(normalizarVence('0829'), '08/29');
  assert.equal(normalizarVence('8/29'), '08/29');
  assert.equal(normalizarVence(' 08 / 29 '), '08/29');
  assert.equal(normalizarVence('13/29'), null);
  assert.equal(normalizarVence('00/29'), null);
  assert.equal(normalizarVence('08/2029'), null);
  const ahora = cordoba('2026-10-31T23:59');
  assert.equal(tarjetaVencida('10/26', ahora), false);
  assert.equal(tarjetaVencida('09/26', ahora), true);
  assert.equal(tarjetaVencida('10/26', cordoba('2026-11-01T00:00')), true);
  assert.equal(tarjetaVencida('01/27', ahora), false);
  assert.equal(tarjetaVencida('cualquiera', ahora), true);
});

test('revisarTarjeta: devuelve solo tipo, red, últimos 4, titular y vencimiento (nunca el número)', () => {
  const ahora = cordoba('2026-10-13T12:00');
  const { tarjeta, errores } = revisarTarjeta({ tipo: 'credito', numero: '4242 4242-4242 4242', titular: '  Ana   Pérez ', vence: '829' }, ahora);
  assert.deepEqual(errores, {});
  assert.deepEqual(tarjeta, { tipo: 'credito', red: 'Visa', ultimos4: '4242', titular: 'Ana Pérez', vence: '08/29' });
  assert.ok(!JSON.stringify(tarjeta).includes('424242'), 'no queda el número completo');
  // American Express de 15 dígitos y largo máximo de 19.
  assert.equal(revisarTarjeta({ tipo: 'debito', numero: '378282246310005', titular: 'Bo', vence: '12/30' }, ahora).tarjeta.ultimos4, '0005');
  assert.ok(revisarTarjeta({ tipo: 'debito', numero: '4000000000000000006', titular: 'Ana', vence: '12/30' }, ahora).tarjeta);
});

test('revisarTarjeta: un error por campo, todos a la vez', () => {
  const ahora = cordoba('2026-10-13T12:00');
  const { tarjeta, errores } = revisarTarjeta({}, ahora);
  assert.equal(tarjeta, null);
  assert.deepEqual(Object.keys(errores).sort(), ['numero', 'tipo', 'titular', 'vence']);
  const error = (datos, campo) => revisarTarjeta({ tipo: 'credito', numero: '4242424242424242', titular: 'Ana', vence: '12/30', ...datos }, ahora).errores[campo];
  assert.match(error({ tipo: 'billetera' }, 'tipo'), /crédito o de débito/);
  assert.match(error({ numero: '4242 4242 4242 4241' }, 'numero'), /no corresponde/);       // Luhn
  assert.match(error({ numero: '424242424242' }, 'numero'), /entre 13 y 19/);              // 12 dígitos
  assert.match(error({ numero: '42424242424242424242' }, 'numero'), /entre 13 y 19/);      // 20 dígitos
  assert.match(error({ numero: '4242x42424242424' }, 'numero'), /solo números/);
  assert.match(error({ titular: 'A' }, 'titular'), /entre 2 y 60/);
  assert.match(error({ titular: 'A'.repeat(61) }, 'titular'), /entre 2 y 60/);
  assert.match(error({ titular: 'Ana 4242' }, 'titular'), /números/);
  assert.match(error({ vence: '09/26' }, 'vence'), /vencida/);
  assert.match(error({ vence: '1330' }, 'vence'), /MM\/AA/);
  assert.match(error({ vence: '' }, 'vence'), /Ingresá/);
  assert.equal(error({ vence: '10/26' }, 'vence'), undefined, 'el mes en curso todavía vale');
  lanzaEn(() => validarTarjeta({ tipo: 'credito', numero: '1', titular: 'Ana', vence: '12/30' }, ahora), 'numero');
});

test('pagoConTarjeta: el pago registra el tipo y la tarjeta enmascarada', () => {
  const ahora = cordoba('2026-10-13T12:00');
  const guardada = { id: 'tarjeta-1', tipo: 'debito', red: 'Visa', ultimos4: '5556', titular: 'Ana', vence: '08/30' };
  assert.deepEqual(pagoConTarjeta(guardada, ahora), { medio: 'debito', tarjeta: { red: 'Visa', ultimos4: '5556' } });
  for (const mala of [null, 'credito', { tipo: 'billetera', red: 'Visa', ultimos4: '1234' }, { tipo: 'credito', red: 'Otra', ultimos4: '1234' },
    { tipo: 'credito', red: 'Visa', ultimos4: '4242424242424242' }]) {
    lanzaEn(() => pagoConTarjeta(mala, ahora), 'medio');
  }
  lanzaEn(() => pagoConTarjeta({ ...guardada, vence: '09/26' }, ahora), 'medio');
});

test('revisarTarjeta: el código de seguridad se valida y nunca se devuelve', () => {
  const ahora = Date.UTC(2026, 9, 13, 15);
  const base = { tipo: 'credito', numero: '4242424242424242', titular: 'Ana Paz', vence: '12/30' };
  assert.equal(revisarTarjeta({ ...base, codigo: '' }, ahora).errores.codigo, 'Ingresá el código de seguridad.');
  assert.equal(revisarTarjeta({ ...base, codigo: '12' }, ahora).errores.codigo, 'Son 3 números, al dorso de la tarjeta.');
  assert.equal(revisarTarjeta({ ...base, codigo: '1234' }, ahora).errores.codigo, 'Son 3 números, al dorso de la tarjeta.');
  // American Express: 4 números, impresos en el frente (no al dorso).
  const amex = { ...base, numero: '3782 822463 10005' };
  for (const codigo of ['123', '12', '12345']) {
    assert.equal(revisarTarjeta({ ...amex, codigo }, ahora).errores.codigo, 'Son 4 números, en el frente de la tarjeta, arriba del número.');
  }
  assert.equal(revisarTarjeta({ ...amex, codigo: '1234' }, ahora).errores.codigo, undefined);
  const { tarjeta } = revisarTarjeta({ ...base, codigo: '123' }, ahora);
  assert.ok(tarjeta);
  assert.equal(JSON.stringify(tarjeta).includes('123'), false);
});
