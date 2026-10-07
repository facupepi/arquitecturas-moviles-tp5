// Una notificación del historial (S7). Toda la tarjeta es un botón que abre el detalle, así que
// no lleva botones adentro. La no leída se distingue por el fondo, un punto y el texto "Nueva"
// (nunca solo por color).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icono, Tarjeta, Texto } from '../../ui';
import { colores, espacio, radios } from '../../tema/tokens';
import { tiempoPasado } from '../../../shared/formato.mjs';
import { estiloTipo, etiquetaTipo, etiquetaZona } from './presentacion';

export default function TarjetaNotificacion({ notificacion: n, ahora, onAbrir }) {
  const estilo = estiloTipo(n.tipo);
  const zona = etiquetaZona(n.zona);
  const cuando = Number.isFinite(n.creadoEn) ? tiempoPasado(n.creadoEn, ahora) : 'recién';
  const meta = [etiquetaTipo(n.tipo), zona, cuando].filter(Boolean).join(' · ');
  const etiqueta = `${n.leida ? '' : 'Nueva. '}${n.titulo}. ${meta}. ${n.leida ? 'Leída' : 'Sin leer'}.`;

  return (
    <Tarjeta
      onPress={() => onAbrir(n)}
      etiquetaAccesible={etiqueta}
      tono={n.leida ? 'normal' : 'destacada'}
      testID={`notificacion-${n.id}`}
      estilo={estilos.tarjeta}
    >
      <View style={estilos.fila}>
        <View style={[estilos.icono, { backgroundColor: n.leida ? estilo.fondo : colores.superficie }]}>
          <Icono nombre={estilo.icono} tamano={20} color={estilo.tinta} />
          {!n.leida ? <View aria-hidden style={estilos.punto} testID={`no-leida-${n.id}`} /> : null}
        </View>
        <View style={estilos.textos}>
          <Texto variante="cuerpo" peso="700" numberOfLines={2}>
            {n.titulo}
          </Texto>
          {n.cuerpo ? (
            <Texto variante="chico" color={colores.textoSuave} numberOfLines={2}>
              {n.cuerpo}
            </Texto>
          ) : null}
          <View style={estilos.meta}>
            {!n.leida ? (
              <View style={estilos.nueva}>
                <Texto variante="chico" peso="700" color={colores.blanco} estilo={estilos.textoNueva}>
                  Nueva
                </Texto>
              </View>
            ) : null}
            <Texto variante="chico" color={colores.textoSuave} estilo={estilos.meta2}>
              {meta}
            </Texto>
          </View>
        </View>
        <Icono nombre="chevron" tamano={20} color={colores.textoSuave} />
      </View>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { paddingVertical: espacio.m, paddingHorizontal: espacio.m },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  icono: {
    width: 40,
    height: 40,
    borderRadius: radios.pildora,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  textos: { flex: 1, minWidth: 0, gap: 2 },
  punto: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: radios.pildora,
    borderWidth: 2,
    borderColor: colores.superficie,
    backgroundColor: colores.peligroAcento,
  },
  meta2: { flexShrink: 1, minWidth: 0 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espacio.s, rowGap: 2, marginTop: 2 },
  nueva: {
    backgroundColor: colores.accion,
    borderRadius: radios.pildora,
    paddingHorizontal: espacio.s,
    paddingVertical: 1,
    flexShrink: 0,
  },
  textoNueva: { fontSize: 12, lineHeight: 16 },
});
