import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordatoriosTributos, recordatoriosEstacionamiento } from '../../shared/recordatorios.mjs';
import { datosInicialesVecino } from '../../shared/catalogo.mjs';
import { ErrorDominio } from '../../shared/dominio.mjs';
import { destinoValido } from '../../shared/rutas.mjs';

const MIN = 60 * 1000;
const DIA = 24 * 60 * MIN;
const ahora = Date.parse('2026-10-07T12:00:00-03:00');

// Simula el soloSiNoExiste de vecino/alta y de la tarea diaria: solo se crean las claves nuevas.
function crearNuevas(existentes, recordatorios) {
  const nuevas = recordatorios.filter((r) => !existentes.has(r.id));
  for (const r of nuevas) existentes.add(r.id);
  return nuevas;
}

test('tributos: el alta de un vecino ya tiene T4 (T-1001 por vencer y T-0999 vencido)', () => {
  const { tributos } = datosInicialesVecino(ahora);
  const r = recordatoriosTributos(tributos, ahora);
  assert.deepEqual(r.map((x) => x.id).sort(), ['tributo-T-0999-2026-08-28-vencido', 'tributo-T-1001-2026-10-09-por_vencer']);
  const porVencer = r.find((x) => x.etapa === 'por_vencer');
  assert.equal(porVencer.titulo, 'Tu Tasa de servicios municipales 10/2026 vence en 2 días');
  assert.equal(porVencer.tipo, 'tributos');
  assert.equal(porVencer.destino, '#/tributos/T-1001');
  assert.match(porVencer.cuerpo.replace(/\s/g, ' '), /\$ 18\.500/);
  const vencido = r.find((x) => x.etapa === 'vencido');
  assert.equal(vencido.titulo, 'Tenés un cedulón vencido');
  for (const x of r) {
    assert.ok(destinoValido(x.destino), 'el destino cumple la regla');
    assert.ok(x.titulo.length >= 3 && x.titulo.length <= 100);
    assert.ok(x.cuerpo.length >= 3 && x.cuerpo.length <= 500);
  }
});

test('tributos: umbral de 3 días, sin duplicados por clave, vencido y pago (heredado)', () => {
  const tributo = { id: 'T-1', concepto: 'Tasa', periodo: '10/2026', importe: 1000, vence: ahora + 5 * DIA, pagadoEn: null };
  const existentes = new Set();
  assert.equal(recordatoriosTributos([tributo], ahora).length, 0, 'faltan 5 días');
  assert.equal(recordatoriosTributos([tributo], ahora + 2 * DIA - MIN).length, 0, 'faltan 3 días y un minuto');
  const primero = recordatoriosTributos([tributo], ahora + 2 * DIA);
  assert.equal(primero.length, 1, 'faltan exactamente 3 días');
  assert.equal(primero[0].titulo, 'Tu Tasa 10/2026 vence en 3 días');
  assert.equal(crearNuevas(existentes, primero).length, 1);
  // Al día siguiente la misma etapa da la misma clave: la tarea diaria no repite
  const segundo = recordatoriosTributos([tributo], ahora + 3 * DIA);
  assert.equal(segundo[0].id, primero[0].id);
  assert.equal(segundo[0].titulo, 'Tu Tasa 10/2026 vence en 2 días');
  assert.equal(crearNuevas(existentes, segundo).length, 0);
  assert.equal(recordatoriosTributos([tributo], ahora + 4 * DIA)[0].titulo, 'Tu Tasa 10/2026 vence mañana');
  // Vencido: otra etapa, otra clave
  const vencido = recordatoriosTributos([tributo], ahora + 5 * DIA);
  assert.equal(vencido[0].etapa, 'vencido');
  assert.equal(vencido[0].titulo, 'Tenés un cedulón vencido');
  assert.equal(crearNuevas(existentes, vencido).length, 1);
  assert.equal(crearNuevas(existentes, recordatoriosTributos([tributo], ahora + 9 * DIA)).length, 0);
  // Pagado: nada
  assert.equal(recordatoriosTributos([{ ...tributo, pagadoEn: ahora }], ahora + 5 * DIA).length, 0);
  // Umbral configurable
  assert.equal(recordatoriosTributos([tributo], ahora, 7).length, 1);
  assert.deepEqual(recordatoriosTributos(undefined, ahora), []);
});

test('tributos: "vence hoy" cuando cae en el mismo día de Córdoba', () => {
  const t = { id: 'T-2', concepto: 'Tasa', periodo: '10/2026', importe: 1, vence: ahora + 6 * 60 * MIN, pagadoEn: null };
  assert.equal(recordatoriosTributos([t], ahora)[0].titulo, 'Tu Tasa 10/2026 vence hoy');
});

const sesion = (extra = {}) => ({
  id: 'ses-1', patente: 'AB123CD', zonaNombre: 'Terminal, Bv. 9 de Julio', minutos: 15,
  inicio: ahora, fin: ahora + 15 * MIN, avisoPorVencer: false, avisoFinalizado: false, ...extra,
});

