// Mapeadores de src/datos (WP3): fechas en ms, id, pendiente y uid en grupos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  convertirFechas, desdeDoc, configDesdeDoc, estacionDesdeDoc, alarmaDesdeDoc, perfilDesdeDoc,
  tributoDesdeDoc, reclamoDesdeDoc, reclamoDeGrupoDesdeDoc, sesionDesdeDoc, notificacionDesdeDoc,
  avisoDesdeDoc, contactoDesdeDoc, eventoDesdeDoc, metaDe,
} from '../../src/datos/mapeadores.js';

// Timestamp falso con la misma interfaz que usa el mapeador.
class TimestampFalso {
  constructor(ms) { this.ms = ms; }
  toMillis() { return this.ms; }
}
const ts = (ms) => new TimestampFalso(ms);

// Snapshot falso: data(opciones) registra las opciones para comprobar serverTimestamps: 'estimate'.
function snap(id, datos, { pendiente = false, existe = true, padre = null } = {}) {
  const s = {
    id,
    opciones: null,
    metadata: { hasPendingWrites: pendiente, fromCache: false },
    exists: () => existe,
    data(opciones) { s.opciones = opciones; return existe ? datos : undefined; },
    ref: { id, parent: { id: 'reclamos', parent: padre ? { id: padre } : null } },
  };
  return s;
}

test('convertirFechas pasa Timestamp y Date a ms, también dentro de mapas y arrays', () => {
  const salida = convertirFechas({
    a: ts(1000), b: new Date(2000), c: { d: ts(3000), e: [ts(4000), 'x', 5] }, f: null, g: 'texto',
  });
  assert.deepEqual(salida, { a: 1000, b: 2000, c: { d: 3000, e: [4000, 'x', 5] }, f: null, g: 'texto' });
});

test('desdeDoc agrega id y pendiente y pide serverTimestamps estimate', () => {
  const s = snap('doc-1', { creadoEn: ts(1234), nombre: 'x' }, { pendiente: true });
  const d = desdeDoc(s);
  assert.deepEqual(d, { creadoEn: 1234, nombre: 'x', id: 'doc-1', pendiente: true });
  assert.deepEqual(s.opciones, { serverTimestamps: 'estimate' });
});

test('desdeDoc devuelve null si el documento no existe', () => {
  assert.equal(desdeDoc(snap('nada', {}, { existe: false })), null);
  assert.equal(perfilDesdeDoc(snap('nada', {}, { existe: false })), null);
});

test('desdeDoc en grupos agrega el uid del dueño desde la ruta', () => {
  const s = snap('reclamo-1', { estado: 'recibido', creadoEn: ts(10) }, { padre: 'vecino-42' });
  assert.equal(reclamoDeGrupoDesdeDoc(s).uid, 'vecino-42');
  assert.equal(reclamoDesdeDoc(s).uid, undefined);
});

test('config usa 5 minutos de respaldo para el aviso de estacionamiento', () => {
  const c = configDesdeDoc(snap('config', { simuladorActivo: false, simuladorCadaMin: 2, horarioEstricto: true }));
  assert.equal(c.avisoEstacionamientoMin, 5);
  assert.equal(c.horarioEstricto, true);
  assert.equal(c.ultimaSimulacion, null);
  const c14 = configDesdeDoc(snap('config', { avisoEstacionamientoMin: 14, horarioEstricto: false, ultimaSimulacion: ts(99) }));
  assert.equal(c14.avisoEstacionamientoMin, 14);
  assert.equal(c14.horarioEstricto, false);
  assert.equal(c14.ultimaSimulacion, 99);
});

test('estación calcula anclajes libres y normaliza el estado', () => {
  const e = estacionDesdeDoc(snap('b1', { bicicletas: 8, capacidad: 14, estado: 'operativa', actualizadoEn: ts(50) }));
  assert.equal(e.anclajesLibres, 6);
  assert.equal(e.actualizadoEn, 50);
  assert.equal(estacionDesdeDoc(snap('b6', { bicicletas: 0, capacidad: 8, estado: 'rara' })).estado, 'operativa');
});

test('alarma con fechas nulas', () => {
  const a = alarmaDesdeDoc(snap('a1', { activa: false, activadaEn: null, activacionId: null, actualizadoEn: ts(7) }));
  assert.equal(a.activa, false);
  assert.equal(a.activadaEn, null);
  assert.equal(a.activacionId, null);
  assert.equal(a.actualizadoEn, 7);
});

test('perfil: cercanía en ms y sin coordenadas, preferencias tal cual', () => {
  const preferencias = { tipos: ['obras'], zonas: ['centro'], frecuencia: 'inmediata', push: false };
  const p = perfilDesdeDoc(snap('u1', {
    nombre: 'Ana', anonimo: true, altaEn: ts(100), preferencias, cercania: { alarmas: ['a1'], vence: ts(9000) },
  }));
  assert.deepEqual(p.cercania, { alarmas: ['a1'], vence: 9000 });
  assert.equal(p.altaEn, 100);
  assert.deepEqual(p.preferencias, preferencias);
  assert.equal(p.privacidadAceptadaEn, null);
  assert.equal(perfilDesdeDoc(snap('u2', { anonimo: false })).cercania, null);
});

