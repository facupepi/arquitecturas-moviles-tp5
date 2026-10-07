// Ayudantes puros de la pantalla de Estacionamiento (S6, sección 8.9). Sin React ni red.
import { costoEstacionamiento, enHorario } from '../../../shared/dominio.mjs';
import { recordatoriosEstacionamiento } from '../../../shared/recordatorios.mjs';
import { LIMITES } from '../../../shared/constantes.mjs';
import { dinero } from '../../../shared/formato.mjs';

export const MS_MINUTO = 60_000;

// Chips de tiempo (sección 8.9): 15, 30, 60, 90, 120, 180 y 240 minutos.
export const OPCIONES_MINUTOS = [15, 30, 60, 90, 120, 180, 240];

// Extensiones que ofrece cada sesión activa (E4).
export const EXTENSIONES = [15, 30];

/** "15 min", "1 h", "1 h 30 min", "4 h". */
export function textoMinutos(minutos) {
  const n = Number(minutos) || 0;
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Importe entero en pesos, o null si la tarifa o los minutos no son válidos. */
export function importeSeguro(tarifaHora, minutos) {
  try {
    return costoEstacionamiento(tarifaHora, minutos);
  } catch {
    return null;
  }
}

/**
 * Umbral del aviso "por vencer" en minutos: municipal/config.avisoEstacionamientoMin (1 a 14),
 * con 5 si falta o no es válido. Es el mismo valor que usan el almacén y la tarea `minuto`.
 */
export function umbralAviso(config) {
  const n = Number(config?.avisoEstacionamientoMin);
  if (Number.isInteger(n) && n >= 1 && n <= LIMITES.avisoEstacionamientoMinMax) return n;
  return LIMITES.avisoEstacionamientoMinPorDefecto;
}

/** El control de horario vale salvo que el admin lo apague (horarioEstricto: false). */
export function horarioEstricto(config) {
  return config?.horarioEstricto !== false;
}

export function zonaEnHorario(zona, ahora) {
  try {
    return enHorario(zona?.horario, ahora);
  } catch {
    return false;
  }
}

/**
 * Recordatorio "por vencer" de una sesión, con el mismo texto que la notificación local y el push
 * (shared/recordatorios.mjs). Ignora avisoPorVencer: la marca del servidor dice que ya se mandó el
 * push, pero el aviso en pantalla tiene que seguir visible hasta que el vecino extienda o termine.
 */
export function recordatorioPorVencer(sesion, ahora, minutos) {
  try {
    const [r] = recordatoriosEstacionamiento([{ ...sesion, avisoPorVencer: false }], ahora, minutos);
    return r?.etapa === 'por_vencer' ? r : null;
  } catch {
    return null;
  }
}

/** Puntos del mapa: un tramo por zona, azul si cobra ahora, gris fuera de horario. */
export function puntosDeZonas(zonas, ahora) {
  return (zonas ?? [])
    .filter((z) => Number.isFinite(z.lat) && Number.isFinite(z.lng))
    .map((z) => {
      const cobra = zonaEnHorario(z, ahora);
      return {
        id: z.id,
        lat: z.lat,
        lng: z.lng,
        titulo: z.nombre,
        detalles: [
          `${dinero(z.tarifaHora)} por hora`,
          z.horarioTexto,
          cobra ? 'En horario de cobro' : 'Fuera de horario',
        ].filter(Boolean),
        tono: cobra ? 'normal' : 'neutro',
        tramo: Array.isArray(z.tramo) && z.tramo.length > 1 ? z.tramo : undefined,
      };
    });
}

/** Separa las sesiones vigentes (fin en el futuro) de las terminadas. */
export function separarSesiones(sesiones, ahora) {
  const activas = [];
  const terminadas = [];
  for (const s of sesiones ?? []) {
    if (Number.isFinite(s.fin) && s.fin > ahora) activas.push(s);
    else terminadas.push(s);
  }
  activas.sort((a, b) => a.fin - b.fin);
  return { activas, terminadas };
}

/** true si la sesión se terminó a mano antes del tiempo pagado (con un minuto de margen). */
export function terminoAntes(sesion) {
  if (!Number.isFinite(sesion?.inicio) || !Number.isFinite(sesion?.fin)) return false;
  return sesion.fin < sesion.inicio + sesion.minutos * MS_MINUTO - MS_MINUTO;
}
