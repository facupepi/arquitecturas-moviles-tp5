// Contador de no leídas (WP5, 7.2): "9+" desde 10. Con 0 no se dibuja.
// Es decorativa (aria-hidden): quien la usa pone la cantidad en su propia etiqueta accesible.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, radios } from '../tema/tokens';
import Texto from './Texto';

export function textoInsignia(cantidad) {
  return cantidad > 9 ? '9+' : String(cantidad);
}

export default function Insignia({ cantidad, testID }) {
  if (!cantidad || cantidad < 1) return null;
  return (
    <View aria-hidden testID={testID} style={estilos.insignia}>
      <Texto variante="chico" color={colores.blanco} peso="700" estilo={estilos.texto}>
        {textoInsignia(cantidad)}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  insignia: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: radios.pildora,
    backgroundColor: colores.peligroAcento,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: { fontSize: 12, lineHeight: 16 },
});