test('tributo pendiente y pagado', () => {
  const t = tributoDesdeDoc(snap('T-1001', { importe: 18500, vence: ts(1000), pagadoEn: null, comprobante: null, pagoId: null }));
  assert.deepEqual([t.importe, t.vence, t.pagadoEn, t.comprobante], [18500, 1000, null, null]);
  const pagado = tributoDesdeDoc(snap('T-1000', { importe: 18500, vence: ts(1), pagadoEn: ts(2), comprobante: 'REC-00001000', pagoId: 'semilla-T-1000' }));
  assert.equal(pagado.pagadoEn, 2);
  assert.equal(pagado.medio, null);
  const conMedio = tributoDesdeDoc(snap('T-1001', { importe: 18500, vence: ts(1), pagadoEn: ts(2), comprobante: 'REC-AAAA0001', pagoId: 'pago-1', medio: 'credito' }));
  assert.equal(conMedio.medio, 'credito');
});

test('reclamo: cronología como mapa en ms y pendiente de envío', () => {
  const r = reclamoDesdeDoc(snap('req-1', {
    codigo: 'R-ABC123', estado: 'en_proceso', cronologia: { recibido: ts(1), en_proceso: ts(2) }, adjuntos: [],
    creadoEn: ts(1), actualizadoEn: ts(2), notaMunicipal: null, ultimoEventoId: 'ev-1', estacionId: null,
  }, { pendiente: true }));
  assert.deepEqual(r.cronologia, { recibido: 1, en_proceso: 2 });
  assert.equal(r.pendiente, true);
  assert.equal(r.ultimoEventoId, 'ev-1');
});

test('sesión de estacionamiento', () => {
  const s = sesionDesdeDoc(snap('ses-1', {
    patente: 'ABC123', minutos: 30, importe: 400, inicio: ts(0), fin: ts(1_800_000), extensiones: 0,
    avisoPorVencer: false, avisoFinalizado: false, actualizadoEn: ts(0),
  }));
  assert.equal(s.fin, 1_800_000);
  assert.equal(s.avisoPorVencer, false);
});

test('notificación, aviso, contacto y evento', () => {
  const n = notificacionDesdeDoc(snap('bienvenida', { titulo: 'Hola', creadoEn: ts(5), leida: false, leidaEn: null }));
  assert.deepEqual([n.creadoEn, n.leida, n.leidaEn, n.destino], [5, false, null, null]);
  const a = avisoDesdeDoc(snap('av-1', { titulo: 'Obras', creadoEn: ts(6), vigenteHasta: null, eventoId: 'ev-2' }));
  assert.deepEqual([a.creadoEn, a.vigenteHasta, a.eventoId, a.detalle], [6, null, 'ev-2', '']);
  const c = contactoDesdeDoc(snap('c01', { nombre: '147', telefono: '147', orden: 1 }));
  assert.deepEqual([c.telefono, c.correo, c.orden], ['147', null, 1]);
  const e = eventoDesdeDoc(snap('ev-1', { estado: 'pendiente', intentos: 0, creadoEn: ts(8) }));
  assert.deepEqual([e.creadoEn, e.procesadoEn, e.enviados], [8, null, 0]);
});

test('metaDe toma desdeCache y pendientes del snapshot', () => {
  assert.deepEqual(metaDe({ metadata: { fromCache: true, hasPendingWrites: false } }), { desdeCache: true, pendientes: false });
  assert.deepEqual(metaDe(undefined), { desdeCache: false, pendientes: false });
});

test('pago, sesión y tributo de grupo agregan el uid del dueño', async () => {
  const { pagoDeGrupoDesdeDoc, sesionDeGrupoDesdeDoc, tributoDeGrupoDesdeDoc } = await import('../../src/datos/mapeadores.js');
  const p = pagoDeGrupoDesdeDoc(snap('pago-1', { tipo: 'tributo', importe: 18500, creadoEn: ts(7), medio: 'debito' }, { padre: 'vecino-7' }));
  assert.deepEqual([p.uid, p.importe, p.creadoEn, p.medio], ['vecino-7', 18500, 7, 'debito']);
  assert.equal(pagoDeGrupoDesdeDoc(snap('pago-2', { tipo: 'extension', importe: 200, creadoEn: ts(8) }, { padre: 'v' })).medio, null);
  const s = sesionDeGrupoDesdeDoc(snap('ses-1', { patente: 'ABC123', fin: ts(9), minutos: 15, importe: 200 }, { padre: 'vecino-8' }));
  assert.deepEqual([s.uid, s.fin], ['vecino-8', 9]);
  const t = tributoDeGrupoDesdeDoc(snap('T-0999', { importe: 18500, vence: ts(1), pagadoEn: null }, { padre: 'vecino-9' }));
  assert.deepEqual([t.uid, t.vence, t.pagadoEn], ['vecino-9', 1, null]);
  assert.equal(pagoDeGrupoDesdeDoc(snap('nada', {}, { existe: false })), null);
});
