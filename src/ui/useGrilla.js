// Grilla que agrega columnas según el ancho medido del contenedor (WP5, 7.2).
//   const g = useGrilla({ minimo: 300, maximo: 4 });
//   <View onLayout={g.alMedir} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: g.gap }}>
//     {items.map((x) => <Tarjeta estilo={{ width: g.anchoColumna }} … />)}
//   </View>
// Las tarjetas de una misma fila quedan del mismo alto (alignItems: 'stretch' del contenedor).
import { useCallback, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { cortes, espacio, medidas } from '../tema/tokens';

/** Ancho aproximado del contenido de <Pantalla> antes de medir (evita un salto en el primer cuadro). */
export function anchoContenidoEstimado(anchoVentana) {
  const menu = anchoVentana >= cortes.escritorio ? medidas.anchoMenu : 0;
  const margen = anchoVentana >= cortes.tableta ? espacio.xl : medidas.margenLateral;
  return Math.max(0, Math.min(anchoVentana - menu - 2 * margen, medidas.anchoMaximo - 2 * margen));
}

/** Cuántas columnas de al menos `minimo` px entran en `ancho`, entre 1 y `maximo`. */
export function columnasPara(ancho, minimo, maximo = 6, gap = espacio.l) {
  const n = Math.floor((ancho + gap) / (minimo + gap));
  return Math.max(1, Math.min(maximo, n));
}

export function useGrilla({ minimo = 300, maximo = 6, gap = espacio.l } = {}) {
  const { width } = useWindowDimensions();
  const [medido, setMedido] = useState(null);
  const ancho = medido ?? anchoContenidoEstimado(width);
  const columnas = columnasPara(ancho, minimo, maximo, gap);
  const anchoColumna = Math.floor((ancho - gap * (columnas - 1)) / columnas);
  const alMedir = useCallback((e) => {
    const w = Math.round(e?.nativeEvent?.layout?.width ?? 0);
    if (w > 0) setMedido((anterior) => (anterior === w ? anterior : w));
  }, []);
  return { ancho, columnas, anchoColumna, gap, alMedir };
}
