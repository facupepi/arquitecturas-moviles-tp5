// Selector (WP5, 7.2).
//   variante "chips": Pressable con role="radio" (o "checkbox" si `multiple`) y aria-checked.
//   variante "lista": botón que abre un Dialogo con una FlatList de opciones.
// opciones: [{ valor, etiqueta, deshabilitada?, testID? }]. `valor` es un string, o un array si `multiple`.
// testID: el contenedor lo recibe tal cual y cada opción recibe `${testID}-${valor}`
// (por ejemplo testID="minutos" da "minutos-15"), salvo que la opción traiga su propio testID.
import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { colores, espacio, medidas, radios } from '../tema/tokens';
import Dialogo from './Dialogo';
import Icono from './Icono';
import Texto from './Texto';
import { alPresionarEspacio, conFoco, useIdAccesible } from './comun';

function estaElegida(valor, opcion, multiple) {
  return multiple ? Array.isArray(valor) && valor.includes(opcion.valor) : valor === opcion.valor;
}

function alternar(valor, opcion, multiple) {
  if (!multiple) return opcion.valor;
  const actual = Array.isArray(valor) ? valor : [];
  return actual.includes(opcion.valor) ? actual.filter((v) => v !== opcion.valor) : [...actual, opcion.valor];
}

function idOpcion(testID, opcion) {
  return opcion.testID ?? (testID ? `${testID}-${opcion.valor}` : undefined);
}

function Opcion({ opcion, elegida, multiple, onPress, testID, enLista = false }) {
  const deshabilitada = !!opcion.deshabilitada;
  return (
    <Pressable
      role={multiple ? 'checkbox' : 'radio'}
      aria-checked={elegida}
      aria-disabled={deshabilitada || undefined}
      disabled={deshabilitada}
      onPress={onPress}
      onKeyDown={alPresionarEspacio(() => !deshabilitada && onPress())}
      testID={testID}
      style={({ hovered }) => [
        enLista ? estilos.filaLista : estilos.chip,
        elegida && (enLista ? estilos.filaListaElegida : estilos.chipElegido),
        hovered && !elegida && !deshabilitada && estilos.resaltado,
        deshabilitada && estilos.deshabilitada,
      ]}
    >
      {elegida ? <Icono nombre="check" tamano={16} color={enLista ? colores.accion : colores.blanco} /> : null}
      <Texto
        variante={enLista ? 'cuerpo' : 'chico'}
        peso="700"
        color={elegida ? (enLista ? colores.accionOscuro : colores.blanco) : colores.texto}
        estilo={enLista ? estilos.flexible : null}
      >
        {opcion.etiqueta}
      </Texto>
    </Pressable>
  );
}

export default function Selector({
  etiqueta,
  valor,
  opciones = [],
  onCambio,
  multiple = false,
  variante = 'chips',
  error,
  testID,
}) {
  const idEtiqueta = useIdAccesible('selector');
  const idError = error ? `${idEtiqueta}-error` : undefined;
  const [abierto, setAbierto] = useState(false);
  const elegir = (opcion) => {
    if (opcion.deshabilitada) return;
    onCambio?.(alternar(valor, opcion, multiple));
    if (!multiple && variante === 'lista') setAbierto(false);
  };

  const resumen = multiple
    ? opciones.filter((o) => estaElegida(valor, o, true)).map((o) => o.etiqueta).join(', ')
    : opciones.find((o) => o.valor === valor)?.etiqueta;

  return (
    <View style={estilos.contenedor}>
      <Texto id={idEtiqueta} variante="chico" peso="700">
        {etiqueta}
      </Texto>
      {variante === 'lista' ? (
        <>
          <Pressable
            role="button"
            aria-haspopup="dialog"
            aria-label={`${etiqueta}: ${resumen || 'sin elegir'}`}
            aria-describedby={idError}
            aria-invalid={error ? true : undefined}
            onPress={conFoco(() => setAbierto(true))}
            testID={testID}
            style={({ hovered }) => [estilos.disparador, hovered && estilos.disparadorResaltado, error && estilos.conError]}
          >
            <Texto variante="cuerpo" color={resumen ? colores.texto : colores.textoSuave} estilo={estilos.flexible}>
              {resumen || 'Elegí una opción'}
            </Texto>
            <Icono nombre="chevronAbajo" tamano={20} color={colores.textoSuave} />
          </Pressable>
          <Dialogo
            visible={abierto}
            titulo={etiqueta}
            onCerrar={() => setAbierto(false)}
            acciones={multiple ? [{ titulo: 'Listo', onPress: () => setAbierto(false), testID: testID ? `${testID}-listo` : undefined }] : []}
          >
            <View role={multiple ? 'group' : 'radiogroup'} aria-labelledby={idEtiqueta}>
              {/* El desplazamiento lo da el Dialogo: la lista dibuja todas las opciones de una vez. */}
              <FlatList
                data={opciones}
                scrollEnabled={false}
                initialNumToRender={opciones.length}
                keyExtractor={(o) => String(o.valor)}
                ItemSeparatorComponent={() => <View style={estilos.separador} />}
                renderItem={({ item }) => (
                  <Opcion
                    opcion={item}
                    elegida={estaElegida(valor, item, multiple)}
                    multiple={multiple}
                    onPress={() => elegir(item)}
                    testID={idOpcion(testID, item)}
                    enLista
                  />
                )}
              />
            </View>
          </Dialogo>
        </>
      ) : (
        <View
          role={multiple ? 'group' : 'radiogroup'}
          aria-labelledby={idEtiqueta}
          aria-describedby={idError}
          testID={testID}
          style={estilos.chips}
        >
          {opciones.map((o) => (
            <Opcion
              key={String(o.valor)}
              opcion={o}
              elegida={estaElegida(valor, o, multiple)}
              multiple={multiple}
              onPress={() => elegir(o)}
              testID={idOpcion(testID, o)}
            />
          ))}
        </View>
      )}
      {error ? (
        <Texto id={idError} role="alert" variante="chico" color={colores.peligro} peso="600">
          {error}
        </Texto>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.s, alignSelf: 'stretch' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  chip: {
    minHeight: medidas.toqueMinimo,
    paddingHorizontal: espacio.l,
    borderRadius: radios.pildora,
    borderWidth: 1,
    borderColor: colores.bordeCampo,
    backgroundColor: colores.superficie,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  chipElegido: { backgroundColor: colores.accion, borderColor: colores.accion },
  resaltado: { borderColor: colores.accion, backgroundColor: colores.celesteClaro },
  deshabilitada: { opacity: 0.5, cursor: 'default' },
  disparador: {
    minHeight: medidas.toqueMinimo,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colores.bordeCampo,
    borderRadius: radios.chico,
    backgroundColor: colores.superficie,
    cursor: 'pointer',
  },
  disparadorResaltado: { borderColor: colores.accion },
  conError: { borderColor: colores.peligro, borderWidth: 2 },
  flexible: { flex: 1, minWidth: 0 },
  filaLista: {
    minHeight: medidas.toqueMinimo,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    paddingHorizontal: espacio.m,
    borderRadius: radios.chico,
    cursor: 'pointer',
  },
  filaListaElegida: { backgroundColor: colores.celesteClaro },
  separador: { height: 1, backgroundColor: colores.borde },
});
