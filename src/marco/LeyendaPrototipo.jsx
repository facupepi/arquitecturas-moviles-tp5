// Leyenda de prototipo (WP5, 7.4). SIEMPRE visible debajo del encabezado, en todas las pantallas
// y también en Ingreso. Texto de Remote Config (leyenda_prototipo) con su respaldo: si llega vacío
// o con menos de 20 caracteres se usa el valor por defecto, así la leyenda no se puede quitar.
//
// Se dibuja una sola vez por pantalla: el marco y App.jsx (en Ingreso) la ponen arriba y envuelven
// el contenido en <ContextoLeyenda.Provider value>, así una pantalla que también la incluya no la
// duplica (ni duplica el testID "leyenda-prototipo").
import React, { createContext, useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { useConfigRemota } from '../firebase/configRemota';
import { colores, espacio, tipografia } from '../tema/tokens';
import Icono from '../ui/Icono';
import Texto from '../ui/Texto';

export const LEYENDA_POR_DEFECTO =
  'Prototipo académico UTN FRSF, sin vínculo oficial con la Municipalidad de San Francisco';

export const ContextoLeyenda = createContext(false);

/** Texto vigente de la leyenda (con respaldo). */
export function useTextoLeyenda() {
  let texto = null;
  try {
    texto = useConfigRemota()?.leyendaPrototipo;
  } catch {
    texto = null;
  }
  return typeof texto === 'string' && texto.trim().length >= 20 ? texto.trim() : LEYENDA_POR_DEFECTO;
}

export default function LeyendaPrototipo() {
  const yaVisible = useContext(ContextoLeyenda);
  const texto = useTextoLeyenda();
  if (yaVisible) return null;
  return (
    <View testID="leyenda-prototipo" role="note" style={estilos.leyenda}>
      <Icono nombre="info" tamano={16} color={colores.aviso} />
      <Texto variante="chico" color={colores.aviso} estilo={estilos.texto}>
        {texto}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  leyenda: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.s,
    paddingHorizontal: espacio.l,
    paddingVertical: 6,
    backgroundColor: colores.avisoFondo,
    borderBottomWidth: 1,
    borderBottomColor: '#f1e2a0',
  },
  texto: {
    fontFamily: tipografia.familia,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
});
