// Contenido de los diálogos de Tributos (S4). Es un grupo enfocable con nombre: cuando el diálogo
// no entra en la pantalla (iPhone 13, 390 × 664) su contenido se desplaza, y así se puede llegar con
// el teclado y desplazarlo con las flechas (regla scrollable-region-focusable de axe). El ScrollView
// del Dialogo es de WP5; si algún día se vuelve enfocable, este envoltorio sigue siendo inofensivo.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { espacio } from '../../tema/tokens';

export default function ContenidoDialogo({ etiqueta, children, testID }) {
  return (
    <View role="group" aria-label={etiqueta} tabIndex={0} testID={testID} style={estilos.contenido}>
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenido: { gap: espacio.m },
});
