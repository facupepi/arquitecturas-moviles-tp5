// Tarjeta (WP5, 7.2). Con onPress es un Pressable con role="button": en ese caso no pongas
// botones adentro (un botón dentro de otro no es válido); usá `accion` sin onPress.
// La `accion` (por ejemplo una EtiquetaEstado) queda arriba a la derecha y no baja de línea: un
// título largo pasa a dos líneas (o se corta en `lineasTitulo`) sin mover lo demás.
// Los tonos destacada, alerta y peligro llevan un acento (borde izquierdo de 5 px) que no corre el
// contenido: el relleno izquierdo descuenta lo que crece el borde, así el texto de una tarjeta con
// acento queda alineado con el de una normal apilada (notificaciones leídas y sin leer, alarmas).
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colores, espacio, radios, sombras } from '../tema/tokens';
import Texto from './Texto';
import { conFoco } from './comun';

const TONOS = {
  normal: { fondo: colores.superficie, borde: colores.borde, acento: null },
  destacada: { fondo: colores.celesteClaro, borde: '#b9dff3', acento: colores.accion },
  alerta: { fondo: colores.alertaFondo, borde: '#f6d2a8', acento: colores.alertaAcento },
  peligro: { fondo: colores.peligroFondo, borde: '#f3bcc8', acento: colores.peligroAcento },
};

const ANCHO_ACENTO = 5;

/**
 * Relleno izquierdo con el acento descontado, a partir del borde y el relleno que pide la pantalla
 * en `estilo` (o los de la tarjeta). Si la pantalla dibuja su propio borde izquierdo, no se toca.
 */
function rellenoConAcento(estilo) {
  const plano = StyleSheet.flatten(estilo) ?? {};
  if (plano.borderLeftWidth != null) return null;
  const borde = plano.borderWidth ?? 1;
  const relleno = plano.paddingLeft ?? plano.paddingHorizontal ?? plano.padding ?? espacio.l;
  return { paddingLeft: Math.max(0, relleno - (ANCHO_ACENTO - borde)) };
}

export default function Tarjeta({
  children,
  titulo,
  lineasTitulo,
  accion,
  tono = 'normal',
  onPress,
  etiquetaAccesible,
  testID,
  estilo,
}) {
  const t = TONOS[tono] ?? TONOS.normal;
  const base = [
    estilos.tarjeta,
    { backgroundColor: t.fondo, borderColor: t.borde },
    t.acento ? { borderLeftWidth: ANCHO_ACENTO, borderLeftColor: t.acento } : null,
  ];
  // Va después de `estilo`: el relleno izquierdo final es el de la pantalla menos el acento.
  const compensacion = t.acento ? rellenoConAcento(estilo) : null;

  const contenido = (
    <>
      {titulo || accion ? (
        <View style={estilos.cabecera}>
          {titulo ? (
            <Texto variante="titulo3" numberOfLines={lineasTitulo} estilo={estilos.flexible}>
              {titulo}
            </Texto>
          ) : (
            <View style={estilos.flexible} />
          )}
          {accion ? <View style={estilos.accion}>{accion}</View> : null}
        </View>
      ) : null}
      {children}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        role="button"
        onPress={conFoco(onPress)}
        aria-label={etiquetaAccesible}
        testID={testID}
        style={({ pressed, hovered }) => [
          ...base,
          { cursor: 'pointer' },
          hovered && estilos.resaltada,
          pressed && estilos.presionada,
          estilo,
          compensacion,
        ]}
      >
        {contenido}
      </Pressable>
    );
  }
  return (
    <View
      testID={testID}
      role={etiquetaAccesible ? 'group' : undefined}
      aria-label={etiquetaAccesible}
      style={[...base, estilo, compensacion]}
    >
      {contenido}
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    borderWidth: 1,
    borderRadius: radios.grande,
    padding: espacio.l,
    gap: espacio.m,
    alignSelf: 'stretch',
    ...sombras.tarjeta,
  },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m },
  accion: { flexShrink: 0 },
  flexible: { flex: 1, minWidth: 0 },
  resaltada: { borderColor: colores.accion },
  presionada: { opacity: 0.85 },
});
