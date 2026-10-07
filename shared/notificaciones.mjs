// Política de entrega de notificaciones (de heredado:src/notificationPolicy.js, shouldAlert → decidirEntrega).
// La usan el almacén del cliente (alertas en vivo, historial) y Supabase (despachar, tareas).

import { LIMITES, PREFERENCIAS_POR_DEFECTO, TIPOS_PERSONALES } from './constantes.mjs';
import { distanciaKm } from './dominio.mjs';

function preferenciasCompletas(p) {
  return {
    tipos: Array.isArray(p?.tipos) ? p.tipos : PREFERENCIAS_POR_DEFECTO.tipos,
    zonas: Array.isArray(p?.zonas) ? p.zonas : PREFERENCIAS_POR_DEFECTO.zonas,
    frecuencia: p?.frecuencia ?? PREFERENCIAS_POR_DEFECTO.frecuencia,
    push: p?.push === true,
  };
}

// notif: { tipo, zona } ; preferencias: { tipos, zonas, frecuencia, push } ; cercano: alarma dentro del radio
export function decidirEntrega(notif, preferencias, { cercano = false } = {}) {
  const p = preferenciasCompletas(preferencias);
  const personal = TIPOS_PERSONALES.includes(notif.tipo);
  const emergencia = notif.tipo === 'emergencias';
  const tipoOk = emergencia || p.tipos.includes(notif.tipo);
  const zonaOk = personal || emergencia || notif.zona === 'todas'
    || p.zonas.includes(notif.zona) || (notif.tipo === 'alarmas' && cercano);
  const visible = tipoOk && zonaOk;
  const inmediata = visible && (p.frecuencia === 'inmediata' || emergencia);
  return {
    historial: visible,
    inmediata,
    push: inmediata && p.push,
    resumen: visible && p.frecuencia === 'resumen_diario',
  };
}

// Aviso de la ciudad visible en el historial según las preferencias (todos = sin filtro).
export function avisoVisible(aviso, preferencias, { todos = false } = {}) {
  if (todos) return true;
  return decidirEntrega(aviso, preferencias).historial;
}

// Las notificaciones personales son del vecino: no se filtran por zona (una alarma cercana fuera de
// sus zonas le llega igual), solo por tipo, y las emergencias siempre.
function personalVisible(n, preferencias, todos) {
  if (todos || n.tipo === 'emergencias') return true;
  return preferenciasCompletas(preferencias).tipos.includes(n.tipo);
}

// Clave única de entrega: data.id del push, tag de toda notificación del sistema y clave del conjunto
// de deduplicación del almacén. Un mismo hecho da la misma clave venga de donde venga.
export function claveEntrega(x) {
  switch (x?.fuente) {
    case 'alarma': {
      const a = x.alarma;
      return a.activacionId ?? `alarma-${a.id}-${a.activadaEn ?? 'inactiva'}`;
    }
    case 'aviso':
      return x.aviso.eventoId ?? `aviso-${x.aviso.id}`;
    case 'reclamo': {
      const r = x.reclamo;
      return r.ultimoEventoId ?? `reclamo-${r.id}-${r.estado}`;
    }
    case 'personal': {
      const id = x.notificacion.id;
      if (id.startsWith('alarma-')) return id.slice('alarma-'.length);
      if (id.startsWith('reclamo-')) return id.slice('reclamo-'.length);
      return id;
    }
    case 'sesion':
      return `est-${x.sesion.id}-${x.sesion.fin}-${x.etapa}`;
    default:
      throw new TypeError(`claveEntrega: fuente desconocida (${x?.fuente})`);
  }
}

function contiene(leidos, id) {
  if (!leidos) return false;
  if (typeof leidos.has === 'function') return leidos.has(id);
  if (Array.isArray(leidos)) return leidos.includes(id);
  return false;
}

// → NotificacionUnida[] (4.5), de la más nueva a la más vieja.
// personales: notificaciones/{id} del vecino; avisos: avisos/{id}; leidos: Set (o array) de avisosLeidos.
// Si una personal y un aviso comparten la clave (la alarma cercana y su aviso), queda una sola: la personal.
export function unirNotificaciones(personales, avisos, leidos, preferencias, { todos = false } = {}) {
  const unidas = [];
  for (const n of personales ?? []) {
    if (!personalVisible(n, preferencias, todos)) continue;
    unidas.push({
      id: n.id, fuente: 'personal', titulo: n.titulo, cuerpo: n.cuerpo, detalle: n.detalle ?? null,
      tipo: n.tipo, zona: n.zona ?? null, destino: n.destino ?? null, enlace: n.enlace ?? null,
      creadoEn: n.creadoEn ?? null, leida: n.leida === true,
      clave: claveEntrega({ fuente: 'personal', notificacion: n }),
    });
  }
  const clavesPersonales = new Set(unidas.map((n) => n.clave));
  for (const a of avisos ?? []) {
    if (!avisoVisible(a, preferencias, { todos })) continue;
    const clave = claveEntrega({ fuente: 'aviso', aviso: a });
    if (clavesPersonales.has(clave)) continue;
    unidas.push({
      id: a.id, fuente: 'aviso', titulo: a.titulo, cuerpo: a.cuerpo, detalle: a.detalle ?? null,
      tipo: a.tipo, zona: a.zona ?? null, destino: a.destino ?? null, enlace: a.enlace ?? null,
      creadoEn: a.creadoEn ?? null, leida: contiene(leidos, a.id), clave,
    });
  }
  // Sin fecha (escritura local sin estimar) va primero; empates por id para un orden estable.
  const orden = (n) => (Number.isFinite(n.creadoEn) ? n.creadoEn : Infinity);
  return unidas.sort((a, b) => orden(b) - orden(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// Ids de las alarmas dentro del radio (activas o no: es la cercanía que se registra para el próximo
// disparo), de la más cercana a la más lejana, como máximo 20 (límite de la regla). Sin posición, [].
export function alarmasCercanas(alarmas, posicion, radioKm = LIMITES.radioAlarmaKm) {
  if (!posicion || !Number.isFinite(posicion.lat) || !Number.isFinite(posicion.lng)) return [];
  return (alarmas ?? [])
    .filter((a) => Number.isFinite(a.lat) && Number.isFinite(a.lng))
    .map((a) => ({ id: a.id, d: distanciaKm(posicion, a) }))
    .filter((a) => a.d <= radioKm)
    .sort((a, b) => a.d - b.d)
    .slice(0, 20)
    .map((a) => a.id);
}
