// Pestañas (WP5, 7.2): role="tablist" y "tab" con aria-selected. Si no entran, se desplazan.
// testID: el contenedor lo recibe tal cual y cada pestaña `${testID}-${valor}`
// (testID="panel-pestana" da "panel-pestana-reclamos").
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colores, espacio, medidas, radios } from '../tema/tokens';
import Texto from './Texto';
import { alPresionarEspacio } from './comun';

export default function Pestanas({ opciones = [], valor, onCambio, testID, etiqueta }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={estilos.desplazable}
      contentContainerStyle={estilos.contenido}
    >
      <View role="tablist" aria-label={etiqueta} testID={testID} style={estilos.lista}>
        {opciones.map((o) => {
          const elegida = o.valor === valor;
          const elegir = () => onCambio?.(o.valor);
          const contador = typeof o.contador === 'number' ? o.contador : null;
          return (
            <Pressable
              key={String(o.valor)}
              role="tab"
              aria-selected={elegida}
              aria-label={contador !== null ? `${o.etiqueta}, ${contador}` : undefined}
              onPress={elegir}
              onKeyDown={alPresionarEspacio(elegir)}
              testID={testID ? `${testID}-${o.valor}` : undefined}
              style={({ hovered }) => [
                estilos.pestana,
                elegida && estilos.elegida,
                hovered && !elegida && estilos.resaltada,
              ]}
            >
              <Texto variante="chico" peso="700" color={elegida ? colores.accionOscuro : colores.textoSuave}>
                {o.etiqueta}
              </Texto>
              {contador !== null ? (
                <View style={[estilos.contador, elegida && estilos.contadorElegido]}>
                  <Texto variante="chico" peso="700" color={elegida ? colores.blanco : colores.texto} estilo={estilos.textoContador}>
                    {contador}
                  </Texto>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  desplazable: { flexGrow: 0, alignSelf: 'stretch' },
  contenido: { flexGrow: 1 },
  lista: {
    flexDirection: 'row',
    flexGrow: 1,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
  pestana: {
    minHeight: medidas.toqueMinimo,
    paddingHorizontal: espacio.l,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    marginBottom: -1,
    cursor: 'pointer',
  },
  elegida: { borderBottomColor: colores.accion },
  resaltada: { backgroundColor: 'rgba(0,119,174,0.06)' },
  contador: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: radios.pildora,
    backgroundColor: '#e3e9ef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contadorElegido: { backgroundColor: colores.accion },
  textoContador: { fontSize: 12, lineHeight: 16 },
});
