// Stub nativo de <Icono> (WP5, 7.2): un Text vacío del tamaño pedido. La web usa Icono.web.jsx.
import React from 'react';
import { Text } from 'react-native';

export const NOMBRES_ICONOS = [];

export default function Icono({ tamano = 20, etiquetaAccesible }) {
  return (
    <Text
      style={{ width: tamano, height: tamano }}
      aria-label={etiquetaAccesible}
      aria-hidden={etiquetaAccesible ? undefined : true}
    />
  );
}
