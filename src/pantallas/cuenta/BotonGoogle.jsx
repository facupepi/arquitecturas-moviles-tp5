// Botón "Continuar con Google" / "Vincular con Google" (S1). Mismo alto y comportamiento que
// <Boton> de src/ui, pero con el logo de Google (el SVG de heredado:AuthGate.jsx) dibujado con
// <Image> y una URI de datos, así sigue siendo React Native puro (sin <svg> en JSX).
import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { colores, espacio, medidas, radios } from '../../tema/tokens';
import { Texto } from '../../ui';

const SVG_GOOGLE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">'
  + '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/>'
  + '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.01 46.98 31.83 46.98 24.55Z"/>'
  + '<path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.28-3.13.75-4.59l-7.97-6.19A23.8 23.8 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"/>'
  + '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48Z"/>'
  + '</svg>';

// RNW codifica por su cuenta el SVG que sigue a 'data:image/svg+xml;utf8,' (no hay que codificarlo dos veces).
const LOGO = { uri: `data:image/svg+xml;utf8,${SVG_GOOGLE}`, width: 22, height: 22 };

export function LogoGoogle({ tamano = 22 }) {
  return <Image source={LOGO} aria-hidden style={{ width: tamano, height: tamano }} />;
}

export default function BotonGoogle({ titulo, onPress, cargando = false, deshabilitado = false, testID }) {
  const inactivo = cargando || deshabilitado;
  return (
    <Pressable
      role="button"
      onPress={() => {
        if (!inactivo) onPress?.();
      }}
      disabled={inactivo}
      aria-disabled={inactivo || undefined}
      aria-busy={cargando || undefined}
      testID={testID}
      style={({ pressed, hovered }) => [
        estilos.boton,
        (pressed || hovered) && !inactivo ? estilos.activo : null,
        deshabilitado && !cargando ? estilos.deshabilitado : null,
      ]}
    >
      <View style={estilos.logo}>
        {cargando ? <ActivityIndicator size="small" color={colores.accion} aria-label="Procesando" /> : <LogoGoogle />}
      </View>
      <Texto variante="cuerpo" peso="700" alineacion="center">
        {titulo}
      </Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  boton: {
    minHeight: medidas.toqueMinimo + 4,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.m,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radios.medio,
    borderWidth: 1,
    borderColor: colores.bordeCampo,
    backgroundColor: colores.superficie,
    cursor: 'pointer',
  },
  activo: { backgroundColor: '#f1f6fa', borderColor: colores.accion },
  deshabilitado: { opacity: 0.5 },
  logo: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
});
