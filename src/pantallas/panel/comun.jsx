// Piezas compartidas por las pestañas del panel municipal (S8, sección 8.11).
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { EVENTOS } from '../../firebase/analytics';
import { colores, espacio } from '../../tema/tokens';
import { EtiquetaEstado, Icono, Texto } from '../../ui';
import { fecha, hora } from '../../../shared/formato.mjs';

/** Opciones de useComando para registrar panel_accion con el nombre de la acción (sin datos personales). */
export function accionPanel(accion) {
  return {
    evento: EVENTOS?.PANEL_ACCION ?? 'panel_accion',
    parametrosEvento: typeof accion === 'function' ? accion : () => ({ accion }),
  };
}

export const TONO_ESTADO_RECLAMO = { recibido: 'info', en_proceso: 'alerta', resuelto: 'exito' };

export const ESTADOS_EVENTO = {
  pendiente: { texto: 'En cola', tono: 'neutro' },
  procesando: { texto: 'Enviando', tono: 'info' },
  enviado: { texto: 'Enviado', tono: 'exito' },
  error: { texto: 'Con error', tono: 'peligro' },
};

export const TIPOS_EVENTO = { aviso: 'Aviso', alarma: 'Alarma', reclamo: 'Reclamo' };

/** "1 recordatorio", "3 recordatorios". */
export function plural(n, singular, pluralTexto = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

/** "07/10 14:05": fecha corta para tarjetas angostas. */
export function fechaCorta(ms) {
  if (typeof ms !== 'number') return '—';
  return `${fecha(ms).slice(0, 5)} ${hora(ms)}`;
}

/** Qué pasó con las notificaciones de un evento de la bandeja (patrón outbox, 2.3). */
export function textoEnvio(evento) {
  if (!evento) return { texto: 'Preparando el envío de notificaciones…', tono: 'neutro', icono: 'reloj' };
  if (evento.estado === 'enviado') {
    return evento.enviados > 0
      ? { texto: `Avisado: ${plural(evento.enviados, 'notificación push enviada', 'notificaciones push enviadas')}.`, tono: 'exito', icono: 'checkCirculo' }
      : { texto: 'Avisado en la app. Ningún celular tenía las notificaciones push activadas.', tono: 'exito', icono: 'checkCirculo' };
  }
  if (evento.estado === 'error') {
    return { texto: 'No se pudieron enviar las notificaciones. Se reintenta solo en un minuto.', tono: 'peligro', icono: 'alerta' };
  }
  if (evento.estado === 'procesando') return { texto: 'Enviando notificaciones…', tono: 'info', icono: 'reloj' };
  return { texto: 'Notificaciones en cola para enviar.', tono: 'neutro', icono: 'reloj' };
}

const COLOR_TONO = { exito: colores.exito, peligro: colores.peligro, info: colores.info, neutro: colores.textoSuave };

/** Línea con el estado del envío de un evento (alarma, aviso o reclamo). */
export function EstadoEnvio({ evento, testID }) {
  const { texto, tono, icono } = textoEnvio(evento);
  const color = COLOR_TONO[tono] ?? colores.textoSuave;
  return (
    <View role="status" testID={testID} style={estilos.envio}>
      <Icono nombre={icono} tamano={16} color={color} />
      <Texto variante="chico" color={color} peso="600" estilo={estilos.flexible}>
        {texto}
      </Texto>
    </View>
  );
}

export function EtiquetaEvento({ estado, testID }) {
  const e = ESTADOS_EVENTO[estado] ?? ESTADOS_EVENTO.pendiente;
  return <EtiquetaEstado texto={e.texto} tono={e.tono} testID={testID} />;
}

/**
 * true cuando una lista sigue vacía después de `ms`: así una porción que todavía no llegó se ve
 * como "cargando" y no como "no hay datos", sin quedar cargando para siempre.
 */
export function useVacioConfirmado(vacio, ms = 6000) {
  const [confirmado, setConfirmado] = useState(false);
  useEffect(() => {
    if (!vacio) {
      setConfirmado(false);
      return undefined;
    }
    const t = setTimeout(() => setConfirmado(true), ms);
    return () => clearTimeout(t);
  }, [vacio, ms]);
  return confirmado;
}

/** Grilla que pasa de una columna en el celular a varias en la notebook del proyector. */
export function Grilla({ children, testID }) {
  return (
    <View testID={testID} style={estilos.grilla}>
      {children}
    </View>
  );
}

export const estilosPanel = StyleSheet.create({
  celda: { flexGrow: 1, flexBasis: 300, minWidth: 0 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espacio.s },
  ayuda: { maxWidth: 680 },
});

const estilos = StyleSheet.create({
  envio: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.xs },
  flexible: { flex: 1, minWidth: 0 },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.m, alignItems: 'stretch' },
});
