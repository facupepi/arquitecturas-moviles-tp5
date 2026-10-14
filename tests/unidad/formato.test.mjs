import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dinero, fecha, fechaHora, hora, tiempoRelativo, duracion, enmascarada, textoTarjeta, textoMedioPago,
  codigoVecino, sinSuspensivos, ESPACIO_DURO, unirNumeroYUnidad,
} from '../../shared/formato.mjs';

const MIN = 60 * 1000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;
const cordoba = (iso) => Date.parse(`${iso}-03:00`);
// Intl separa el símbolo con un espacio duro: se normaliza para comparar.
const plano = (s) => s.replace(/\s/g, ' ');

test('dinero: pesos enteros con separador de miles de es-AR', () => {
  assert.equal(plano(dinero(18500)), '$ 18.500');
  assert.equal(plano(dinero(1234567)), '$ 1.234.567');
  assert.equal(plano(dinero(0)), '$ 0');
  assert.equal(plano(dinero(200.4)), '$ 200', 'sin decimales');
  assert.match(plano(dinero(-1500)), /^-\s?\$ 1\.500$/);
  assert.equal(dinero(null), '—');
  assert.equal(dinero(NaN), '—');
  assert.equal(dinero('18500'), '—');
});

test('fecha, hora y fechaHora en la zona horaria de Córdoba', () => {
  const ms = cordoba('2026-10-09T14:05:00');
  assert.equal(fecha(ms), '09/10/2026');
  assert.equal(hora(ms), '14:05');
  assert.equal(fechaHora(ms), '09/10/2026 14:05');
  // 01:00 UTC del 9 es todavía el 8 a las 22:00 en Córdoba
  assert.equal(fecha(Date.parse('2026-10-09T01:00:00Z')), '08/10/2026');
  assert.equal(hora(Date.parse('2026-10-09T01:00:00Z')), '22:00');
  assert.equal(hora(Date.parse('2026-10-09T03:00:00Z')), '00:00', 'medianoche en 24 h');
  for (const malo of [null, undefined, NaN, '2026-10-09']) {
    assert.equal(fecha(malo), '—');
    assert.equal(hora(malo), '—');
    assert.equal(fechaHora(malo), '—');
  }
});

test('tiempoRelativo en pasado y futuro, con espacio duro entre el número y la unidad', () => {
  const ahora = cordoba('2026-10-07T12:00:00');
  assert.equal(tiempoRelativo(ahora, ahora), 'recién');
  assert.equal(tiempoRelativo(ahora - 30 * 1000, ahora), 'recién');
  assert.equal(tiempoRelativo(ahora - 3 * MIN, ahora), 'hace 3\u00a0min');
  assert.equal(tiempoRelativo(ahora - 3 * MIN - 50 * 1000, ahora), 'hace 3\u00a0min');
  assert.equal(tiempoRelativo(ahora - 59 * MIN, ahora), 'hace 59\u00a0min');
  assert.equal(tiempoRelativo(ahora - 2 * HORA, ahora), 'hace 2\u00a0h');
  assert.equal(tiempoRelativo(ahora - DIA, ahora), 'hace 1\u00a0día');
  assert.equal(tiempoRelativo(ahora - 40 * DIA, ahora), 'hace 40\u00a0días');
  assert.equal(tiempoRelativo(ahora + 20 * 1000, ahora), 'en menos de 1\u00a0min');
  assert.equal(tiempoRelativo(ahora + 5 * MIN, ahora), 'en 5\u00a0min');
  assert.equal(tiempoRelativo(ahora + 2 * DIA, ahora), 'en 2\u00a0días');
  assert.equal(tiempoRelativo(ahora + 2 * DIA - 10 * MIN, ahora), 'en 2\u00a0días', 'redondea los días');
  assert.equal(tiempoRelativo(ahora + 23.6 * HORA, ahora), 'en 1\u00a0día', 'sin "24 h"');
  assert.equal(tiempoRelativo(null, ahora), '');
  assert.ok(tiempoRelativo(Date.now() - 5 * MIN).startsWith('hace'), 'ahora por defecto');
  // El número nunca queda separado de su unidad por un espacio común (sí "hace" o "en" del número).
  assert.equal(ESPACIO_DURO, '\u00a0');
  for (const ms of [ahora - 3 * MIN, ahora - 2 * HORA, ahora - 40 * DIA, ahora + 5 * MIN, ahora + 20 * 1000]) {
    assert.doesNotMatch(tiempoRelativo(ms, ahora), /\d (min|h|día|días)\b/);
  }
});

