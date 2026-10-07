// Raíz de cada pantalla (WP5, 7.2). ScrollView con ancho máximo 1120, margen lateral 16 y fondo
// claro; dibuja el Encabezado, fija el título del documento y, dentro del marco, termina con el
// pie institucional. testID obligatorio: "pantalla-<ruta>".
import React, { useContext } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { colores, cortes, espacio, medidas } from '../tema/tokens';
import { useTituloDocumento } from '../navegacion/useTituloDocumento';
import { ContextoMarco } from './contextoMarco';
import Encabezado from './Encabezado';

export default function Pantalla({
  titulo,
  bajada,
  antetitulo,
  accion,
  children,
  desplazable = true,
  testID,
}) {
  useTituloDocumento(titulo);
  const { pie } = useContext(ContextoMarco);
  const { width } = useWindowDimensions();
  const margen = width >= cortes.tableta ? espacio.xl : medidas.margenLateral;

  const contenido = (
    <View role="main" style={[estilos.centro, { paddingHorizontal: margen }]}>
      <Encabezado antetitulo={antetitulo} titulo={titulo} bajada={bajada} accion={accion} />
      <View style={estilos.cuerpo}>{children}</View>
    </View>
  );

  if (!desplazable) {
    return (
      <View testID={testID} style={estilos.raiz}>
        {contenido}
        {pie}
      </View>
    );
  }
  return (
    <ScrollView testID={testID} style={estilos.raiz} contentContainerStyle={estilos.desplazable}>
      {contenido}
      <View style={estilos.relleno} />
      {pie}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondo, minHeight: 0 },
  desplazable: { flexGrow: 1 },
  centro: {
    width: '100%',
    maxWidth: medidas.anchoMaximo,
    alignSelf: 'center',
    paddingBottom: espacio.xxl,
  },
  cuerpo: { gap: espacio.l },
  relleno: { flexGrow: 1 },
});
