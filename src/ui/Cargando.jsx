// Indicador de carga (WP5, 7.2). Sin `lineas`: ActivityIndicator con el mensaje.
// Con `lineas`: esqueleto de barras grises (para listas que todavía no llegaron).
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colores, espacio, radios } from '../tema/tokens';
import Texto from './Texto';

const ANCHOS = ['100%', '82%', '64%', '90%', '72%'];

export default function Cargando({ mensaje = 'Cargando…', lineas, testID = 'cargando', pantallaCompleta = false }) {
  if (lineas) {
    return (
      <View role="status" aria-busy testID={testID} style={estilos.esqueleto}>
        {Array.from({ length: lineas }, (_, i) => (
          <View key={i} aria-hidden style={[estilos.barra, { width: ANCHOS[i % ANCHOS.length] }]} />
        ))}
        <Texto variante="chico" color={colores.textoSuave}>
          {mensaje}
        </Texto>
      </View>
    );
  }
  return (
    <View role="status" aria-busy testID={testID} style={[estilos.centro, pantallaCompleta && estilos.completa]}>
      <ActivityIndicator size="large" color={colores.accion} aria-label={mensaje} />
      <Texto variante="cuerpo" color={colores.textoSuave}>
        {mensaje}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { alignItems: 'center', justifyContent: 'center', gap: espacio.m, padding: espacio.xl },
  completa: { flex: 1, backgroundColor: colores.fondo },
  esqueleto: { gap: espacio.s, alignSelf: 'stretch', paddingVertical: espacio.s },
  barra: { height: 18, borderRadius: radios.chico, backgroundColor: '#e3e9ef' },
});
