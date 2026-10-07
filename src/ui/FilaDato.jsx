// Par etiqueta-valor (WP5, 7.2). En pantallas angostas el valor baja a la línea siguiente.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio } from '../tema/tokens';
import Texto from './Texto';

export default function FilaDato({ etiqueta, valor, testID }) {
  return (
    <View testID={testID} style={estilos.fila}>
      <Texto variante="chico" color={colores.textoSuave} estilo={estilos.etiqueta}>
        {etiqueta}
      </Texto>
      <Texto variante="cuerpo" peso="700" estilo={estilos.valor}>
        {valor ?? '—'}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    columnGap: espacio.m,
    rowGap: 2,
    paddingVertical: espacio.xs,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
  etiqueta: { flexShrink: 0 },
  valor: { flexShrink: 1, textAlign: 'right', marginLeft: 'auto' },
});
