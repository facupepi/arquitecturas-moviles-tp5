// Sección de una pantalla (WP5, 7.2): subtítulo nivel 2, acción opcional y separación.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { espacio } from '../tema/tokens';
import Texto from './Texto';

export default function Seccion({ titulo, accion, children, testID }) {
  return (
    <View testID={testID} style={estilos.seccion}>
      <View style={estilos.cabecera}>
        <Texto role="heading" aria-level={2} variante="titulo2" estilo={estilos.titulo}>
          {titulo}
        </Texto>
        {accion}
      </View>
      <View style={estilos.cuerpo}>{children}</View>
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { gap: espacio.m, paddingTop: espacio.s },
  cabecera: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espacio.s },
  titulo: { flexShrink: 1 },
  cuerpo: { gap: espacio.m },
});
