import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  planificarPaso, crearAleatorio, MAX_ESTACIONES_POR_PASO, MAX_RECLAMOS_POR_PASO, ESPERA_RECLAMO_MS,
} from '../../shared/simulador.mjs';
import { catalogo } from '../../shared/catalogo.mjs';

const MIN = 60 * 1000;
const ahora = Date.parse('2026-10-07T12:00:00-03:00');

const reclamos = [
  { uid: 'u1', id: 'r1', estado: 'recibido', actualizadoEn: ahora - 3 * MIN },
  { uid: 'u1', id: 'r2', estado: 'en_proceso', actualizadoEn: ahora - 6 * MIN },
  { uid: 'u2', id: 'r3', estado: 'recibido', actualizadoEn: ahora - 10 * MIN },
  { uid: 'u2', id: 'r4', estado: 'en_proceso', actualizadoEn: ahora - 30 * MIN },
  { uid: 'u3', id: 'r5', estado: 'resuelto', actualizadoEn: ahora - 30 * MIN },
];

test('crearAleatorio: reproducible con la misma semilla y en [0, 1)', () => {
  const a = crearAleatorio(42);
  const b = crearAleatorio(42);
  const c = crearAleatorio('demo');
  const serieA = Array.from({ length: 1000 }, () => a());
  assert.deepEqual(serieA, Array.from({ length: 1000 }, () => b()));
  assert.notDeepEqual(serieA.slice(0, 10), Array.from({ length: 10 }, () => c()));
  assert.ok(serieA.every((x) => x >= 0 && x < 1));
  const media = serieA.reduce((s, x) => s + x, 0) / serieA.length;
  assert.ok(media > 0.4 && media < 0.6, `media ${media}`);
});

test('planificarPaso: mismo plan con la misma semilla', () => {
  const entrada = () => ({ estaciones: catalogo(ahora).estaciones, reclamos, ahora });
  assert.deepEqual(planificarPaso({ ...entrada(), aleatorio: crearAleatorio(7) }),
    planificarPaso({ ...entrada(), aleatorio: crearAleatorio(7) }));
});

test('planificarPaso: 500 pasos con semilla respetan capacidad, máximos y un solo paso de reclamo', () => {
  const aleatorio = crearAleatorio(2026);
  let estaciones = catalogo(ahora).estaciones;
  // Casos de borde: una llena, una vacía, una de capacidad 1 y una fuera de servicio
  estaciones = [
    ...estaciones,
    { id: 'llena', bicicletas: 5, capacidad: 5, estado: 'operativa' },
    { id: 'vacia', bicicletas: 0, capacidad: 5, estado: 'operativa' },
    { id: 'una', bicicletas: 0, capacidad: 1, estado: 'operativa' },
    { id: 'rota', bicicletas: 3, capacidad: 6, estado: 'fuera_de_servicio' },
  ];
  const porId = (lista) => Object.fromEntries(lista.map((e) => [e.id, e]));
  let huboCambiosDeReclamos = false;
  for (let i = 0; i < 500; i += 1) {
    const plan = planificarPaso({ estaciones, reclamos, ahora, aleatorio });
    assert.deepEqual(Object.keys(plan).sort(), ['estaciones', 'reclamos'], 'sin alarmas');
    assert.ok(plan.estaciones.length >= 1 && plan.estaciones.length <= MAX_ESTACIONES_POR_PASO);
    assert.ok(plan.reclamos.length <= MAX_RECLAMOS_POR_PASO);
    const actuales = porId(estaciones);
    assert.equal(new Set(plan.estaciones.map((e) => e.id)).size, plan.estaciones.length, 'una vez cada estación');
    for (const cambio of plan.estaciones) {
      const e = actuales[cambio.id];
      assert.notEqual(e.estado, 'fuera_de_servicio');
      assert.ok(Number.isInteger(cambio.bicicletas) && cambio.bicicletas >= 0 && cambio.bicicletas <= e.capacidad);
      assert.notEqual(cambio.bicicletas, e.bicicletas, 'cambio real');
      assert.ok(Math.abs(cambio.bicicletas - e.bicicletas) <= 2, '±1 o ±2');
      assert.deepEqual(Object.keys(cambio).sort(), ['bicicletas', 'id']);
    }
    for (const r of plan.reclamos) {
      const original = reclamos.find((x) => x.id === r.id);
      assert.equal(r.uid, original.uid);
      assert.equal(r.estado, original.estado === 'recibido' ? 'en_proceso' : 'resuelto', 'un solo paso');
      huboCambiosDeReclamos = true;
    }
    // Aplica el plan para el próximo paso (las estaciones; los reclamos de prueba quedan fijos)
    const cambios = porId(plan.estaciones);
    estaciones = estaciones.map((e) => (cambios[e.id] ? { ...e, bicicletas: cambios[e.id].bicicletas } : e));
  }
  assert.ok(huboCambiosDeReclamos);
  assert.ok(planificarPaso({ estaciones, reclamos, ahora, aleatorio }).reclamos.every((r) => r.id !== 'r5'), 'resuelto no avanza');
});

test('planificarPaso: respeta la espera mínima y descarta reclamos sin uid', () => {
  const recientes = [
    { uid: 'u1', id: 'r1', estado: 'recibido', actualizadoEn: ahora - ESPERA_RECLAMO_MS.recibido + 1000 },
    { uid: 'u1', id: 'r2', estado: 'en_proceso', actualizadoEn: ahora - 4 * MIN },
    { id: 'r3', estado: 'recibido', actualizadoEn: ahora - 60 * MIN },
  ];
  for (let s = 0; s < 50; s += 1) {
    assert.deepEqual(planificarPaso({ estaciones: [], reclamos: recientes, ahora, aleatorio: crearAleatorio(s) }),
      { estaciones: [], reclamos: [] });
  }
});

test('planificarPaso: sin datos no falla', () => {
  assert.deepEqual(planificarPaso({ ahora }), { estaciones: [], reclamos: [] });
  assert.deepEqual(planificarPaso(), { estaciones: [], reclamos: [] });
  const soloRotas = [{ id: 'x', bicicletas: 2, capacidad: 4, estado: 'fuera_de_servicio' }];
  assert.deepEqual(planificarPaso({ estaciones: soloRotas, reclamos: [], ahora }).estaciones, []);
});
