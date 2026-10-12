// Banner dentro de la página (WP5, 7.2). rol "status" (cortés) o "alert" (interrumpe).
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colores, espacio, medidas, radios } from '../tema/tokens';
import Boton from './Boton';
import Icono from './Icono';
import Texto from './Texto';

export const TONOS_AVISO = {
  exito: { fondo: colores.exitoFondo, texto: colores.exito, acento: colores.exitoAcento, icono: 'checkCirculo' },
  info: { fondo: colores.infoFondo, texto: colores.info, acento: colores.municipal, icono: 'info' },
  alerta: { fondo: colores.alertaFondo, texto: colores.alerta, acento: colores.alertaAcento, icono: 'alerta' },
  peligro: { fondo: colores.peligroFondo, texto: colores.peligro, acento: colores.peligroAcento, icono: 'alerta' },
  aviso: { fondo: colores.avisoFondo, texto: colores.aviso, acento: colores.avisoAcento, icono: 'info' },
};

export default function Aviso({ tono = 'info', titulo, mensaje, accion, onCerrar, rol = 'status', icono, testID }) {
  const t = TONOS_AVISO[tono] ?? TONOS_AVISO.info;
  return (
    <View
      role={rol}
      testID={testID}
      style={[estilos.aviso, { backgroundColor: t.fondo, borderLeftColor: t.acento }]}
    >
      <View style={estilos.icono}>
        <Icono nombre={icono ?? t.icono} tamano={20} color={t.texto} />
      </View>
      <View style={estilos.cuerpo}>
        {titulo ? (
          <Texto variante="cuerpo" peso="700" color={t.texto}>
            {titulo}
          </Texto>
        ) : null}
        {mensaje ? (
          <Texto variante="chico" color={colores.texto}>
            {mensaje}
          </Texto>
        ) : null}
        {accion ? (
          <View style={estilos.accion}>
            <Boton titulo={accion.titulo} icono={accion.icono} onPress={accion.onPress} variante="contorno" testID={accion.testID} />
          </View>
        ) : null}
      </View>
      {onCerrar ? (
        <Pressable
          role="button"
          aria-label="Cerrar aviso"
          onPress={onCerrar}
          style={({ hovered }) => [estilos.cerrar, hovered && { backgroundColor: 'rgba(30,41,57,0.08)' }]}
        >
          <Icono nombre="cerrar" tamano={18} color={colores.texto} />
        </Pressable>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacio.m,
    paddingVertical: espacio.m,
    paddingLeft: espacio.m,
    paddingRight: espacio.s,
    borderRadius: radios.medio,
    borderLeftWidth: 5,
    alignSelf: 'stretch',
  },
  icono: { paddingTop: 2 },
  cuerpo: { flex: 1, gap: 2, minWidth: 0 },
  accion: { paddingTop: espacio.s },
  cerrar: {
    width: medidas.toqueMinimo,
    height: medidas.toqueMinimo,
    marginVertical: -espacio.s,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radios.pildora,
  },
});
