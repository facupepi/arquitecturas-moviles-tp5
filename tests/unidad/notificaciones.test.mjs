import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decidirEntrega, avisoVisible, unirNotificaciones, alarmasCercanas, claveEntrega,
} from '../../shared/notificaciones.mjs';
import { recordatoriosEstacionamiento, recordatoriosTributos } from '../../shared/recordatorios.mjs';
import { catalogo, datosInicialesVecino } from '../../shared/catalogo.mjs';
import { PREFERENCIAS_POR_DEFECTO } from '../../shared/constantes.mjs';

const ahora = Date.parse('2026-10-07T12:00:00-03:00');
const prefs = { frecuencia: 'inmediata', tipos: ['alarmas', 'tributos', 'obras'], zonas: ['centro'], push: true };

test('decidirEntrega: casos heredados de shouldAlert', () => {
  const alarma = { tipo: 'alarmas', zona: 'parque' };
  assert.equal(decidirEntrega(alarma, prefs).inmediata, false, 'zona no seguida y lejos');
  assert.equal(decidirEntrega(alarma, prefs, { cercano: true }).inmediata, true, 'cercana');
  assert.equal(decidirEntrega({ ...alarma, zona: 'centro' }, prefs).inmediata, true, 'zona seguida');
  assert.equal(decidirEntrega(alarma, { ...prefs, frecuencia: 'solo_historial' }, { cercano: true }).inmediata, false);
  assert.equal(decidirEntrega({ tipo: 'tributos', zona: 'sur' }, prefs).inmediata, true, 'personal ignora la zona');
  assert.equal(decidirEntrega({ tipo: 'tributos', zona: null }, prefs).inmediata, true);
  assert.equal(decidirEntrega({ tipo: 'reclamos', zona: null }, prefs).inmediata, false, 'tipo no elegido');
  assert.equal(decidirEntrega({ tipo: 'eventos', zona: 'centro' }, prefs).historial, false);
  assert.equal(decidirEntrega({ tipo: 'obras', zona: 'todas' }, prefs).inmediata, true, 'toda la ciudad');
});

test('decidirEntrega: emergencias ignoran zona, tipo y frecuencia', () => {
  const emergencia = { tipo: 'emergencias', zona: 'sur' };
  const nada = { tipos: [], zonas: [], frecuencia: 'solo_historial', push: true };
  assert.deepEqual(decidirEntrega(emergencia, nada), { historial: true, inmediata: true, push: true, resumen: false });
  assert.equal(decidirEntrega(emergencia, { ...nada, push: false }).push, false, 'sin dispositivo no hay push');
});

test('decidirEntrega: resumen_diario, solo_historial y push', () => {
  const aviso = { tipo: 'obras', zona: 'centro' };
  assert.deepEqual(decidirEntrega(aviso, { ...prefs, frecuencia: 'resumen_diario' }),
    { historial: true, inmediata: false, push: false, resumen: true });
  assert.deepEqual(decidirEntrega(aviso, { ...prefs, frecuencia: 'solo_historial' }),
    { historial: true, inmediata: false, push: false, resumen: false });
  assert.deepEqual(decidirEntrega(aviso, prefs), { historial: true, inmediata: true, push: true, resumen: false });
  assert.equal(decidirEntrega(aviso, { ...prefs, push: false }).push, false);
  assert.deepEqual(decidirEntrega({ tipo: 'obras', zona: 'sur' }, { ...prefs, frecuencia: 'resumen_diario' }),
    { historial: false, inmediata: false, push: false, resumen: false }, 'lo invisible no va al resumen');
  // Sin preferencias usa las de por defecto (centro y parque, inmediata, sin push)
  assert.deepEqual(decidirEntrega({ tipo: 'eventos', zona: 'parque' }, null),
    { historial: true, inmediata: true, push: false, resumen: false });
});

test('avisoVisible filtra por preferencias salvo con todos', () => {
  const aviso = { tipo: 'cortes', zona: 'sur' };
  assert.equal(avisoVisible(aviso, PREFERENCIAS_POR_DEFECTO), false);
  assert.equal(avisoVisible(aviso, PREFERENCIAS_POR_DEFECTO, { todos: true }), true);
  assert.equal(avisoVisible({ ...aviso, zona: 'todas' }, PREFERENCIAS_POR_DEFECTO), true);
});

