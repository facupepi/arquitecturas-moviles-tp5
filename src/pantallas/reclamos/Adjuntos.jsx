// Adjuntos del formulario (R2): hasta 3 fotos o PDF, con miniatura o nombre y botón para quitar.
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Boton, Icono, Texto } from '../../ui';
import { colores, espacio, radios } from '../../tema/tokens';
import { LIMITES } from '../../../shared/constantes.mjs';
import { esImagen, tamanoLegible } from './util';

const ID_ETIQUETA = 'adjuntos-reclamo-etiqueta';
const ID_ERROR = 'adjuntos-reclamo-error';

function Miniatura({ archivo }) {
  if (esImagen(archivo.tipo) && archivo.vistaPrevia) {
    return (
      <Image
        source={{ uri: archivo.vistaPrevia }}
        style={estilos.miniatura}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
        aria-hidden
      />
    );
  }
  return (
    <View style={[estilos.miniatura, estilos.miniaturaPdf]} aria-hidden>
      <Icono nombre={esImagen(archivo.tipo) ? 'adjunto' : 'tributo'} tamano={24} color={colores.accionOscuro} />
      <Texto variante="chico" peso="700" color={colores.accionOscuro} estilo={estilos.textoPdf}>
        {esImagen(archivo.tipo) ? 'FOTO' : 'PDF'}
      </Texto>
    </View>
  );
}

export default function Adjuntos({ archivos, onAgregar, onQuitar, preparando, deshabilitado, error, aviso }) {
  const lleno = archivos.length >= LIMITES.adjuntos;
  return (
    <View style={estilos.contenedor} role="group" aria-labelledby={ID_ETIQUETA} aria-describedby={error ? ID_ERROR : undefined}>
      <View style={estilos.cabecera}>
        <Texto id={ID_ETIQUETA} variante="chico" peso="700">
          Fotos o documentos (opcional)
        </Texto>
        <Texto variante="chico" color={colores.textoSuave}>
          {`${archivos.length} de ${LIMITES.adjuntos}`}
        </Texto>
      </View>
      <Texto variante="chico" color={colores.textoSuave}>
        Fotos JPG o PNG, o un PDF de hasta 2 MB.
      </Texto>

      {archivos.length ? (
        <View role="list" style={estilos.lista} testID="lista-adjuntos">
          {archivos.map((a, i) => (
            <View key={a.id} role="listitem" style={estilos.fila} testID={`adjunto-${i}`}>
              <Miniatura archivo={a} />
              <View style={estilos.datos}>
                <Texto variante="chico" peso="700" numberOfLines={1} estilo={estilos.nombre}>
                  {a.nombre}
                </Texto>
                <Texto variante="chico" color={colores.textoSuave}>
                  {`${esImagen(a.tipo) ? 'Foto' : 'PDF'} · ${tamanoLegible(a.tamano)}`}
                </Texto>
              </View>
              <Boton
                titulo="Quitar"
                variante="texto"
                onPress={() => onQuitar(a.id)}
                deshabilitado={deshabilitado}
                etiquetaAccesible={`Quitar ${a.nombre}`}
                testID={`quitar-adjunto-${i}`}
              />
            </View>
          ))}
        </View>
      ) : null}

      {!lleno ? (
        <Boton
          titulo={archivos.length ? 'Agregar otro archivo' : 'Adjuntar foto o PDF'}
          icono="adjunto"
          variante="secundario"
          onPress={onAgregar}
          cargando={preparando}
          deshabilitado={deshabilitado}
          ancho="completo"
          testID="adjuntar"
        />
      ) : (
        <Texto variante="chico" color={colores.textoSuave}>
          Ya adjuntaste el máximo de 3 archivos. Quitá uno si querés cambiarlo.
        </Texto>
      )}

      {preparando ? (
        <Texto role="status" variante="chico" color={colores.textoSuave}>
          Preparando el archivo…
        </Texto>
      ) : null}
      {aviso ? (
        <Texto variante="chico" color={colores.alerta} peso="600">
          {aviso}
        </Texto>
      ) : null}
      {error ? (
        <View style={estilos.filaError}>
          <Icono nombre="alerta" tamano={16} color={colores.peligro} />
          <Texto id={ID_ERROR} role="alert" variante="chico" color={colores.peligro} peso="600" estilo={estilos.flexible} testID="error-adjuntos">
            {error}
          </Texto>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.s, alignSelf: 'stretch' },
  cabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: espacio.s },
  lista: { gap: espacio.s },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    padding: espacio.s,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radios.medio,
    backgroundColor: colores.superficie,
  },
  miniatura: { width: 56, height: 56, borderRadius: radios.chico, backgroundColor: colores.fondo },
  miniaturaPdf: { alignItems: 'center', justifyContent: 'center', backgroundColor: colores.celesteClaro, gap: 0 },
  textoPdf: { fontSize: 11, lineHeight: 14 },
  datos: { flex: 1, minWidth: 0, gap: 2 },
  nombre: { flexShrink: 1 },
  filaError: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.xs },
  flexible: { flex: 1 },
});
