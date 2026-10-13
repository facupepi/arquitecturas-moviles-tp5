// Piezas compartidas por las pestañas del panel municipal (S8, sección 8.11).
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { EVENTOS } from '../../firebase/analytics';
import { colores, espacio, radios } from '../../tema/tokens';
import { EtiquetaEstado, Grilla as GrillaUI, Icono, Tarjeta, Texto, useAnchoDisponible } from '../../ui';
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

/**
 * Dos columnas lado a lado desde ANCHO_DOS_COLUMNAS; una debajo de la otra en el celular.
 * `estirar`: las dos columnas toman el alto de la más alta (dos tarjetas lado a lado quedan parejas).
 */
export function DosColumnas({ principal, lateral, proporcion = [3, 2], estirar = false }) {
  const [ancho, alMedir] = useAncho();
  const lado = ancho >= ANCHO_DOS_COLUMNAS;
  const columna = (flex) => (lado ? [{ flex, minWidth: 0 }, estirar && estilos.columnaEstirada] : null);
  return (
    <View onLayout={alMedir} style={lado ? [estilos.dosColumnas, estirar && estilos.filaEstirada] : estilos.unaColumna}>
      <View style={columna(proporcion[0])}>{principal}</View>
      <View style={columna(proporcion[1])}>{lateral}</View>
    </View>
  );
}

/**
 * Cifra destacada (recaudación, sesiones, vencidos). Todas iguales: ícono y rótulo arriba, cifra y
 * una línea de detalle. Dentro de una Grilla quedan del mismo ancho y alto.
 */
export function Indicador({ etiqueta, valor, detalle, icono, tono = 'info', cargando = false, testID }) {
  const t = TONOS_INDICADOR[tono] ?? TONOS_INDICADOR.info;
  return (
    <Tarjeta estilo={[estilosPanel.celda, estilos.indicador]} testID={testID}>
      <View style={estilos.indicadorCabecera}>
        <View style={[estilos.indicadorIcono, { backgroundColor: t.fondo }]}>
          <Icono nombre={icono} tamano={18} color={t.color} />
        </View>
        <Texto variante="chico" peso="700" color={colores.textoSuave} estilo={estilos.flexible}>{etiqueta}</Texto>
      </View>
      <Texto variante="numero" aria-live="polite" testID={testID ? `${testID}-valor` : undefined} numberOfLines={1}>
        {cargando ? '—' : valor}
      </Texto>
      <Texto variante="chico" color={colores.textoSuave} numberOfLines={2} testID={testID ? `${testID}-detalle` : undefined}>
        {cargando ? 'Calculando…' : detalle}
      </Texto>
    </Tarjeta>
  );
}

/** Ancho a partir del cual los indicadores van en tarjetas lado a lado; por debajo, en una sola tarjeta. */
export const ANCHO_INDICADORES = 600;

/**
 * Fila de indicadores (props de Indicador, cada uno con `clave`). En la computadora, tarjetas del mismo
 * ancho y alto; en el celular, una sola tarjeta con un renglón por cifra para no ocupar toda la pantalla.
 */
export function Indicadores({ items, testID }) {
  const [ancho, alMedir] = useAnchoDisponible();
  if (ancho < ANCHO_INDICADORES) {
    return (
      <View onLayout={alMedir} testID={testID}>
        <Tarjeta estilo={estilos.indicadoresCompactos}>
          {items.map((it, i) => {
            const t = TONOS_INDICADOR[it.tono] ?? TONOS_INDICADOR.info;
            return (
              <View key={it.clave} testID={it.testID} style={[estilos.renglonIndicador, i > 0 && estilos.renglonConBorde]}>
                <View style={[estilos.indicadorIcono, { backgroundColor: t.fondo }]}>
                  <Icono nombre={it.icono} tamano={18} color={t.color} />
                </View>
                <View style={estilos.flexible}>
                  <Texto variante="chico" peso="700" color={colores.textoSuave}>{it.etiqueta}</Texto>
                  <Texto variante="chico" color={colores.textoSuave} testID={it.testID ? `${it.testID}-detalle` : undefined}>
                    {it.cargando ? 'Calculando…' : it.detalle}
                  </Texto>
                </View>
                <Texto variante="titulo2" aria-live="polite" testID={it.testID ? `${it.testID}-valor` : undefined}>
                  {it.cargando ? '—' : it.valor}
                </Texto>
              </View>
            );
          })}
        </Tarjeta>
      </View>
    );
  }
  return (
    <View onLayout={alMedir} testID={testID}>
      <GrillaUI minAncho={220} maxColumnas={items.length}>
        {items.map(({ clave, ...it }) => <Indicador key={clave} {...it} />)}
      </GrillaUI>
    </View>
  );
}

