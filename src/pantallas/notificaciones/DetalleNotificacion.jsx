// Detalle de una notificación (S7, N3): se abre con #/notificaciones/<id>, tocando una tarjeta o
// desde un enlace profundo. Muestra el texto completo, "Más información" (enlace externo) e
// "Ir al servicio" (destino interno). Marcarla como leída lo hace la pantalla al abrirla.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Boton, Dialogo, EtiquetaEstado, Texto } from '../../ui';
import { colores, espacio } from '../../tema/tokens';
import { fechaHora, tiempoPasado, unirNumeroYUnidad } from '../../../shared/formato.mjs';
import { esEnlaceValido } from '../../plataforma/enlaces';
import { accionDestino, estiloTipo, etiquetaTipo, etiquetaZona } from './presentacion';

export default function DetalleNotificacion({ notificacion: n, noEncontrada, ahora, errorLectura, onCerrar, onIrA, onPreferencias }) {
  if (noEncontrada) {
    return (
      <Dialogo
        visible
        titulo="No encontramos esa notificación"
        onCerrar={onCerrar}
        testID="detalle-notificacion"
        acciones={[{ titulo: 'Volver al historial', onPress: onCerrar, testID: 'detalle-volver' }]}
      >
        <Texto variante="cuerpo">
          Puede que sea muy vieja o que ya no esté disponible. Revisá el historial: ahí están todas las que tenés.
        </Texto>
      </Dialogo>
    );
  }
  if (!n) return null;

  const estilo = estiloTipo(n.tipo);
  const zona = etiquetaZona(n.zona);
  const destino = accionDestino(n.destino);
  const enlace = esEnlaceValido(n.enlace) && /^https:/i.test(n.enlace) ? n.enlace : null;
  const cuando = Number.isFinite(n.creadoEn) ? `${fechaHora(n.creadoEn)} · ${tiempoPasado(n.creadoEn, ahora)}` : 'Recién llegada';

  const acciones = [{ titulo: 'Volver al historial', onPress: onCerrar, variante: destino ? 'secundario' : 'primario', testID: 'detalle-volver' }];
  if (destino) {
    acciones.push({
      titulo: destino.titulo,
      onPress: () => (destino.preferencias ? onPreferencias() : onIrA(n.destino)),
      variante: 'primario',
      testID: 'detalle-ir-servicio',
    });
  }

  return (
    <Dialogo visible titulo={unirNumeroYUnidad(n.titulo)} onCerrar={onCerrar} acciones={acciones} testID="detalle-notificacion">
      <View style={estilos.etiquetas}>
        <EtiquetaEstado texto={etiquetaTipo(n.tipo)} tono={estilo.tono} icono={estilo.icono} />
        {zona ? <EtiquetaEstado texto={zona} tono="neutro" icono="ubicacion" /> : null}
        <EtiquetaEstado texto={n.fuente === 'personal' ? 'Para vos' : 'Aviso municipal'} tono="neutro" />
      </View>
      <Texto variante="chico" color={colores.textoSuave}>
        {cuando}
      </Texto>
      {n.cuerpo ? <Texto variante="cuerpo">{unirNumeroYUnidad(n.cuerpo)}</Texto> : null}
      {n.detalle ? (
        <View style={estilos.detalle}>
          <Texto variante="chico" peso="700" color={colores.textoSuave}>
            Más información
          </Texto>
          <Texto variante="cuerpo">{unirNumeroYUnidad(n.detalle)}</Texto>
        </View>
      ) : null}
      {enlace ? (
        <Boton
          titulo="Más información en el sitio"
          href={enlace}
          variante="secundario"
          ancho="completo"
          testID="detalle-mas-info"
        />
      ) : null}
      {errorLectura ? (
        <Texto role="alert" variante="chico" color={colores.peligro} peso="600" testID="detalle-error">
          No pudimos marcarla como leída: {errorLectura.message}
        </Texto>
      ) : null}
    </Dialogo>
  );
}

const estilos = StyleSheet.create({
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  detalle: {
    gap: espacio.xs,
    paddingTop: espacio.s,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
  },
});