test('unirNumeroYUnidad: une el número y la unidad de un texto ya armado (notificaciones guardadas)', () => {
  const duro = (t) => t.replace(/\u00a0/g, '_');
  assert.equal(duro(unirNumeroYUnidad('Tu Tasa 10/2026 vence en 2 días')), 'Tu Tasa 10/2026 vence en 2_días');
  assert.equal(duro(unirNumeroYUnidad('Corte de 8 a 12 h. Hace 3 min, a 350 m (30 minutos).')), 'Corte de 8 a 12_h. Hace 3_min, a 350_m (30_minutos).');
  assert.equal(unirNumeroYUnidad('En 2 meses, 8 hs y el 10/2026'), 'En 2 meses, 8 hs y el 10/2026', 'solo unidades enteras');
  assert.equal(unirNumeroYUnidad(null), null);
});

test('duracion: HH:MM:SS para el temporizador', () => {
  assert.equal(duracion(0), '00:00:00');
  assert.equal(duracion(59), '00:00:59');
  assert.equal(duracion(15 * 60), '00:15:00');
  assert.equal(duracion(4 * 3600), '04:00:00');
  assert.equal(duracion(3661.9), '01:01:01', 'trunca');
  assert.equal(duracion(-5), '00:00:00');
  assert.equal(duracion(NaN), '00:00:00');
});

test('tarjetas y medios de pago siempre enmascarados (espacio duro entre los puntos y los dígitos)', () => {
  const sp = (t) => t.replace(/\u00a0/g, ' ');
  assert.ok(enmascarada('4242').includes('\u00a0'));
  assert.equal(sp(enmascarada('4242')), '•••• 4242');
  assert.equal(enmascarada('4242424242424242'), '');
  assert.equal(sp(textoTarjeta({ tipo: 'credito', red: 'Visa', ultimos4: '4242' })), 'Visa crédito •••• 4242');
  assert.equal(sp(textoTarjeta({ tipo: 'debito', red: 'Tarjeta', ultimos4: '1117' })), 'Tarjeta de débito •••• 1117');
  assert.equal(sp(textoMedioPago('credito', { red: 'Visa', ultimos4: '4242' })), 'Tarjeta de crédito Visa •••• 4242');
  assert.equal(sp(textoMedioPago('debito', { red: 'Tarjeta', ultimos4: '1117' })), 'Tarjeta de débito •••• 1117');
  assert.equal(textoMedioPago('debito'), 'Tarjeta de débito');
  assert.equal(textoMedioPago('billetera'), 'Billetera virtual', 'pagos anteriores');
  assert.equal(textoMedioPago('transferencia'), 'Transferencia bancaria');
  assert.equal(textoMedioPago(null), null);
});

test('codigoVecino: "…" y los últimos 4 del uid unidos por un word joiner (no se parte el renglón)', () => {
  assert.equal(codigoVecino('ejemplo-7k2q9x'), '…⁠2Q9X');
  assert.equal(codigoVecino(''), '');
  assert.equal(codigoVecino(null), '');
});

test('sinSuspensivos: el código se busca igual con "…", con tres puntos o copiado de la pantalla', () => {
  const buscado = 'A3F2';
  for (const escrito of ['…A3F2', '...A3F2', '..A3F2', codigoVecino('uid-a3f2'), 'A3F2']) {
    assert.equal(sinSuspensivos(escrito).toUpperCase(), buscado, escrito);
  }
  assert.equal(sinSuspensivos(undefined), '');
});
