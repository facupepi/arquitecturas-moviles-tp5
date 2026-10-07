// Error al cargar una sección (WP5, 7.2). Recibe un ErrorApp (src/datos/errores.js, 4.2):
// usa error.codigo y error.message. "Reintentar" solo si el código es sin-conexion o servidor
// (UIX-05): con los demás, reintentar no cambia nada.
import React from 'react';
import Aviso from './Aviso';

export const CODIGOS_REINTENTABLES = ['sin-conexion', 'servidor'];

export default function ErrorCarga({ error, onReintentar, testID = 'error-carga' }) {
  if (!error) return null;
  const reintentable = CODIGOS_REINTENTABLES.includes(error.codigo) && typeof onReintentar === 'function';
  return (
    <Aviso
      tono="peligro"
      rol="alert"
      titulo="No pudimos cargar esta información"
      mensaje={error.message || 'No se pudo completar la operación.'}
      accion={reintentable ? { titulo: 'Reintentar', onPress: onReintentar, testID: `${testID}-reintentar` } : undefined}
      testID={testID}
    />
  );
}
