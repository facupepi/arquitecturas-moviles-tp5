// Simulador de la demo: un paso planifica cambios de bicicletas y avances de reclamos.
// Puro: no escribe nada. La tarea `simulador` de Supabase aplica el plan (y crea los eventos de los
// reclamos). No toca alarmas: se activan solo desde el panel, para no mandar push de alarma en clase.

import { siguienteEstadoReclamo } from './dominio.mjs';

export const MAX_ESTACIONES_POR_PASO = 2;
export const MAX_RECLAMOS_POR_PASO = 2;
export const PROBABILIDAD_AVANCE_RECLAMO = 0.5;
// Antigüedad mínima de la última actualización para avanzar (la tarea ya consulta con estos valores).
export const ESPERA_RECLAMO_MS = Object.freeze({ recibido: 2 * 60 * 1000, en_proceso: 5 * 60 * 1000 });

function entero(aleatorio, max) { // 0..max-1
  return Math.min(max - 1, Math.floor(aleatorio() * max));
}

function mezclar(lista, aleatorio) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = entero(aleatorio, i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// → { estaciones: [{ id, bicicletas }], reclamos: [{ uid, id, estado }] }
// Estaciones: 1 o 2 operativas cambian ±1 o ±2, siempre dentro de [0, capacidad] y con un cambio real.
// Reclamos (candidatos con uid): cada uno avanza un solo paso con probabilidad 1/2, hasta 2 por paso.
export function planificarPaso({ estaciones = [], reclamos = [], ahora = Date.now(), aleatorio = Math.random } = {}) {
  const plan = { estaciones: [], reclamos: [] };

  const operativas = estaciones.filter((e) => e.estado !== 'fuera_de_servicio'
    && Number.isInteger(e.capacidad) && e.capacidad > 0 && Number.isInteger(e.bicicletas));
  const cantidad = Math.min(operativas.length, 1 + entero(aleatorio, MAX_ESTACIONES_POR_PASO));
  for (const e of mezclar(operativas, aleatorio).slice(0, cantidad)) {
    const actual = Math.min(Math.max(e.bicicletas, 0), e.capacidad);
    const paso = 1 + entero(aleatorio, 2);
    const signo = aleatorio() < 0.5 ? -1 : 1;
    let nuevo = Math.min(e.capacidad, Math.max(0, actual + signo * paso));
    if (nuevo === actual) nuevo = Math.min(e.capacidad, Math.max(0, actual - signo * paso)); // en un tope
    if (nuevo !== e.bicicletas) plan.estaciones.push({ id: e.id, bicicletas: nuevo });
  }

  for (const r of mezclar(reclamos, aleatorio)) {
    if (plan.reclamos.length >= MAX_RECLAMOS_POR_PASO) break;
    const estado = siguienteEstadoReclamo(r.estado);
    if (!estado || !r.uid || !r.id) continue;
    if (Number.isFinite(r.actualizadoEn) && ahora - r.actualizadoEn < ESPERA_RECLAMO_MS[r.estado]) continue;
    if (aleatorio() < PROBABILIDAD_AVANCE_RECLAMO) plan.reclamos.push({ uid: r.uid, id: r.id, estado });
  }

  return plan;
}

// Generador con semilla (mulberry32) para pruebas reproducibles. Acepta número o texto.
export function crearAleatorio(semilla = 1) {
  let s = 0;
  if (typeof semilla === 'number') s = semilla >>> 0;
  else for (const c of String(semilla)) s = (Math.imul(s, 31) + c.codePointAt(0)) >>> 0;
  return function aleatorio() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
