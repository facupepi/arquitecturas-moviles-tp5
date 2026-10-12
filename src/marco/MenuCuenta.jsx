// Menú de cuenta del encabezado (WP5, 7.4): nombre, tipo de cuenta, "Mi cuenta" y "Cerrar sesión".
// Es un Modal de RN: atrapa el foco, cierra con Escape y devuelve el foco al botón que lo abrió.
import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { colores, espacio, medidas, radios, sombras } from '../tema/tokens';
import Icono from '../ui/Icono';
import Texto from '../ui/Texto';
import { useDevolverFoco, useEscape } from '../ui/comun';

function Opcion({ icono, titulo, onPress, testID }) {
  return (
    <Pressable
      role="button"
      onPress={onPress}
      testID={testID}
      style={({ hovered }) => [estilos.opcion, hovered && estilos.opcionResaltada]}
    >
      <Icono nombre={icono} tamano={20} color={colores.accionOscuro} />
      <Texto variante="cuerpo" peso="600">
        {titulo}
      </Texto>
    </Pressable>
  );
}

export default function MenuCuenta({ visible, usuario, arriba = 64, onCerrar, onMiCuenta, onCerrarSesion }) {
  useDevolverFoco(!!visible);
  useEscape(!!visible, onCerrar);
  const nombre = usuario?.nombre || 'Vecino';
  const tipo = usuario?.email || 'Cuenta de Google';
  return (
    <Modal visible={!!visible} transparent animationType="none" onRequestClose={onCerrar} aria-label="Menú de cuenta" testID="menu-cuenta">
      <View style={estilos.capa}>
        <View style={[estilos.panel, { top: arriba }]}>
          <View style={estilos.cabecera}>
            <Texto variante="cuerpo" peso="700" numberOfLines={1}>
              {nombre}
            </Texto>
            <Texto variante="chico" color={colores.textoSuave}>
              {tipo}
            </Texto>
          </View>
          <Opcion icono="usuario" titulo="Mi cuenta" onPress={onMiCuenta} testID="menu-cuenta-mi-cuenta" />
          <Opcion icono="salir" titulo="Cerrar sesión" onPress={onCerrarSesion} testID="menu-cuenta-cerrar-sesion" />
        </View>
        <Pressable aria-hidden focusable={false} tabIndex={-1} onPress={onCerrar} style={estilos.fondo} />
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  capa: { flex: 1 },
  fondo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 0 },
  panel: {
    position: 'absolute',
    right: espacio.s,
    zIndex: 1,
    width: 260,
    maxWidth: '94%',
    backgroundColor: colores.superficie,
    borderRadius: radios.medio,
    borderWidth: 1,
    borderColor: colores.borde,
    paddingVertical: espacio.s,
    ...sombras.flotante,
  },
  cabecera: {
    paddingHorizontal: espacio.l,
    paddingVertical: espacio.s,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
    marginBottom: espacio.xs,
  },
  opcion: {
    minHeight: medidas.toqueMinimo,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    paddingHorizontal: espacio.l,
    cursor: 'pointer',
  },
  opcionResaltada: { backgroundColor: colores.celesteClaro },
});
