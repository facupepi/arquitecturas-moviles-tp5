// Disposición de Bicicletas y Alarmas según el ancho disponible (medido con onLayout, así sigue
// al ancho real del contenido y no al de la ventana, que incluye el menú lateral).
// - Angosto: todo en una columna (mapa arriba, lista debajo).
// - Ancho: mapa fijo a la izquierda y la lista a la derecha, lado a lado.
// Grilla: columnas de un mínimo de ancho, todas iguales; las tarjetas de una fila tienen el mismo
// alto y la última fila no se estira (cada celda tiene su ancho calculado).
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { espacio } from '../../tema/tokens';
import { estiloMapaFijo } from './mapaFijo';

export const ANCHO_LADO_A_LADO = 880;

/** [ancho medido, onLayout]. Mientras no se midió, el ancho es 0 (una columna). */
export function useAncho() {
  const [ancho, setAncho] = useState(0);
  const alMedir = useCallback((e) => {
    // Hacia abajo: con un ancho redondeado hacia arriba, la última columna pasaría a otra fila.
    const nuevo = Math.floor(e.nativeEvent.layout.width);
    setAncho((viejo) => (Math.abs(viejo - nuevo) > 1 ? nuevo : viejo));
  }, []);
  return [ancho, alMedir];
}

export function columnasPara(ancho, minimo, separacion = espacio.m, maximo = 4) {
  if (!ancho) return 1;
  return Math.max(1, Math.min(maximo, Math.floor((ancho + separacion) / (minimo + separacion))));
}

export function Grilla({ children, minimo = 300, maximo = 4, separacion = espacio.m, testID }) {
  const [ancho, alMedir] = useAncho();
  const columnas = columnasPara(ancho, minimo, separacion, maximo);
  const celda = columnas > 1 ? Math.floor((ancho - 1 - separacion * (columnas - 1)) / columnas) : null;
  return (
    <View testID={testID} onLayout={alMedir} style={[estilos.grilla, { gap: separacion }]}>
      {React.Children.toArray(children).filter(Boolean).map((hijo) => (
        <View key={hijo.key} style={[estilos.celda, celda ? { width: celda } : estilos.celdaEntera]}>
          {hijo}
        </View>
      ))}
    </View>
  );
}

/**
 * Mapa y lista. `arriba` va siempre primero y a todo el ancho; `lista` va debajo del mapa (angosto)
 * o a su derecha (ancho).
 */
export function MapaYLista({ ladoALado, mapa, lista }) {
  if (!ladoALado) {
    return (
      <>
        {mapa}
        {lista}
      </>
    );
  }
  return (
    <View style={estilos.fila}>
      <View style={estilos.columnaMapa}>
        <View style={[estilos.mapa, estiloMapaFijo]}>{mapa}</View>
      </View>
      <View style={estilos.columnaLista}>{lista}</View>
    </View>
  );
}

const estilos = StyleSheet.create({
  grilla: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  celda: { minWidth: 0 },
  celdaEntera: { width: '100%' },
  fila: { flexDirection: 'row', alignItems: 'stretch', gap: espacio.xl },
  columnaMapa: { flexGrow: 6, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  columnaLista: { flexGrow: 5, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: espacio.l },
  mapa: { gap: espacio.m },
});
