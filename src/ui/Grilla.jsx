// Grilla de tarjetas que suma columnas según el ancho disponible (WP5, 7.2). Cada fila estira sus
// celdas al mismo alto: la tarjeta de adentro usa `flexGrow: 1` y empuja su pie con
// `marginTop: 'auto'`, así los botones quedan alineados entre tarjetas.
//   <Grilla minAncho={300} maxColumnas={3}>{items.map((x) => <Tarjeta key={x.id} … />)}</Grilla>
// El ancho se mide con onLayout; el primer dibujo usa la estimación de useGrilla para no saltar
// de una a tres columnas en el escritorio.
import React, { useCallback, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { espacio } from '../tema/tokens';
import { anchoContenidoEstimado, columnasPara } from './useGrilla';

/** [ancho, alMedir]: ancho real del contenedor que recibe `onLayout={alMedir}`. */
export function useAnchoDisponible() {
  const { width } = useWindowDimensions();
  const [medido, setMedido] = useState(null);
  const alMedir = useCallback((e) => {
    const w = Math.round(e?.nativeEvent?.layout?.width ?? 0);
    if (w > 0) setMedido((previo) => (previo === w ? previo : w));
  }, []);
  return [medido ?? anchoContenidoEstimado(width), alMedir];
}

export default function Grilla({
  children,
  minAncho = 300,
  maxColumnas = 3,
  separacion = espacio.m,
  rol,
  rolCelda,
  etiqueta,
  testID,
}) {
  const [ancho, alMedir] = useAnchoDisponible();
  const columnas = columnasPara(ancho, minAncho, maxColumnas, separacion);
  const items = React.Children.toArray(children).filter(Boolean);
  const mitad = separacion / 2;
  return (
    <View onLayout={alMedir} testID={testID}>
      <View role={rol} aria-label={etiqueta} style={[estilos.grilla, { marginHorizontal: -mitad, rowGap: separacion }]}>
        {items.map((hijo, i) => (
          <View
            key={hijo.key ?? i}
            role={rolCelda}
            style={[estilos.celda, { width: `${100 / columnas}%`, paddingHorizontal: mitad }]}
          >
            {hijo}
          </View>
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  grilla: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  celda: { flexDirection: 'column', minWidth: 0 },
});
