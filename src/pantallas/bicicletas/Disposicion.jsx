// Disposición de Bicicletas, Alarmas y Estacionamiento según el ancho disponible (medido con
// onLayout, así sigue al ancho real del contenido y no al de la ventana, que incluye el menú lateral).
// - Angosto: todo en una columna (mapa arriba, lista debajo).
// - Ancho: el mapa a la izquierda, fijo a la vista mientras se recorre la lista de la derecha.
// Grilla: columnas de un mínimo de ancho, todas iguales; las tarjetas de una fila tienen el mismo
// alto y la última fila no se estira (cada celda tiene su ancho calculado).
import React, { useCallback, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { cortes, espacio } from '../../tema/tokens';
import { estiloMapaFijo } from './mapaFijo';

/** Ancho de contenido desde el que van lado a lado sin el menú lateral (ventanas de menos de 900). */
export const ANCHO_LADO_A_LADO = 880;
/** Con el menú lateral a la vista (escritorio) alcanza con menos: a 1024 px quedan unos 716. */
export const ANCHO_LADO_A_LADO_ESCRITORIO = 700;
/** Con menos alto de ventana el mapa no entra entero a la vista: no queda fijo. */
const ALTO_MINIMO_FIJO = 560;

/**
 * ¿Mapa y lista lado a lado? En escritorio desde ANCHO_LADO_A_LADO_ESCRITORIO de contenido; sin el
 * menú lateral (celular, tableta), desde `minimoSinMenu`, como antes.
 */
export function esLadoALado(ancho, anchoVentana, minimoSinMenu = ANCHO_LADO_A_LADO) {
  if (ancho >= minimoSinMenu) return true;
  return anchoVentana >= cortes.escritorio && ancho >= ANCHO_LADO_A_LADO_ESCRITORIO;
}

/**
 * Alto del mapa lateral: casi todo el alto visible, dejando lugar para el encabezado de la app, el
 * nombre del punto elegido y la leyenda, así el mapa fijo entra entero en la ventana.
 */
export function altoMapaLateral(altoVentana) {
  return Math.round(Math.min(620, Math.max(260, altoVentana - 330)));
}

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
 * Mapa y lista. Angosto: el mapa arriba y la lista debajo. Ancho: el mapa (con su leyenda) en la
 * columna izquierda, que no se estira al alto de la fila y queda fija arriba del área que se desplaza
 * (position: sticky en la web), y la lista a la derecha. `proporcion`: [mapa, lista]; con poco ancho
 * (escritorio chico, ~1024 px) las dos columnas van iguales, así la lista no queda angosta.
 */
export function MapaYLista({ ladoALado, mapa, lista, proporcion = PROPORCION, testID }) {
  const { height: altoVentana } = useWindowDimensions();
  const [anchoFila, alMedirFila] = useAncho();
  if (!ladoALado) {
    return (
      <>
        {mapa}
        {lista}
      </>
    );
  }
  const fijo = altoVentana >= ALTO_MINIMO_FIJO;
  const reparto = anchoFila && anchoFila < ANCHO_LADO_A_LADO ? [1, 1] : proporcion;
  return (
    <View style={estilos.fila} onLayout={alMedirFila}>
      <View
        testID={testID}
        style={[estilos.columnaMapa, { flexGrow: reparto[0] }, fijo && estiloMapaFijo]}
      >
        {mapa}
      </View>
      <View style={[estilos.columnaLista, { flexGrow: reparto[1] }]}>{lista}</View>
    </View>
  );
}

const PROPORCION = [6, 5];

const estilos = StyleSheet.create({
  grilla: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  celda: { minWidth: 0 },
  celdaEntera: { width: '100%' },
  fila: { flexDirection: 'row', alignItems: 'stretch', gap: espacio.xl },
  // alignSelf: 'flex-start': la columna del mapa mide lo que el mapa, así puede quedar fija mientras
  // la de la lista (más alta) sigue pasando.
  columnaMapa: { flexShrink: 1, flexBasis: 0, minWidth: 0, alignSelf: 'flex-start', gap: espacio.m },
  columnaLista: { flexShrink: 1, flexBasis: 0, minWidth: 0, gap: espacio.l },
});