const TONOS_INDICADOR = {
  info: { fondo: colores.infoFondo, color: colores.info },
  exito: { fondo: colores.exitoFondo, color: colores.exito },
  alerta: { fondo: colores.alertaFondo, color: colores.alerta },
  peligro: { fondo: colores.peligroFondo, color: colores.peligro },
};

/** Ancho a partir del cual una Tabla se dibuja en columnas; por debajo, cada fila es un bloque. */
export const ANCHO_TABLA = 640;

/**
 * Tabla de datos de solo lectura. En la computadora: role="table" con encabezados de columna. En el
 * celular (menos de ANCHO_TABLA): una lista donde cada fila se dibuja con `compacta(fila)`.
 * columnas: [{ clave, titulo, flex = 1, alinear: 'right' | undefined, celda(fila) → nodo o texto }].
 */
export function Tabla({ columnas, filas, claveFila, compacta, etiqueta, testID, testIDFila }) {
  const [ancho, alMedir] = useAncho();
  const enColumnas = ancho >= ANCHO_TABLA;
  if (!ancho) return <View onLayout={alMedir} style={estilos.tablaSinMedir} />;
  if (!enColumnas) {
    return (
      <View onLayout={alMedir} role="list" aria-label={etiqueta} testID={testID} style={estilos.tabla}>
        {filas.map((f, i) => (
          <View
            key={claveFila(f)}
            role="listitem"
            testID={testIDFila?.(f)}
            style={[estilos.filaCompacta, i === filas.length - 1 && estilos.sinBorde]}
          >
            {compacta(f)}
          </View>
        ))}
      </View>
    );
  }
  const celda = (c, contenido, encabezado = false) => (
    <View
      key={c.clave}
      role={encabezado ? 'columnheader' : 'cell'}
      style={[estilos.celda, { flex: c.flex ?? 1 }, c.alinear === 'right' && estilos.celdaDerecha]}
    >
      {typeof contenido === 'string' || typeof contenido === 'number' ? (
        <Texto
          variante="chico"
          peso={encabezado ? '700' : '500'}
          color={encabezado ? colores.textoSuave : colores.texto}
          alineacion={c.alinear}
        >
          {contenido}
        </Texto>
      ) : contenido}
    </View>
  );
  return (
    <View onLayout={alMedir} role="table" aria-label={etiqueta} testID={testID} style={estilos.tabla}>
      <View role="row" style={[estilos.fila, estilos.filaEncabezado]}>
        {columnas.map((c) => celda(c, c.titulo, true))}
      </View>
      {filas.map((f, i) => (
        <View
          key={claveFila(f)}
          role="row"
          testID={testIDFila?.(f)}
          style={[estilos.fila, i === filas.length - 1 && estilos.sinBorde]}
        >
          {columnas.map((c) => celda(c, c.celda(f)))}
        </View>
      ))}
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
  filaEstirada: { alignItems: 'stretch' },
  columnaEstirada: { flexDirection: 'column' },
  unaColumna: { gap: espacio.l },
  indicador: { gap: espacio.xs },
  indicadorCabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, marginBottom: espacio.xs },
  indicadoresCompactos: { gap: 0, paddingVertical: espacio.s },
  renglonIndicador: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingVertical: espacio.s },
  renglonConBorde: { borderTopWidth: 1, borderTopColor: colores.borde },
  indicadorIcono: { width: 32, height: 32, borderRadius: radios.pildora, alignItems: 'center', justifyContent: 'center' },
  tabla: {
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radios.grande,
    overflow: 'hidden',
  },
  tablaSinMedir: { minHeight: 120 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    paddingHorizontal: espacio.l,
    paddingVertical: espacio.m,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
  filaEncabezado: { backgroundColor: colores.fondo, paddingVertical: espacio.s },
  filaCompacta: {
    gap: espacio.xs,
    paddingHorizontal: espacio.l,
    paddingVertical: espacio.m,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
  sinBorde: { borderBottomWidth: 0 },
  celda: { minWidth: 0, gap: 2 },
  celdaDerecha: { alignItems: 'flex-end' },
});