test('unirNotificaciones: orden, fuente, leídas por avisosLeidos y filtro por preferencias', () => {
  const { avisos } = catalogo(ahora);
  const { notificaciones } = datosInicialesVecino(ahora);
  const personales = [
    ...notificaciones,
    { id: 'pago-x', titulo: 'Pago registrado', cuerpo: 'Comprobante REC-1', tipo: 'tributos', zona: null,
      destino: '#/tributos', enlace: null, creadoEn: ahora - 1000, leida: true, leidaEn: ahora },
    { id: 'recibido-y', titulo: 'Reclamo recibido', cuerpo: 'R-ABC123', tipo: 'reclamos', zona: null,
      destino: '#/reclamos/y', enlace: null, creadoEn: ahora - 3 * 3600 * 1000, leida: false, leidaEn: null },
  ];
  const leidos = new Set(['av-obras-centro']);
  const unidas = unirNotificaciones(personales, avisos, leidos, PREFERENCIAS_POR_DEFECTO);

  // av-corte-sur es de una zona no seguida: queda afuera
  assert.deepEqual(unidas.map((n) => n.id),
    ['bienvenida', 'pago-x', 'av-obras-centro', 'recibido-y', 'av-evento-parque', 'av-servicios-todas']);
  for (let i = 1; i < unidas.length; i += 1) assert.ok(unidas[i - 1].creadoEn >= unidas[i].creadoEn, 'desc por creadoEn');
  assert.equal(unidas.find((n) => n.id === 'av-obras-centro').fuente, 'aviso');
  assert.equal(unidas.find((n) => n.id === 'bienvenida').fuente, 'personal');
  assert.equal(unidas.find((n) => n.id === 'av-obras-centro').leida, true, 'leída por avisosLeidos');
  assert.equal(unidas.find((n) => n.id === 'av-evento-parque').leida, false);
  assert.equal(unidas.find((n) => n.id === 'pago-x').leida, true);
  assert.equal(unidas.find((n) => n.id === 'av-servicios-todas').enlace, 'https://www.sanfrancisco.gov.ar');
  assert.equal(unidas.find((n) => n.id === 'av-evento-parque').destino, '#/bicicletas/b3');
  // Forma de NotificacionUnida (4.5), sin el campo origen del documento
  assert.deepEqual(Object.keys(unidas[0]).sort(),
    ['clave', 'creadoEn', 'cuerpo', 'destino', 'detalle', 'enlace', 'fuente', 'id', 'leida', 'tipo', 'titulo', 'zona']);

  // Todos: sin filtro, aparece el corte de la zona Sur
  const todas = unirNotificaciones(personales, avisos, leidos, PREFERENCIAS_POR_DEFECTO, { todos: true });
  assert.ok(todas.some((n) => n.id === 'av-corte-sur'));
  // Filtro por tipo también en las personales
  const sinTributos = unirNotificaciones(personales, avisos, [], { ...PREFERENCIAS_POR_DEFECTO, tipos: ['obras'] });
  assert.deepEqual(sinTributos.map((n) => n.id), ['av-obras-centro']);
  // leidos como array también sirve
  assert.equal(unirNotificaciones([], avisos, ['av-evento-parque'], PREFERENCIAS_POR_DEFECTO)
    .find((n) => n.id === 'av-evento-parque').leida, true);
  assert.deepEqual(unirNotificaciones(undefined, undefined, undefined, undefined), []);
});

test('unirNotificaciones: una alarma cercana fuera de las zonas aparece una sola vez', () => {
  const aviso = { id: 'alarma-ev-9', titulo: 'Alarma activada', cuerpo: 'Alarma Parque Cincuentenario',
    detalle: null, tipo: 'alarmas', zona: 'parque', destino: '#/alarmas/a2', enlace: null,
    creadoEn: ahora, autor: 'municipalidad', eventoId: 'ev-9', vigenteHasta: null };
  const personal = { id: 'alarma-ev-9', titulo: 'Alarma activada cerca tuyo', cuerpo: 'Alarma Parque Cincuentenario',
    tipo: 'alarmas', zona: 'parque', destino: '#/alarmas/a2', enlace: null, creadoEn: ahora, leida: false,
    leidaEn: null, origen: 'servidor' };
  const soloCentro = { ...PREFERENCIAS_POR_DEFECTO, zonas: ['centro'] };
  const visibles = unirNotificaciones([personal], [aviso], new Set(), soloCentro);
  assert.equal(visibles.length, 1, 'la personal no se filtra por zona');
  assert.equal(visibles[0].fuente, 'personal');
  const conTodos = unirNotificaciones([personal], [aviso], new Set(), soloCentro, { todos: true });
  assert.equal(conTodos.length, 1, 'misma clave: no se duplica');
  assert.equal(conTodos[0].clave, 'ev-9');
  // Pendiente de escritura (creadoEn todavía null) queda arriba
  const pendiente = unirNotificaciones([{ ...personal, id: 'recibido-z', tipo: 'reclamos', creadoEn: null }, personal],
    [], [], PREFERENCIAS_POR_DEFECTO);
  assert.equal(pendiente[0].id, 'recibido-z');
});

