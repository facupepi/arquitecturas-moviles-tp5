// Rutas de shared/rutas.mjs: interpretación y construcción de los enlaces por hash, enlaces
// profundos y destinos válidos de una notificación (WP2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUTAS, parsearHash, construirHash, rutaSegura, destinoValido } from '../../shared/rutas.mjs';

test('RUTAS tiene las rutas de la sección 7.3', () => {
  assert.deepEqual([...RUTAS], ['inicio', 'bicicletas', 'tributos', 'reclamos', 'contactos', 'alarmas',
    'estacionamiento', 'notificaciones', 'cuenta', 'panel', 'galeria']);
  assert.ok(Object.isFrozen(RUTAS));
});

test('parsearHash interpreta los enlaces profundos', () => {
  assert.deepEqual(parsearHash('#/bicicletas/b3'), { nombre: 'bicicletas', id: 'b3', params: {} });
  assert.deepEqual(parsearHash('#/tributos/T-1001'), { nombre: 'tributos', id: 'T-1001', params: {} });
  assert.deepEqual(parsearHash('#/reclamos/nuevo?estacion=b2'), { nombre: 'reclamos', id: 'nuevo', params: { estacion: 'b2' } });
  assert.deepEqual(parsearHash('#/cuenta?vinculo=existente'), { nombre: 'cuenta', id: null, params: { vinculo: 'existente' } });
  assert.deepEqual(parsearHash('#/notificaciones/ev-123'), { nombre: 'notificaciones', id: 'ev-123', params: {} });
  assert.deepEqual(parsearHash('#/alarmas/a1/'), { nombre: 'alarmas', id: 'a1', params: {} });
});

test('parsearHash acepta el formato heredado y variantes', () => {
  assert.deepEqual(parsearHash('#tributos'), { nombre: 'tributos', id: null, params: {} });
  assert.deepEqual(parsearHash('tributos'), { nombre: 'tributos', id: null, params: {} });
  assert.deepEqual(parsearHash('/#/alarmas/a2'), { nombre: 'alarmas', id: 'a2', params: {} });
  assert.deepEqual(parsearHash('https://san-francisco-conecta-tp5.web.app/#/alarmas/a2'), { nombre: 'alarmas', id: 'a2', params: {} });
  assert.deepEqual(parsearHash('#/Tributos'), { nombre: 'tributos', id: null, params: {} });
  assert.deepEqual(parsearHash('#/reclamos/nuevo?estacion=b2&estacion=b9&x=%C3%B1'), {
    nombre: 'reclamos', id: 'nuevo', params: { estacion: 'b2', x: 'ñ' },
  });
});

test('parsearHash: vacío o desconocido va a inicio; ids raros se descartan', () => {
  for (const h of ['', '#', '#/', null, undefined, 42, '#/desconocida/x', '#/__proto__', '#/%E0%A4%A']) {
    assert.deepEqual(parsearHash(h), { nombre: 'inicio', id: null, params: {} }, String(h));
  }
  assert.equal(parsearHash('#/reclamos/<script>').id, null);
  assert.equal(parsearHash('#/reclamos/%3Cscript%3E').id, null);
  assert.equal(parsearHash(`#/reclamos/${'a'.repeat(81)}`).id, null);
  const p = parsearHash('#/inicio?__proto__=x&constructor=y').params;
  assert.equal(Object.getPrototypeOf(p), Object.prototype, 'no contamina el prototipo');
  assert.equal(p.constructor, 'y');
});

test('construirHash arma el formato canónico', () => {
  assert.equal(construirHash('inicio'), '#/inicio');
  assert.equal(construirHash('tributos', 'T-1001'), '#/tributos/T-1001');
  assert.equal(construirHash('reclamos', 'nuevo', { estacion: 'b2' }), '#/reclamos/nuevo?estacion=b2');
  assert.equal(construirHash('reclamos', null, { estacion: 'b2', vacio: null, nada: undefined }), '#/reclamos?estacion=b2');
  assert.equal(construirHash('reclamos', 'a b'), '#/reclamos/a%20b');
  assert.equal(construirHash('reclamos', 'x', {}), '#/reclamos/x');
  assert.throws(() => construirHash('inexistente'), TypeError);
  // Ida y vuelta
  for (const [n, id, params] of [['bicicletas', 'b3', {}], ['reclamos', 'nuevo', { estacion: 'b2' }], ['cuenta', null, { vinculo: 'existente' }]]) {
    assert.deepEqual(parsearHash(construirHash(n, id, params)), { nombre: n, id, params });
  }
});

test('rutaSegura deja pasar solo hashes de la app; si no, notificaciones', () => {
  assert.equal(rutaSegura('#/alarmas/a2'), '#/alarmas/a2');
  assert.equal(rutaSegura('#tributos'), '#/tributos');
  assert.equal(rutaSegura('#/reclamos/nuevo?estacion=b2'), '#/reclamos/nuevo?estacion=b2');
  for (const malo of [null, undefined, '', 'https://malicioso.example', 'javascript:alert(1)', '//malicioso.example',
    '#/desconocida', 'data:text/html,<b>x</b>', 42, {}]) {
    assert.equal(rutaSegura(malo), '#/notificaciones', String(malo));
  }
  // Aunque venga dentro de una URL ajena, el resultado es solo un hash interno reconstruido
  assert.equal(rutaSegura('https://malicioso.example/#/tributos'), '#/tributos');
  assert.equal(rutaSegura('#/reclamos/<img onerror=x>'), '#/reclamos');
  // Siempre sirve para armar la URL del service worker sin salir del origen
  const url = new URL('/' + rutaSegura('//otro.example/#/x'), 'https://san-francisco-conecta-tp5.web.app');
  assert.equal(url.origin, 'https://san-francisco-conecta-tp5.web.app');
});

test('destinoValido replica el patrón de las reglas', () => {
  assert.ok(destinoValido(null));
  assert.ok(destinoValido('#/alarmas/a2'));
  assert.ok(destinoValido('#/tributos/T-1001'));
  assert.ok(destinoValido('#/notificaciones'));
  assert.equal(destinoValido('#/reclamos/nuevo?estacion=b2'), false);
  assert.equal(destinoValido('https://x.example'), false);
  assert.equal(destinoValido('#tributos'), false);
  assert.equal(destinoValido(undefined), false);
});
