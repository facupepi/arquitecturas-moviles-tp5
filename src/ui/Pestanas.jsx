// Pestañas (WP5, 7.2): role="tablist" y "tab" con aria-selected. Si no entran, se desplazan:
// la pestaña elegida se lleva a la vista y un borde con flecha avisa que hay más hacia ese lado.
// testID: el contenedor lo recibe tal cual y cada pestaña `${testID}-${valor}`
// (testID="panel-pestana" da "panel-pestana-reclamos").
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { colores, cortes, espacio, medidas, radios } from '../tema/tokens';
import Icono from './Icono';
import Texto from './Texto';
import { alPresionarEspacio } from './comun';

const MARGEN_VISTA = 36; // lo que se deja a la vista de la pestaña vecina al llevar la elegida a la vista

export default function Pestanas({ opciones = [], valor, onCambio, testID, etiqueta }) {
  const { width } = useWindowDimensions();
  const angosta = width < cortes.tableta;
  const desplazable = useRef(null);
  const posiciones = useRef({});
  const [anchoVista, setAnchoVista] = useState(0);
  const [anchoContenido, setAnchoContenido] = useState(0);
  const [desplazado, setDesplazado] = useState(0);
  const [medicion, setMedicion] = useState(0); // cambia cuando se miden las pestañas

  const sobra = anchoContenido - anchoVista;
  const hayMasDerecha = sobra > 2 && desplazado < sobra - 2;
  const hayMasIzquierda = sobra > 2 && desplazado > 2;

  // La pestaña elegida (por toque, teclado o enlace profundo) siempre queda entera a la vista.
  useEffect(() => {
    const p = posiciones.current[String(valor)];
    if (!p || !desplazable.current || sobra <= 2) return;
    let destino = null;
    if (p.x < desplazado) destino = p.x - MARGEN_VISTA;
    else if (p.x + p.ancho > desplazado + anchoVista) destino = p.x + p.ancho - anchoVista + MARGEN_VISTA;
    if (destino === null) return;
    desplazable.current.scrollTo({ x: Math.max(0, Math.min(sobra, destino)), animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, anchoVista, anchoContenido, medicion]);

  return (
    <View style={estilos.envoltura}>
      <ScrollView
        ref={desplazable}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={estilos.desplazable}
        contentContainerStyle={estilos.contenido}
        scrollEventThrottle={32}
        onScroll={(e) => setDesplazado(Math.round(e.nativeEvent.contentOffset.x))}
        onLayout={(e) => setAnchoVista(Math.round(e.nativeEvent.layout.width))}
        onContentSizeChange={(w) => setAnchoContenido(Math.round(w))}
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
                onLayout={(e) => {
                  const { x, width: ancho } = e.nativeEvent.layout;
                  posiciones.current[String(o.valor)] = { x, ancho };
                  setMedicion((n) => n + 1);
                }}
                testID={testID ? `${testID}-${o.valor}` : undefined}
                style={({ hovered }) => [
                  estilos.pestana,
                  angosta && estilos.pestanaAngosta,
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
      {/* Señal visual de que hay más pestañas: no es interactiva (se desliza o se usa el teclado). */}
      {hayMasIzquierda ? (
        <View aria-hidden style={[estilos.borde, estilos.bordeIzquierdo]} testID={testID ? `${testID}-mas-izquierda` : undefined}>
          <Icono nombre="chevronIzquierda" tamano={18} color={colores.textoSuave} />
        </View>
      ) : null}
      {hayMasDerecha ? (
        <View aria-hidden style={[estilos.borde, estilos.bordeDerecho]} testID={testID ? `${testID}-mas-derecha` : undefined}>
          <Icono nombre="chevron" tamano={18} color={colores.textoSuave} />
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  envoltura: { position: 'relative', alignSelf: 'stretch' },
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
  pestanaAngosta: { paddingHorizontal: espacio.m },
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
  borde: {
    position: 'absolute',
    top: 0,
    bottom: 1,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,247,250,0.94)',
    pointerEvents: 'none',
  },
  bordeIzquierdo: { left: 0 },
  bordeDerecho: { right: 0 },
});
