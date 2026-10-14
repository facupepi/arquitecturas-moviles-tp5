// Interruptor (WP5, 7.2): toda la fila es un control con role="switch" y aria-checked.
// La fila tiene un poco de relleno a los lados para el fondo al pasar el puntero; un margen negativo
// igual lo compensa, así el texto y la pista quedan alineados con el resto de la tarjeta.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colores, espacio, medidas, radios } from '../tema/tokens';
import Texto from './Texto';
import { alPresionarEspacio } from './comun';

export default function Interruptor({ etiqueta, descripcion, valor, onCambio, deshabilitado = false, testID }) {
  const alternar = () => {
    if (!deshabilitado) onCambio?.(!valor);
  };
  return (
    <Pressable
      role="switch"
      aria-checked={!!valor}
      aria-label={descripcion ? `${etiqueta}. ${descripcion}` : etiqueta}
      aria-disabled={deshabilitado || undefined}
      disabled={deshabilitado}
      onPress={alternar}
      onKeyDown={alPresionarEspacio(alternar)}
      testID={testID}
      style={({ hovered }) => [
        estilos.fila,
        hovered && !deshabilitado && estilos.resaltada,
        deshabilitado && estilos.deshabilitada,
      ]}
    >
      <View style={estilos.textos}>
        <Texto variante="cuerpo" peso="600">
          {etiqueta}
        </Texto>
        {descripcion ? (
          <Texto variante="chico" color={colores.textoSuave}>
            {descripcion}
          </Texto>
        ) : null}
      </View>
      <View style={[estilos.pista, valor ? estilos.pistaActiva : null]}>
        <View style={[estilos.perilla, valor ? estilos.perillaActiva : null]} />
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fila: {
    minHeight: medidas.toqueMinimo,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    paddingVertical: espacio.s,
    paddingHorizontal: espacio.xs,
    marginHorizontal: -espacio.xs,
    borderRadius: radios.medio,
    cursor: 'pointer',
    alignSelf: 'stretch',
  },
  resaltada: { backgroundColor: 'rgba(0,119,174,0.06)' },
  deshabilitada: { opacity: 0.5, cursor: 'default' },
  textos: { flex: 1, minWidth: 0, gap: 2 },
  pista: {
    width: 52,
    height: 32,
    borderRadius: radios.pildora,
    backgroundColor: '#8a9aab',
    padding: 3,
    justifyContent: 'center',
    flexShrink: 0,
  },
  pistaActiva: { backgroundColor: colores.accion },
  perilla: {
    width: 26,
    height: 26,
    borderRadius: radios.pildora,
    backgroundColor: colores.blanco,
  },
  perillaActiva: { transform: [{ translateX: 20 }] },
});
