// Textos y cálculos de la pantalla de Tributos (S4). El estado de cada cedulón sale siempre de
// estadoTributo (shared/dominio.mjs), la misma función que usan el almacén, las reglas de la demo
// y los recordatorios: acá solo se traduce a etiquetas, tonos y frases para el vecino.
import { diaCordoba, estadoTributo } from '../../../shared/dominio.mjs';
import { ETIQUETAS } from '../../../shared/constantes.mjs';

const MS_DIA = 24 * 60 * 60 * 1000;

export const ESTADOS = {
  vencido: { texto: ETIQUETAS.estadosTributo.vencido, tono: 'peligro', icono: 'alerta', tarjeta: 'peligro' },
  por_vencer: { texto: ETIQUETAS.estadosTributo.por_vencer, tono: 'alerta', icono: 'reloj', tarjeta: 'alerta' },
  pendiente: { texto: ETIQUETAS.estadosTributo.pendiente, tono: 'neutro', icono: null, tarjeta: 'normal' },
  pagado: { texto: ETIQUETAS.estadosTributo.pagado, tono: 'exito', icono: 'check', tarjeta: 'normal' },
};

/** Días de calendario de Córdoba entre dos instantes (hoy = 0, mañana = 1, ayer = -1). */
export function diasHasta(desdeMs, hastaMs) {
  return Math.round((Date.parse(diaCordoba(hastaMs)) - Date.parse(diaCordoba(desdeMs))) / MS_DIA);
}

/** "vence hoy", "vence mañana", "vence en 8 días", "venció ayer", "venció hace 40 días". */
export function cuandoVence(venceMs, ahoraMs) {
  if (!Number.isFinite(venceMs)) return '';
  const dias = diasHasta(ahoraMs, venceMs);
  if (venceMs <= ahoraMs) {
    if (dias >= 0) return 'venció hoy';
    if (dias === -1) return 'venció ayer';
    return `venció hace ${-dias} días`;
  }
  if (dias <= 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  return `vence en ${dias} días`;
}

/** Tributos con el estado recalculado al momento `ahora` (el almacén lo calcula al recibirlos). */
export function conEstado(tributos, ahoraMs) {
  return (tributos ?? []).map((t) => ({ ...t, estado: estadoTributo(t, ahoraMs) }));
}

/** Resumen para la tarjeta "Total pendiente": incluye los vencidos. */
export function resumir(tributos) {
  const impagos = tributos.filter((t) => t.estado !== 'pagado');
  const vencidos = impagos.filter((t) => t.estado === 'vencido');
  const porVencer = impagos.filter((t) => t.estado === 'por_vencer');
  const proximo = impagos
    .filter((t) => t.estado !== 'vencido')
    .reduce((min, t) => (!min || t.vence < min.vence ? t : min), null);
  return {
    impagos,
    total: impagos.reduce((suma, t) => suma + (Number(t.importe) || 0), 0),
    vencidos: vencidos.length,
    totalVencido: vencidos.reduce((suma, t) => suma + (Number(t.importe) || 0), 0),
    porVencer: porVencer.length,
    proximo,
  };
}

/** Orden de la lista de pendientes: primero los vencidos, después por fecha de vencimiento. */
export function ordenarPendientes(tributos) {
  const peso = { vencido: 0, por_vencer: 1, pendiente: 2 };
  return [...tributos].sort((a, b) => (peso[a.estado] ?? 3) - (peso[b.estado] ?? 3) || (a.vence ?? 0) - (b.vence ?? 0));
}

export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** "Tasa de servicios municipales 10/2026" */
export const nombreTributo = (t) => [t?.concepto, t?.periodo].filter(Boolean).join(' ');
