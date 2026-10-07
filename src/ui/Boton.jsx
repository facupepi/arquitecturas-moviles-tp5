// Botón (WP5, 7.2). Medidas y colores de heredado:src/components.jsx:3-55.
// Alto mínimo 48. Con `cargando` muestra un indicador y queda deshabilitado.
// Con `href` abre el enlace con abrirEnlace (tel:, mailto:, sms: en la misma ventana; https: aparte).
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { colores, espacio, medidas, radios, tipografia } from '../tema/tokens';
import { abrirEnlace } from '../plataforma/enlaces';
import Icono from './Icono';
import Texto from './Texto';
import { conFoco } from './comun';

const VARIANTES = {
  primario: { fondo: colores.accion, fondoActivo: colores.accionOscuro, texto: colores.blanco, borde: colores.accion },
  secundario: { fondo: colores.celesteClaro, fondoActivo: '#c9e7f8', texto: colores.accionOscuro, borde: colores.celesteClaro },
  // Fondo al pasar el puntero más claro que celesteClaro: con texto accion queda en 4,55:1 (AA; pedido de S7).
  texto: { fondo: 'transparent', fondoActivo: '#eef7fd', texto: colores.accion, borde: 'transparent' },
  peligro: { fondo: colores.peligro, fondoActivo: '#86132c', texto: colores.blanco, borde: colores.peligro },
};

export default function Boton({
  titulo,
  onPress,
  variante = 'primario',
  icono,
  cargando = false,
  deshabilitado = false,
  href,
  externo,
  ancho = 'auto',
  etiquetaAccesible,
  testID,
}) {
  const v = VARIANTES[variante] ?? VARIANTES.primario;
  const inactivo = deshabilitado || cargando;
  const esExterno = externo ?? (typeof href === 'string' && /^https?:/i.test(href));

  const alPresionar = () => {
    if (inactivo) return;
    if (href) {
      abrirEnlace(href).catch(() => {});
      onPress?.();
      return;
    }
    onPress?.();
  };

  const etiqueta = etiquetaAccesible ?? (esExterno ? `${titulo} (se abre en otra pestaña)` : undefined);

  return (
    <Pressable
      role={href ? 'link' : 'button'}
      onPress={conFoco(alPresionar)}
      disabled={inactivo}
      aria-disabled={inactivo || undefined}
      aria-busy={cargando || undefined}
      aria-label={etiqueta}
      testID={testID}
      style={({ pressed, hovered }) => [
        estilos.base,
        {
          backgroundColor: pressed || hovered ? v.fondoActivo : v.fondo,
          borderColor: v.borde,
          opacity: deshabilitado && !cargando ? 0.5 : 1,
        },
        variante === 'texto' && estilos.texto,
        ancho === 'completo' ? estilos.completo : estilos.auto,
      ]}
    >
      {cargando ? (
        <ActivityIndicator size="small" color={v.texto} aria-label="Procesando" />
      ) : icono ? (
        <Icono nombre={icono} tamano={18} color={v.texto} />
      ) : null}
      <Texto
        variante="cuerpo"
        color={v.texto}
        peso="700"
        alineacion="center"
        estilo={variante === 'texto' ? estilos.textoSubrayado : null}
      >
        {titulo}
      </Texto>
      {esExterno && !cargando ? (
        <View style={estilos.externo}>
          <Icono nombre="externo" tamano={16} color={v.texto} />
        </View>
      ) : null}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    minHeight: medidas.toqueMinimo,
    minWidth: medidas.toqueMinimo,
    borderRadius: radios.medio,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.s,
    cursor: 'pointer',
  },
  texto: { paddingHorizontal: espacio.m },
  textoSubrayado: { textDecorationLine: 'underline', fontFamily: tipografia.familia },
  auto: { alignSelf: 'flex-start' },
  completo: { alignSelf: 'stretch' },
  externo: { marginLeft: -2 },
});
