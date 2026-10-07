// Indicador de conexión (WP5, 7.4). Sin red: "Sin conexión. Estás viendo los últimos datos
// guardados." La región role="status" existe siempre para que el cambio se anuncie.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useConexion } from '../plataforma/red';
import { colores, espacio } from '../tema/tokens';
import Icono from '../ui/Icono';
import Texto from '../ui/Texto';

export const TEXTO_SIN_CONEXION = 'Sin conexión. Estás viendo los últimos datos guardados.';

export default function IndicadorConexion() {
  const { enLinea } = useConexion();
  return (
    <View role="status">
      {enLinea ? null : (
        <View testID="indicador-conexion" style={estilos.barra}>
          <Icono nombre="sinConexion" tamano={18} color={colores.blanco} />
          <Texto variante="chico" peso="700" color={colores.blanco} estilo={estilos.texto}>
            {TEXTO_SIN_CONEXION}
          </Texto>
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.s,
    paddingHorizontal: espacio.l,
    paddingVertical: espacio.s,
    backgroundColor: colores.texto,
  },
  texto: { flexShrink: 1 },
});
