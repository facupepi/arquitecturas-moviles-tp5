// Errores de src/datos (WP3): códigos, mensajes en español y conversión desde los SDK.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ErrorApp, CODIGOS, MENSAJES, desdeFirebase, esErrorApp } from '../../src/datos/errores.js';

test('errores.js no importa nada (lo usan WP4 y WP6 sin ciclos)', () => {
  const fuente = readFileSync(new URL('../../src/datos/errores.js', import.meta.url), 'utf8');
  assert.doesNotMatch(fuente, /^\s*import\s/m);
  assert.doesNotMatch(fuente, /require\(/);
});

test('todos los códigos de la tabla 4.2 tienen mensaje', () => {
  assert.equal(CODIGOS.length, 17);
  assert.ok(!CODIGOS.includes('cuenta-existente'), 'sin vínculo de invitados no hay cuenta existente');
  for (const codigo of CODIGOS) assert.ok(MENSAJES[codigo], codigo);
  assert.equal(MENSAJES['sin-conexion'], 'No hay conexión. Revisá tu red e intentá de nuevo.');
  assert.equal(MENSAJES['ya-pagado'], 'Este cedulón ya está pagado.');
});

test('ErrorApp usa el mensaje por defecto, guarda campo, datos y causa', () => {
  const causa = new Error('x');
  const e = new ErrorApp('validacion', 'Ingresá una patente válida.', { campo: 'patente', causa });
  assert.ok(e instanceof Error);
  assert.equal(e.name, 'ErrorApp');
  assert.equal(e.codigo, 'validacion');
  assert.equal(e.message, 'Ingresá una patente válida.');
  assert.equal(e.campo, 'patente');
  assert.equal(e.causa, causa);
  assert.equal(new ErrorApp('permiso').message, 'No se pudo validar la operación.');
  assert.equal(new ErrorApp('codigo-raro').codigo, 'desconocido');
  assert.ok(esErrorApp(e));
});

test('patente-ocupada arma la hora de fin en Córdoba', () => {
  const fin = Date.UTC(2026, 9, 7, 18, 30);   // 15:30 en Córdoba
  const e = new ErrorApp('patente-ocupada', undefined, { datos: { fin } });
  assert.equal(e.message, 'La patente ya tiene una sesión activa hasta las 15:30.');
  assert.equal(e.datos.fin, fin);
});

test('reintentable solo para sin-conexion y servidor', () => {
  assert.equal(new ErrorApp('sin-conexion').reintentable, true);
  assert.equal(new ErrorApp('servidor').reintentable, true);
  assert.equal(new ErrorApp('permiso').reintentable, false);
});

test('desdeFirebase traduce los códigos de Firestore', () => {
  const casos = {
    'permission-denied': 'permiso', unavailable: 'sin-conexion', 'deadline-exceeded': 'sin-conexion',
    'resource-exhausted': 'cuota', 'not-found': 'no-encontrado', unauthenticated: 'sin-sesion',
    'firestore/permission-denied': 'permiso', aborted: 'desconocido',
  };
  for (const [code, esperado] of Object.entries(casos)) {
    const e = desdeFirebase({ code, message: `[400] crudo ${code}`, name: 'FirebaseError' });
    assert.equal(e.codigo, esperado, code);
    assert.doesNotMatch(e.message, /\[\d+\]/, 'nunca muestra códigos crudos');
  }
});

test('desdeFirebase traduce los códigos de Auth', () => {
  assert.equal(desdeFirebase({ code: 'auth/network-request-failed' }).codigo, 'sin-conexion');
  assert.equal(desdeFirebase({ code: 'auth/popup-blocked' }).codigo, 'popup-bloqueado');
  assert.equal(desdeFirebase({ code: 'auth/too-many-requests' }).codigo, 'cuota');
});

test('desdeFirebase reconoce fetch caído, tiempo agotado y HTTP', () => {
  assert.equal(desdeFirebase(new TypeError('Failed to fetch')).codigo, 'sin-conexion');
  assert.equal(desdeFirebase(new TypeError('Load failed')).codigo, 'sin-conexion');
  const abort = new Error('aborted'); abort.name = 'AbortError';
  assert.equal(desdeFirebase(abort).codigo, 'servidor');
  assert.equal(desdeFirebase({ status: 429 }).codigo, 'cuota');
  assert.equal(desdeFirebase({ status: 503 }).codigo, 'servidor');
  assert.equal(desdeFirebase({ status: 401 }).codigo, 'sin-sesion');
});

test('desdeFirebase conserva ErrorApp, respeta { codigo, mensaje } y convierte ErrorDominio', () => {
  const propio = new ErrorApp('ya-pagado');
  assert.equal(desdeFirebase(propio), propio);
  const servidor = desdeFirebase({ codigo: 'adjunto-invalido', mensaje: 'El archivo supera los 2 MB.' });
  assert.equal(servidor.codigo, 'adjunto-invalido');
  assert.equal(servidor.message, 'El archivo supera los 2 MB.');
  class ErrorDominio extends Error {
    constructor(mensaje, campo = null) { super(mensaje); this.name = 'ErrorDominio'; this.campo = campo; }
  }
  const dominio = desdeFirebase(new ErrorDominio('La patente no es válida.', 'patente'));
  assert.equal(dominio.codigo, 'validacion');
  assert.equal(dominio.campo, 'patente');
  assert.equal(dominio.message, 'La patente no es válida.');
});

test('desdeFirebase no deja pasar mensajes crudos desconocidos', () => {
  const e = desdeFirebase(new Error('INTERNAL ASSERTION FAILED: Unexpected state'));
  assert.equal(e.codigo, 'desconocido');
  assert.equal(e.message, 'No se pudo completar la operación.');
  assert.equal(desdeFirebase(null).codigo, 'desconocido');
});
