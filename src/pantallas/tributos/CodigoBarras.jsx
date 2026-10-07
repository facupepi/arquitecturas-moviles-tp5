// Código de barras del cedulón dibujado con View (S4). Mide el ancho disponible y usa un ancho de
// módulo entero en píxeles, así las barras quedan nítidas en cualquier pantalla.
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio, radios } from '../../tema/tokens';
import { ZONA_SILENCIO_ITF, anchoITF, barrasITF } from './barrasITF';

export default function CodigoBarras({ codigo, alto = 56, testID }) {
  const barras = useMemo(() => barrasITF(codigo), [codigo]);
  const [ancho, setAncho] = useState(0);
  if (!barras.length) return null;
  const unidades = anchoITF(barras);
  const modulo = ancho ? Math.max(1, Math.floor((ancho - 2) / unidades)) : 0;

  return (
    <View
      testID={testID}
      role="img"
      aria-label="Código de barras del código de pago"
      onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
      style={[estilos.marco, { height: alto + espacio.m * 2 }]}
    >
      {modulo ? (
        <View style={[estilos.fila, { height: alto, paddingHorizontal: ZONA_SILENCIO_ITF * modulo }]}>
          {barras.map((b, i) => (
            <View
              key={i}
              style={{ width: b.ancho * modulo, height: alto, backgroundColor: b.barra ? colores.texto : 'transparent' }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  marco: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.blanco,
    borderRadius: radios.chico,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  fila: { flexDirection: 'row' },
});
