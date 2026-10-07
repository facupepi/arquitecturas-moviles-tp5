// Píldora de estado (WP5, 7.2): siempre con texto, nunca solo color.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio, radios } from '../tema/tokens';
import Icono from './Icono';
import Texto from './Texto';

export const TONOS_ESTADO = {
  exito: { fondo: colores.exitoFondo, texto: colores.exito },
  alerta: { fondo: colores.alertaFondo, texto: colores.alerta },
  peligro: { fondo: colores.peligroFondo, texto: colores.peligro },
  info: { fondo: colores.infoFondo, texto: colores.info },
  neutro: { fondo: '#eef2f6', texto: colores.textoSuave },
};

export default function EtiquetaEstado({ texto, tono = 'neutro', icono, testID }) {
  const t = TONOS_ESTADO[tono] ?? TONOS_ESTADO.neutro;
  return (
    <View testID={testID} style={[estilos.pildora, { backgroundColor: t.fondo }]}>
      {icono ? <Icono nombre={icono} tamano={14} color={t.texto} /> : null}
      <Texto variante="chico" color={t.texto} peso="700">
        {texto}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  pildora: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: espacio.xs,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radios.pildora,
  },
});
