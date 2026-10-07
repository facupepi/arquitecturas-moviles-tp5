// Campo de texto (WP5, 7.2). Etiqueta visible arriba (no solo placeholder, UIX-06).
// El error va DEBAJO del campo con role="alert"; el campo recibe aria-invalid y borde de peligro.
// `ayuda` se muestra debajo cuando no hay error.
// `ref` llega al TextInput (para llevar el foco al primer campo con error). `teclaEnter` es la
// etiqueta de la tecla Enter del teclado virtual ('next', 'done', 'go', 'search', 'send') y
// `onEnviar` lo que hace al tocarla.
import React, { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { colores, espacio, medidas, radios, tipografia } from '../tema/tokens';
import Icono from './Icono';
import Texto from './Texto';
import { unirIds } from './comun';

const Campo = forwardRef(function Campo({
  etiqueta,
  valor,
  onCambio,
  error,
  ayuda,
  placeholder,
  multilinea = false,
  modoTeclado = 'text',
  mayusculas = false,
  maxLargo,
  id,
  testID,
  teclaEnter,
  onEnviar,
}, ref) {
  const [enfocado, setEnfocado] = useState(false);
  const idEtiqueta = `${id}-etiqueta`;
  const idError = error ? `${id}-error` : null;
  const idAyuda = !error && ayuda ? `${id}-ayuda` : null;

  const cambiar = (texto) => onCambio?.(mayusculas ? texto.toUpperCase() : texto);

  return (
    <View style={estilos.contenedor}>
      <Texto id={idEtiqueta} variante="chico" peso="700" estilo={estilos.etiqueta}>
        {etiqueta}
      </Texto>
      <TextInput
        ref={ref}
        id={id}
        testID={testID}
        value={valor ?? ''}
        onChangeText={cambiar}
        placeholder={placeholder}
        placeholderTextColor={colores.textoSuave}
        multiline={multilinea}
        numberOfLines={multilinea ? 4 : undefined}
        inputMode={modoTeclado}
        autoCapitalize={mayusculas ? 'characters' : 'sentences'}
        autoCorrect={!mayusculas}
        maxLength={maxLargo}
        enterKeyHint={teclaEnter ?? (multilinea ? undefined : 'done')}
        onSubmitEditing={multilinea ? undefined : onEnviar}
        aria-labelledby={idEtiqueta}
        aria-describedby={unirIds(idError, idAyuda)}
        aria-invalid={error ? true : undefined}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        style={[
          estilos.entrada,
          multilinea && estilos.multilinea,
          enfocado && estilos.enfocado,
          error && estilos.conError,
        ]}
      />
      {error ? (
        <View style={estilos.fila}>
          <Icono nombre="alerta" tamano={16} color={colores.peligro} />
          <Texto id={idError} role="alert" variante="chico" color={colores.peligro} peso="600" estilo={estilos.flexible}>
            {error}
          </Texto>
        </View>
      ) : ayuda ? (
        <Texto id={idAyuda} variante="chico" color={colores.textoSuave}>
          {ayuda}
        </Texto>
      ) : null}
      {maxLargo && multilinea ? (
        <Texto variante="chico" color={colores.textoSuave} alineacion="right" aria-hidden>
          {`${(valor ?? '').length}/${maxLargo}`}
        </Texto>
      ) : null}
    </View>
  );
});

export default Campo;

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.xs, alignSelf: 'stretch' },
  etiqueta: { marginBottom: 2 },
  entrada: {
    fontFamily: tipografia.familia,
    fontSize: 16,
    lineHeight: 22,
    color: colores.texto,
    backgroundColor: colores.superficie,
    borderColor: colores.bordeCampo,
    borderWidth: 1,
    borderRadius: radios.chico,
    minHeight: medidas.toqueMinimo,
    paddingHorizontal: 13,
    paddingVertical: 10,
    width: '100%',
  },
  multilinea: { minHeight: 110, textAlignVertical: 'top' },
  enfocado: { borderColor: colores.foco },
  conError: { borderColor: colores.peligro, borderWidth: 2 },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.xs, paddingTop: 2 },
  flexible: { flex: 1 },
});
