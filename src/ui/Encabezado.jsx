// Encabezado de página (WP5, 7.2): antetítulo, título nivel 1, bajada y acción opcional.
// Al montarse después de una navegación recibe el foco (como heredado:MunicipalApp.jsx:43-50),
// así el lector de pantalla anuncia la pantalla nueva y el teclado sigue desde arriba.
import React, { useContext, useEffect, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { colores, cortes, espacio, tipografia } from '../tema/tokens';
import { ContextoNavegacion } from '../navegacion/ProveedorNavegacion';
import Texto from './Texto';

export const ANTETITULO_POR_DEFECTO = 'TUS SERVICIOS MUNICIPALES';

export default function Encabezado({ antetitulo = ANTETITULO_POR_DEFECTO, titulo, bajada, accion }) {
  const { width } = useWindowDimensions();
  const navegacion = useContext(ContextoNavegacion);
  const refTitulo = useRef(null);
  const ancho = width >= cortes.tableta;
  const huboNavegacion = (navegacion?.cambios ?? 0) > 0;

  useEffect(() => {
    if (!huboNavegacion) return;
    try {
      refTitulo.current?.focus?.({ preventScroll: true });
    } catch {
      // En nativo un Text no recibe foco: no hace falta.
    }
    // Solo al montarse: cada pantalla monta su propio encabezado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[estilos.encabezado, ancho && estilos.encabezadoAncho]}>
      <View style={estilos.textos}>
        {antetitulo ? (
          <Texto variante="antetitulo" color={colores.accion}>
            {antetitulo}
          </Texto>
        ) : null}
        <Texto
          ref={refTitulo}
          role="heading"
          aria-level={1}
          tabIndex={-1}
          dataSet={{ focoTitulo: true }}
          variante="titulo1"
          testID="titulo-pantalla"
          estilo={!ancho ? estilos.tituloAngosto : null}
        >
          {titulo}
        </Texto>
        {bajada ? (
          <Texto variante="cuerpo" color={colores.textoSuave} estilo={estilos.bajada}>
            {bajada}
          </Texto>
        ) : null}
      </View>
      {accion ? <View style={ancho ? estilos.accionAncha : estilos.accionAngosta}>{accion}</View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  encabezado: { gap: espacio.m, paddingTop: espacio.xl, paddingBottom: espacio.l },
  encabezadoAncho: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  textos: { flexShrink: 1, gap: espacio.xs, minWidth: 0 },
  tituloAngosto: { fontSize: 26, lineHeight: 32, fontFamily: tipografia.familia },
  bajada: { maxWidth: 680 },
  accionAncha: { flexShrink: 0 },
  accionAngosta: { alignSelf: 'stretch' },
});
