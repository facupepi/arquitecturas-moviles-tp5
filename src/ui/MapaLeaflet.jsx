// Stub nativo del mapa (WP5, 7.2): lista de los puntos, tocables para seleccionarlos.
// La web usa MapaLeaflet.web.jsx.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colores, coloresMapa, espacio, medidas, radios } from '../tema/tokens';
import Texto from './Texto';

export default function MapaLeaflet({ puntos = [], seleccionado, onSeleccionar, alto = 300, etiqueta }) {
  return (
    <ScrollView style={{ height: alto }} contentContainerStyle={estilos.lista} aria-label={etiqueta}>
      {puntos.map((p) => {
        const elegido = p.id === seleccionado;
        return (
          <Pressable
            key={p.id}
            role="button"
            aria-pressed={elegido}
            onPress={() => onSeleccionar?.(p.id)}
            style={[estilos.fila, elegido && estilos.elegida]}
          >
            <View
              style={[
                estilos.punto,
                { backgroundColor: elegido ? coloresMapa.seleccionado : coloresMapa[p.tono] ?? coloresMapa.normal },
              ]}
            />
            <View style={estilos.textos}>
              <Texto variante="cuerpo" peso="700">
                {p.titulo}
              </Texto>
              {(p.detalles ?? []).filter(Boolean).map((d, i) => (
                <Texto key={i} variante="chico" color={colores.textoSuave}>
                  {d}
                </Texto>
              ))}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  lista: { padding: espacio.s, gap: espacio.xs },
  fila: {
    minHeight: medidas.toqueMinimo,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    padding: espacio.s,
    borderRadius: radios.chico,
  },
  elegida: { backgroundColor: colores.celesteClaro },
  punto: { width: 14, height: 14, borderRadius: radios.pildora },
  textos: { flex: 1, gap: 2 },
});
