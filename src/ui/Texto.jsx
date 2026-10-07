// Texto con la tipografía de la app (agregado por WP5 a src/ui para no repetir fontFamily).
// <Texto variante="titulo3" color={colores.textoSuave}>…</Texto>
import React, { forwardRef } from 'react';
import { Text } from 'react-native';
import { colores, tipografia } from '../tema/tokens';

const Texto = forwardRef(function Texto(
  { variante = 'cuerpo', color = colores.texto, peso, alineacion, estilo, children, ...resto },
  ref,
) {
  const base = tipografia[variante] ?? tipografia.cuerpo;
  return (
    <Text
      ref={ref}
      {...resto}
      style={[
        { fontFamily: tipografia.familia, color },
        base,
        peso ? { fontWeight: peso } : null,
        alineacion ? { textAlign: alineacion } : null,
        estilo,
      ]}
    >
      {children}
    </Text>
  );
});

export default Texto;
