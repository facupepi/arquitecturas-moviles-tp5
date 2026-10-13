// Estado "Procesando el pago…" de la pasarela (T2, E2, E4). Reemplaza el contenido del diálogo
// mientras se registra el pago (al menos DEMORA_PROCESO_MS). Es una región role="status" que
// recibe el foco al aparecer: el botón que se tocó desaparece y el lector anuncia el estado.
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colores, espacio, radios } from '../../tema/tokens';
import { Icono, Texto } from '../../ui';
import { dinero } from '../../../shared/formato.mjs';
import { etiquetaTarjeta, iconoMedio } from './pasarela';

// `tarjeta`: la tarjeta guardada con la que se paga ({ tipo, red, ultimos4 }).
export default function Procesando({ importe, tarjeta, testID = 'procesando-pago' }) {
  const ref = useRef(null);
  const etiqueta = etiquetaTarjeta(tarjeta);

  useEffect(() => {
    try { ref.current?.focus?.({ preventScroll: true }); } catch { /* en nativo no hay foco */ }
  }, []);

  return (
    <View
      ref={ref}
      role="status"
      aria-live="polite"
      tabIndex={-1}
      dataSet={{ focoTitulo: true }}
      testID={testID}
      style={estilos.caja}
    >
      <ActivityIndicator size="large" color={colores.accion} aria-hidden />
      <Texto variante="titulo3" alineacion="center">
        Procesando el pago…
      </Texto>
      {etiqueta ? (
        <View style={estilos.medio}>
          <Icono nombre={iconoMedio(tarjeta.tipo)} tamano={18} color={colores.accionOscuro} />
          <Texto variante="chico" peso="700" color={colores.accionOscuro} testID={`${testID}-medio`} estilo={estilos.textoMedio}>
            {importe != null ? `${dinero(importe)} con ${etiqueta.charAt(0).toLowerCase()}${etiqueta.slice(1)}` : etiqueta}
          </Texto>
        </View>
      ) : null}
      <Texto variante="chico" color={colores.textoSuave} alineacion="center">
        No cierres esta ventana. Tarda unos segundos.
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: {
    alignItems: 'center',
    gap: espacio.m,
    paddingVertical: espacio.xxl,
    paddingHorizontal: espacio.l,
    borderRadius: radios.medio,
    backgroundColor: colores.fondo,
  },
  medio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.xs,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.xs,
    borderRadius: radios.pildora,
    backgroundColor: colores.celesteClaro,
    maxWidth: '100%',
  },
  textoMedio: { flexShrink: 1 },
});
