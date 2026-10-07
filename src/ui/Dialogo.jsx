// Diálogo modal (WP5, 7.2). Modal transparente de RN: en RNW pone role="dialog" y aria-modal,
// atrapa el foco, cierra con Escape (onRequestClose) y devuelve el foco al disparador al cerrarse.
// Reemplaza la trampa de foco hecha a mano de heredado:src/components.jsx:152-216.
//
// acciones: [{ titulo, onPress, variante, cargando, deshabilitado, testID }]
// Con cerrable = false no hay botón de cerrar, ni Escape, ni cierre tocando el fondo
// (por ejemplo, mientras se procesa un pago).
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { colores, cortes, espacio, medidas, radios, sombras } from '../tema/tokens';
import Boton from './Boton';
import Icono from './Icono';
import Texto from './Texto';
import { useDevolverFoco, useEscape, useIdAccesible } from './comun';

export default function Dialogo({ visible, titulo, children, onCerrar, acciones = [], cerrable = true, testID }) {
  const { width, height } = useWindowDimensions();
  const idTitulo = useIdAccesible('dialogo-titulo');
  useDevolverFoco(!!visible);
  const angosto = width < cortes.tableta;
  const cerrar = () => {
    if (cerrable) onCerrar?.();
  };
  useEscape(!!visible, cerrar);

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="none"
      onRequestClose={cerrar}
      aria-labelledby={idTitulo}
      testID={testID}
    >
      <View style={estilos.capa}>
        {/* El panel va primero en el árbol: así el foco inicial cae en el título y no en el fondo. */}
        <View
          style={[
            estilos.panel,
            angosto ? estilos.panelAngosto : null,
            { maxHeight: Math.max(240, height - (angosto ? 24 : 64)) },
          ]}
        >
          <View style={estilos.cabecera}>
            <Texto
              id={idTitulo}
              role="heading"
              aria-level={2}
              tabIndex={-1}
              dataSet={{ focoTitulo: true }}
              variante="titulo3"
              estilo={estilos.titulo}
            >
              {titulo}
            </Texto>
            {cerrable ? (
              <Pressable
                role="button"
                aria-label="Cerrar"
                onPress={cerrar}
                testID={testID ? `${testID}-cerrar` : undefined}
                style={({ hovered }) => [estilos.cerrar, hovered && estilos.cerrarResaltado]}
              >
                <Icono nombre="cerrar" tamano={22} color={colores.texto} />
              </Pressable>
            ) : null}
          </View>
          <ScrollView style={estilos.desplazable} contentContainerStyle={estilos.contenido}>
            {children}
          </ScrollView>
          {acciones.length ? (
            <View style={[estilos.acciones, angosto ? estilos.accionesAngosto : null]}>
              {acciones.map((a, i) => (
                <Boton
                  key={a.testID ?? `${a.titulo}-${i}`}
                  titulo={a.titulo}
                  onPress={a.onPress}
                  variante={a.variante ?? (i === acciones.length - 1 ? 'primario' : 'secundario')}
                  cargando={a.cargando}
                  deshabilitado={a.deshabilitado}
                  testID={a.testID}
                  ancho={angosto ? 'completo' : 'auto'}
                />
              ))}
            </View>
          ) : null}
        </View>
        <Pressable
          aria-hidden
          focusable={false}
          tabIndex={-1}
          onPress={cerrar}
          style={[estilos.fondo, { cursor: cerrable ? 'pointer' : 'default' }]}
        />
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  capa: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: espacio.l,
  },
  fondo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(16,43,61,0.55)',
    zIndex: 0,
  },
  panel: {
    zIndex: 1,
    width: '100%',
    maxWidth: 560,
    backgroundColor: colores.superficie,
    borderRadius: radios.grande,
    overflow: 'hidden',
    ...sombras.flotante,
  },
  panelAngosto: { borderRadius: radios.medio },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    paddingLeft: espacio.xl,
    paddingRight: espacio.s,
    paddingTop: espacio.s,
    minHeight: 56,
  },
  titulo: { flex: 1, paddingVertical: espacio.s },
  cerrar: {
    width: medidas.toqueMinimo,
    height: medidas.toqueMinimo,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radios.pildora,
  },
  cerrarResaltado: { backgroundColor: '#eef2f6' },
  desplazable: { flexGrow: 0, flexShrink: 1 },
  contenido: { paddingHorizontal: espacio.xl, paddingBottom: espacio.l, gap: espacio.m },
  acciones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: espacio.s,
    paddingHorizontal: espacio.xl,
    paddingVertical: espacio.l,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
  },
  accionesAngosto: { flexDirection: 'column-reverse', alignItems: 'stretch' },
});
