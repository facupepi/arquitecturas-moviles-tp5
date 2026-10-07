// Estado vacío (WP5, 7.2): ícono, título, mensaje y, si aplica, la acción para salir del vacío.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio, radios } from '../tema/tokens';
import Boton from './Boton';
import Icono from './Icono';
import Texto from './Texto';

export default function Vacio({ icono = 'info', titulo, mensaje, accion, testID }) {
  return (
    <View testID={testID} style={estilos.vacio}>
      <View style={estilos.circulo}>
        <Icono nombre={icono} tamano={28} color={colores.accion} />
      </View>
      <Texto variante="titulo3" alineacion="center">
        {titulo}
      </Texto>
      {mensaje ? (
        <Texto variante="cuerpo" color={colores.textoSuave} alineacion="center" estilo={estilos.mensaje}>
          {mensaje}
        </Texto>
      ) : null}
      {accion ? (
        <View style={estilos.accion}>
          <Boton titulo={accion.titulo} onPress={accion.onPress} variante="secundario" testID={accion.testID} />
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  vacio: {
    alignItems: 'center',
    gap: espacio.s,
    paddingVertical: espacio.xl,
    paddingHorizontal: espacio.l,
    borderRadius: radios.grande,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colores.bordeCampo,
    backgroundColor: colores.superficie,
    alignSelf: 'stretch',
  },
  circulo: {
    width: 56,
    height: 56,
    borderRadius: radios.pildora,
    backgroundColor: colores.celesteClaro,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espacio.xs,
  },
  mensaje: { maxWidth: 420 },
  accion: { paddingTop: espacio.s },
});
