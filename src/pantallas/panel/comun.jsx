// Piezas compartidas por las pestañas del panel municipal (S8, sección 8.11).
import React, { useCallback, useEffect, useState } from 'react';
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

/** Ancho que ocupa un contenedor (onLayout). 0 hasta la primera medición. */
export function useAncho() {
  const [ancho, setAncho] = useState(0);
  const alMedir = useCallback((e) => {
    const w = Math.round(e.nativeEvent.layout.width);
    setAncho((a) => (Math.abs(a - w) > 1 ? w : a));
  }, []);
  return [ancho, alMedir];
}

/** Ancho a partir del cual el panel pone dos columnas lado a lado (formulario y lista, por ejemplo). */
export const ANCHO_DOS_COLUMNAS = 900;

const SEPARACION = espacio.m;

/**
 * Grilla de tarjetas: suma columnas según el ancho disponible (una en el celular, tres o más en la
 * computadora). Todas las celdas tienen el mismo ancho, también las de la última fila, y las de una
 * misma fila el mismo alto (la tarjeta de adentro se estira con estilosPanel.celda).
 */
export function Grilla({ children, minimo = 300, testID }) {
  const [ancho, alMedir] = useAncho();
  const columnas = ancho ? Math.max(1, Math.floor((ancho + SEPARACION) / (minimo + SEPARACION))) : 1;
  const anchoCelda = columnas > 1 ? Math.floor((ancho - SEPARACION * (columnas - 1)) / columnas) : null;
  return (
    <View testID={testID} onLayout={alMedir} style={estilos.grilla}>
      {React.Children.map(children, (hijo) => (hijo ? (
        <View style={[estilos.celdaGrilla, anchoCelda ? { width: anchoCelda } : estilos.celdaCompleta]}>{hijo}</View>
      ) : null))}
    </View>
  );
}

/** Dos columnas lado a lado desde ANCHO_DOS_COLUMNAS; una debajo de la otra en el celular. */
export function DosColumnas({ principal, lateral, proporcion = [3, 2] }) {
  const [ancho, alMedir] = useAncho();
  const lado = ancho >= ANCHO_DOS_COLUMNAS;
  return (
    <View onLayout={alMedir} style={lado ? estilos.dosColumnas : estilos.unaColumna}>
      <View style={lado ? { flex: proporcion[0], minWidth: 0 } : null}>{principal}</View>
      <View style={lado ? { flex: proporcion[1], minWidth: 0 } : null}>{lateral}</View>
    </View>
  );
}

export const estilosPanel = StyleSheet.create({
  // La tarjeta llena su celda de la Grilla: así todas las de una fila quedan del mismo alto.
  celda: { flexGrow: 1, minWidth: 0 },
  // Empuja lo que sigue al pie de la tarjeta (botones y estado alineados entre tarjetas).
  empujar: { flexGrow: 1 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espacio.s },
  ayuda: { maxWidth: 680 },
});

const estilos = StyleSheet.create({
  envio: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.xs },
  flexible: { flex: 1, minWidth: 0 },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: SEPARACION, alignItems: 'stretch' },
  celdaGrilla: { flexDirection: 'column', minWidth: 0 },
  celdaCompleta: { width: '100%' },
  dosColumnas: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.xl },
  unaColumna: { gap: espacio.l },
});
