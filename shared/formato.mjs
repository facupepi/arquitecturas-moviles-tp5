// Formato de importes, fechas y tiempos para mostrar (de heredado:src/platform.web.js money/date).
// Todas usan es-AR y la zona horaria de Córdoba. Las fechas llegan como ms (o null).
// Las fechas se arman con formatToParts para que el resultado sea igual en navegadores, Node y Deno.

import { ZONA_HORARIA } from './constantes.mjs';

const SIN_DATO = '—';

const formatoDinero = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0,
});
const formatoFechaHora = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_HORARIA, day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function valido(ms) {
  return typeof ms === 'number' && Number.isFinite(ms);
}

function partes(ms) {
  const p = {};
  for (const { type, value } of formatoFechaHora.formatToParts(new Date(ms))) p[type] = value;
  return p;
}

// "$ 18.500" (con espacio duro, como lo devuelve Intl). Importes enteros en pesos.
export function dinero(n) {
  if (!valido(n)) return SIN_DATO;
  return formatoDinero.format(Math.round(n));
}

// "09/10/2026"
export function fecha(ms) {
  if (!valido(ms)) return SIN_DATO;
  const p = partes(ms);
  return `${p.day}/${p.month}/${p.year}`;
}

// "14:05" (24 h)
export function hora(ms) {
  if (!valido(ms)) return SIN_DATO;
  const p = partes(ms);
  return `${p.hour}:${p.minute}`;
}

// "09/10/2026 14:05"
export function fechaHora(ms) {
  if (!valido(ms)) return SIN_DATO;
  return `${fecha(ms)} ${hora(ms)}`;
}

// "recién", "hace 3 min", "hace 2 h", "hace 1 día", "en menos de 1 min", "en 5 min", "en 2 días".
// Minutos truncados; horas y días redondeados (2 días menos unos minutos sigue siendo "en 2 días").
export function tiempoRelativo(ms, ahora = Date.now()) {
  if (!valido(ms) || !valido(ahora)) return '';
  const diferencia = ms - ahora;
  const futuro = diferencia > 0;
  const abs = Math.abs(diferencia);
  const conSentido = (texto) => (futuro ? `en ${texto}` : `hace ${texto}`);
  if (abs < 60 * 1000) return futuro ? 'en menos de 1 min' : 'recién';
  const minutos = Math.floor(abs / 60000);
  if (minutos < 60) return conSentido(`${minutos} min`);
  const horas = Math.round(abs / 3600000);
  if (horas < 24) return conSentido(`${horas} h`);
  const dias = Math.round(abs / 86400000);
  return conSentido(dias === 1 ? '1 día' : `${dias} días`);
}

// "HH:MM:SS" para el temporizador del estacionamiento. Negativo o inválido → "00:00:00".
export function duracion(segundos) {
  const total = valido(segundos) && segundos > 0 ? Math.floor(segundos) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}