test('estacionamiento: umbral de minutos configurable de 1 a 14', () => {
  for (const m of [0, 15, -1, 2.5, undefined, null, '5']) {
    assert.throws(() => recordatoriosEstacionamiento([sesion()], ahora, m), ErrorDominio, String(m));
  }
  const s = sesion();
  assert.equal(recordatoriosEstacionamiento([s], ahora, 5).length, 0, 'faltan 15 min');
  assert.equal(recordatoriosEstacionamiento([s], ahora + 9 * MIN, 5).length, 0, 'faltan 6 min');
  assert.equal(recordatoriosEstacionamiento([s], ahora + 10 * MIN, 5).length, 1, 'faltan 5 min');
  // Con 14 (la demo), el aviso sale al minuto de empezar una sesión de 15
  assert.equal(recordatoriosEstacionamiento([s], ahora + 30 * 1000, 14).length, 0);
  const demo = recordatoriosEstacionamiento([s], ahora + MIN, 14);
  assert.equal(demo.length, 1);
  assert.deepEqual(
    { id: demo[0].id, sesionId: demo[0].sesionId, etapa: demo[0].etapa, destino: demo[0].destino },
    { id: `est-ses-1-${s.fin}-por_vencer`, sesionId: 'ses-1', etapa: 'por_vencer', destino: '#/estacionamiento' },
  );
  assert.equal(demo[0].titulo, 'Tu estacionamiento está por vencer');
  assert.match(demo[0].cuerpo, /AB123CD/);
  assert.equal(recordatoriosEstacionamiento([s], ahora + 14 * MIN, 1).length, 1, 'con 1 minuto');
});

test('estacionamiento: sin duplicados, al finalizar, después de extender y de finalizar antes', () => {
  const existentes = new Set();
  let s = sesion();
  const porVencer = recordatoriosEstacionamiento([s], ahora + 11 * MIN, 5);
  assert.equal(crearNuevas(existentes, porVencer).length, 1);
  assert.equal(crearNuevas(existentes, recordatoriosEstacionamiento([s], ahora + 12 * MIN, 5)).length, 0, 'misma clave');
  // La tarea marca avisoPorVencer: ya no vuelve a proponerlo
  s = { ...s, avisoPorVencer: true };
  assert.equal(recordatoriosEstacionamiento([s], ahora + 12 * MIN, 5).length, 0);
  // Al finalizar
  const fin = recordatoriosEstacionamiento([s], ahora + 15 * MIN, 5);
  assert.equal(fin.length, 1);
  assert.equal(fin[0].etapa, 'finalizado');
  assert.equal(fin[0].id, `est-ses-1-${s.fin}-finalizado`);
  assert.equal(fin[0].titulo, 'Tu estacionamiento finalizó');
  assert.equal(crearNuevas(existentes, fin).length, 1);
  assert.equal(recordatoriosEstacionamiento([{ ...s, avisoFinalizado: true }], ahora + 16 * MIN, 5).length, 0);

  // Después de extender: la regla vuelve avisoPorVencer a false y cambia fin → clave nueva
  const extendida = sesion({ minutos: 30, fin: ahora + 30 * MIN, avisoPorVencer: false });
  assert.equal(recordatoriosEstacionamiento([extendida], ahora + 17 * MIN, 5).length, 0);
  const nuevo = recordatoriosEstacionamiento([extendida], ahora + 26 * MIN, 5);
  assert.equal(nuevo.length, 1);
  assert.notEqual(nuevo[0].id, porVencer[0].id);
  assert.equal(crearNuevas(existentes, nuevo).length, 1);

  // Finalizar antes de tiempo: fin = hora del servidor, el aviso finalizado sale con ese fin
  const terminadaAntes = sesion({ id: 'ses-2', fin: ahora + 4 * MIN });
  const r = recordatoriosEstacionamiento([terminadaAntes], ahora + 4 * MIN + 20 * 1000, 5);
  assert.equal(r.length, 1);
  assert.equal(r[0].etapa, 'finalizado');
  assert.equal(r[0].id, `est-ses-2-${ahora + 4 * MIN}-finalizado`);
});

test('estacionamiento: varias sesiones y datos incompletos', () => {
  const sesiones = [
    sesion({ id: 'a', fin: ahora + 3 * MIN }),
    sesion({ id: 'b', fin: ahora + 60 * MIN }),
    sesion({ id: 'c', fin: ahora - MIN }),
    sesion({ id: 'd', fin: null }),
  ];
  const r = recordatoriosEstacionamiento(sesiones, ahora, 5);
  assert.deepEqual(r.map((x) => `${x.sesionId}:${x.etapa}`), ['a:por_vencer', 'c:finalizado']);
  assert.deepEqual(recordatoriosEstacionamiento(undefined, ahora, 5), []);
  assert.ok(r.every((x) => x.tipo === 'estacionamiento' && destinoValido(x.destino)));
});
