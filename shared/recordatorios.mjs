// Recordatorios de vencimiento (T4) y de estacionamiento (E3), de heredado:functions/lib/reminders.mjs.
// Funciones puras: reciben los datos y el reloj (ms) y devuelven qué notificaciones corresponden.
// El `id` es una clave determinista: sirve de id del documento de notificación (creado con
// soloSiNoExiste, así nunca se duplica) y de claveEntrega para el push y la notificación local.

import { LIMITES } from './constantes.mjs';
import { diaCordoba, ErrorDominio } from './dominio.mjs';
import { dinero, fecha, hora } from './formato.mjs';

const MS_MINUTO = 60 * 1000;
const MS_DIA = 24 * 60 * MS_MINUTO;

// Diferencia en días de calendario de Córdoba (hoy = 0, mañana = 1).
function diasCalendario(desdeMs, hastaMs) {
  return Math.round((Date.parse(diaCordoba(hastaMs)) - Date.parse(diaCordoba(desdeMs))) / MS_DIA);
}

function cuandoVence(dias) {
  if (dias <= 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  return `vence en ${dias} días`;
}

// → [{ id, titulo, cuerpo, tipo: 'tributos', destino, tributoId, etapa }]
// id: tributo-<tributoId>-<AAAA-MM-DD del vencimiento en Córdoba>-<por_vencer|vencido>
export function recordatoriosTributos(tributos, ahora, dias = LIMITES.diasAvisoVencimiento) {
  const resultado = [];
  for (const t of tributos ?? []) {
    if (t.pagadoEn != null || !Number.isFinite(t.vence)) continue;
    const falta = t.vence - ahora;
    if (falta > dias * MS_DIA) continue;
    const etapa = falta <= 0 ? 'vencido' : 'por_vencer';
    const nombre = `${t.concepto} ${t.periodo}`;
    resultado.push({
      id: `tributo-${t.id}-${diaCordoba(t.vence)}-${etapa}`,
      titulo: etapa === 'vencido'
        ? 'Tenés un cedulón vencido'
        : `Tu ${nombre} ${cuandoVence(diasCalendario(ahora, t.vence))}`,
      cuerpo: etapa === 'vencido'
        ? `${nombre}: venció el ${fecha(t.vence)}. Importe: ${dinero(t.importe)}. Podés pagarlo desde Tributos.`
        : `Importe: ${dinero(t.importe)}. Vence el ${fecha(t.vence)}. Podés pagarlo desde Tributos.`,
      tipo: 'tributos',
      destino: `#/tributos/${t.id}`,
      tributoId: t.id,
      etapa,
    });
  }
  return resultado;
}

// → [{ id, sesionId, etapa: 'por_vencer' | 'finalizado', titulo, cuerpo, destino, tipo }]
// `minutos` es municipal/config.avisoEstacionamientoMin (1 a 14) y es obligatorio: no hay umbral fijo.
// id: est-<sesionId>-<finMs>-<etapa>. Al extender cambia `fin`, así que el nuevo aviso tiene otra clave.
// Respeta avisoPorVencer y avisoFinalizado (los marca la tarea `minuto` después de avisar).
export function recordatoriosEstacionamiento(sesiones, ahora, minutos) {
  if (!Number.isInteger(minutos) || minutos < 1 || minutos > LIMITES.avisoEstacionamientoMinMax) {
    throw new ErrorDominio('El aviso de estacionamiento debe estar entre 1 y 14 minutos.', 'avisoEstacionamientoMin');
  }
  const resultado = [];
  for (const s of sesiones ?? []) {
    if (!Number.isFinite(s.fin)) continue;
    const falta = s.fin - ahora;
    let etapa = null;
    if (falta > 0 && falta <= minutos * MS_MINUTO && s.avisoPorVencer !== true) etapa = 'por_vencer';
    else if (falta <= 0 && s.avisoFinalizado !== true) etapa = 'finalizado';
    if (!etapa) continue;
    const lugar = s.zonaNombre ? ` en ${s.zonaNombre}` : '';
    resultado.push({
      id: `est-${s.id}-${s.fin}-${etapa}`,
      sesionId: s.id,
      etapa,
      titulo: etapa === 'por_vencer' ? 'Tu estacionamiento está por vencer' : 'Tu estacionamiento finalizó',
      cuerpo: etapa === 'por_vencer'
        ? `Patente ${s.patente}${lugar}. Termina a las ${hora(s.fin)}. Podés extenderlo desde la app.`
        : `Patente ${s.patente}${lugar}. Si necesitás más tiempo, iniciá una nueva sesión.`,
      destino: '#/estacionamiento',
      tipo: 'estacionamiento',
    });
  }
  return resultado;
}
