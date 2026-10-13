// Formato de importes, fechas y tiempos para mostrar (de heredado:src/platform.web.js money/date).
// Todas usan es-AR y la zona horaria de Córdoba. Las fechas llegan como ms (o null).
// Las fechas se arman con formatToParts para que el resultado sea igual en navegadores, Node y Deno.

import { ETIQUETAS, ZONA_HORARIA } from './constantes.mjs';

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

// Para algo que ya pasó (creado, activado, actualizado): si el reloj del servidor va unos segundos
// adelantado al del teléfono, dice "recién" y no "en menos de 1 min".
export function tiempoPasado(ms, ahora = Date.now()) {
  if (!valido(ms) || !valido(ahora)) return '';
  return tiempoRelativo(Math.min(ms, ahora), ahora);
}

// Código corto de un vecino (últimos 4 caracteres del uid, "…A3F2"): lo ve el vecino en Mi cuenta
// y la Municipalidad en el panel, para saber de quién es cada reclamo sin mostrar datos personales.
// Entre "…" y las letras va un word joiner (U+2060, invisible): el renglón no se corta en el medio.
export const UNION_CODIGO = '⁠';
export function codigoVecino(uid) {
  const corto = String(uid ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
  return corto ? `…${UNION_CODIGO}${corto}` : '';
}

// Texto de búsqueda sin los puntos suspensivos del código de vecino: "…A3F2", "...A3F2" (escrito con
// tres puntos) y el código copiado de la pantalla (con el word joiner) buscan lo mismo que "A3F2".
export function sinSuspensivos(texto) {
  return String(texto ?? '').replace(/⁠|…|\.{2,}/g, '');
}

// "HH:MM:SS" para el temporizador del estacionamiento. Negativo o inválido → "00:00:00".
export function duracion(segundos) {
  const total = valido(segundos) && segundos > 0 ? Math.floor(segundos) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

// ---------- Tarjetas guardadas y medios de pago ----------
// "•••• 4242": la tarjeta siempre se muestra enmascarada (solo se guardan los últimos 4 dígitos).
// Con espacio duro, para que los puntos y los dígitos no queden en renglones distintos.
export function enmascarada(ultimos4) {
  return typeof ultimos4 === 'string' && /^[0-9]{4}$/.test(ultimos4) ? `••••\u00a0${ultimos4}` : '';
}

// Nombre corto de una tarjeta guardada: "Visa crédito •••• 4242" ("Tarjeta de débito •••• 1234" si
// la red no se reconoció).
export function textoTarjeta(tarjeta) {
  if (!tarjeta) return '';
  const tipo = ETIQUETAS.tiposTarjeta[tarjeta.tipo] ?? '';
  const red = tarjeta.red && tarjeta.red !== 'Tarjeta' ? tarjeta.red : null;
  const nombre = red ? `${red} ${tipo}` : `Tarjeta de ${tipo}`;
  return [nombre.trim(), enmascarada(tarjeta.ultimos4)].filter(Boolean).join(' ');
}

// Medio de un pago para el comprobante, el historial y el panel: "Tarjeta de crédito Visa •••• 4242".
// Sin tarjeta (pagos anteriores) queda el medio solo ("Tarjeta de débito", "Billetera virtual");
// sin medio, null.
export function textoMedioPago(medio, tarjeta = null) {
  const etiqueta = ETIQUETAS.mediosPago[medio];
  if (!etiqueta) return null;
  if (!tarjeta || !enmascarada(tarjeta.ultimos4)) return etiqueta;
  const red = tarjeta.red && tarjeta.red !== 'Tarjeta' ? ` ${tarjeta.red}` : '';
  return `${etiqueta}${red} ${enmascarada(tarjeta.ultimos4)}`;
}
