// Comprobante de la pasarela (T2, T3, E2, E4): sello "Pago aprobado", número de operación y los
// datos del pago, con el medio elegido. Lo usan el comprobante de Tributos (recién pagado y desde el
// historial) y los diálogos de Estacionamiento. El estado se dice con texto, no solo con el verde.
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio, radios } from '../../tema/tokens';
import { FilaDato, Icono, Texto } from '../../ui';

/**
 * @param numero  número de operación (REC-…, EST-…, EXT-…)
 * @param filas   [{ etiqueta, valor, testID? }]
 * @param titulo  texto del sello ("Pago aprobado" por defecto)
 * @param enfocar true cuando reemplaza a "Procesando el pago…" en el mismo diálogo: el sello recibe
 *                el foco (si no, quedaría en el documento) y se anuncia como estado.
 */
export default function ComprobantePago({ numero, filas = [], titulo = 'Pago aprobado', bajada, enfocar = false, testID = 'comprobante-pago' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!enfocar) return;
    try { ref.current?.focus?.({ preventScroll: true }); } catch { /* en nativo no hay foco */ }
  }, [enfocar]);

  return (
    <View style={estilos.contenedor} testID={testID}>
      <View
        ref={ref}
        style={estilos.sello}
        role={enfocar ? 'status' : undefined}
        tabIndex={enfocar ? -1 : undefined}
        dataSet={enfocar ? { focoTitulo: true } : undefined}
      >
        <View style={estilos.circulo}>
          <Icono nombre="check" tamano={30} color={colores.blanco} />
        </View>
        <Texto variante="titulo3" color={colores.exito} alineacion="center" testID={`${testID}-estado`}>
          {titulo}
        </Texto>
        {bajada ? (
          <Texto variante="chico" color={colores.texto} alineacion="center">
            {bajada}
          </Texto>
        ) : null}
        <Texto variante="chico" color={colores.textoSuave}>
          Número de operación
        </Texto>
        <Texto variante="titulo2" selectable testID="numero-comprobante" alineacion="center">
          {numero}
        </Texto>
      </View>
      <View>
        {filas.filter((f) => f && f.valor != null).map((f) => (
          <FilaDato key={f.etiqueta} etiqueta={f.etiqueta} valor={f.valor} testID={f.testID} />
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.m },
  sello: {
    alignItems: 'center',
    gap: espacio.xs,
    paddingVertical: espacio.l,
    paddingHorizontal: espacio.m,
    borderRadius: radios.medio,
    backgroundColor: colores.exitoFondo,
  },
  circulo: {
    width: 52,
    height: 52,
    borderRadius: radios.pildora,
    backgroundColor: colores.exito,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espacio.xs,
  },
});