test('claveEntrega: un mismo evento da la misma clave venga de donde venga', () => {
  const alarma = { id: 'a2', activa: true, activacionId: 'ev-X', activadaEn: ahora };
  const avisoAlarma = { id: 'alarma-ev-X', eventoId: 'ev-X', tipo: 'alarmas', zona: 'parque' };
  const personalAlarma = { id: 'alarma-ev-X' };
  const claves = [
    claveEntrega({ fuente: 'alarma', alarma }),
    claveEntrega({ fuente: 'aviso', aviso: avisoAlarma }),
    claveEntrega({ fuente: 'personal', notificacion: personalAlarma }),
  ];
  assert.deepEqual(claves, ['ev-X', 'ev-X', 'ev-X']);

  const reclamo = { id: 'req-1', estado: 'en_proceso', ultimoEventoId: 'ev-Y' };
  assert.equal(claveEntrega({ fuente: 'reclamo', reclamo }), 'ev-Y');
  assert.equal(claveEntrega({ fuente: 'personal', notificacion: { id: 'reclamo-ev-Y' } }), 'ev-Y');

  // E3: la clave de la sesión es el id del recordatorio (tag local = data.id del push)
  const sesion = { id: 'ses-1', patente: 'AB123CD', fin: ahora + 4 * 60 * 1000, avisoPorVencer: false };
  const [rec] = recordatoriosEstacionamiento([sesion], ahora, 5);
  assert.equal(claveEntrega({ fuente: 'sesion', sesion, etapa: 'por_vencer' }), rec.id);
  assert.equal(claveEntrega({ fuente: 'personal', notificacion: { id: rec.id } }), rec.id);
  // T4 y los demás ids personales, tal cual
  const [t4] = recordatoriosTributos(datosInicialesVecino(ahora).tributos, ahora);
  assert.equal(claveEntrega({ fuente: 'personal', notificacion: { id: t4.id } }), t4.id);
  for (const id of ['pago-abc', 'recibido-abc', 'bienvenida']) {
    assert.equal(claveEntrega({ fuente: 'personal', notificacion: { id } }), id);
  }
  // Avisos del panel: eventoId
  assert.equal(claveEntrega({ fuente: 'aviso', aviso: { id: 'req-2', eventoId: 'ev-req-2' } }), 'ev-req-2');
  // Respaldo determinista si falta el id del evento
  assert.equal(claveEntrega({ fuente: 'reclamo', reclamo: { id: 'r', estado: 'recibido', ultimoEventoId: null } }), 'reclamo-r-recibido');
  assert.throws(() => claveEntrega({ fuente: 'otra' }), TypeError);
  assert.throws(() => claveEntrega(null), TypeError);
});

test('alarmasCercanas: ids dentro del radio, sin coordenadas en el resultado', () => {
  const { alarmas } = catalogo(ahora);
  const enLaPlaza = { lat: -31.4351133, lng: -62.0862566 };
  const cerca = alarmasCercanas(alarmas, enLaPlaza, 1);
  assert.equal(cerca[0], 'a3', 'la más cercana primero');
  assert.ok(cerca.includes('a1'), 'la Municipalidad está a menos de 1 km de la plaza');
  assert.ok(!cerca.includes('a4'), 'la UTN queda lejos');
  assert.ok(cerca.every((id) => typeof id === 'string'));
  assert.deepEqual(alarmasCercanas(alarmas, null, 1), []);
  assert.deepEqual(alarmasCercanas(alarmas, { lat: 0, lng: 0 }, 1), []);
  assert.equal(alarmasCercanas(alarmas, enLaPlaza).length, cerca.length, 'radio por defecto 1 km');
  const muchas = Array.from({ length: 30 }, (_, i) => ({ id: `x${i}`, lat: -31.43, lng: -62.08 }));
  assert.equal(alarmasCercanas(muchas, { lat: -31.43, lng: -62.08 }, 1).length, 20, 'tope de 20 de la regla');
});
