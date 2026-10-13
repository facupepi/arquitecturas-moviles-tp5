// Pasarela de pago del cedulón (T2, S4). Paso 1: el detalle, el importe y la elección de una tarjeta
// guardada (MediosDePago); "Pagar $X" confirma. Sin tarjetas, "Agregar tarjeta" carga una en el mismo
// diálogo (AltaEnPago) y vuelve al pago. Paso 2: "Procesando el pago…" mientras se registra (el
// diálogo no se puede cerrar). Al aprobarse, Tributos abre el comprobante (DialogoComprobante).
// El código de operación (del requestId) se genera al abrir el diálogo y se reutiliza en los
// reintentos: un reintento después de un corte no cobra dos veces (idempotencia, sección 0).
// Los errores del comando (ya-pagado, sin-conexion…) van en el pie del diálogo, arriba del botón.
import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio, radios } from '../../tema/tokens';
import { Aviso, Dialogo, FilaDato, Texto } from '../../ui';
import ContenidoDialogo from './ContenidoDialogo';
import MediosDePago from '../pagos/MediosDePago';
import Procesando from '../pagos/Procesando';
import AltaEnPago, { dialogoAlta } from '../pagos/AltaEnPago';
import { dinero, fecha } from '../../../shared/formato.mjs';
import { comprobante } from '../../../shared/dominio.mjs';
import { cuandoVence } from './estado';

export default function DialogoPago({
  visible, tributo, requestId, ahora, ocupado, error, yaPagado, medio, onConfirmar, onCerrar,
}) {
  const refMedios = useRef(null);
  if (!tributo) return <Dialogo visible={false} titulo="" onCerrar={onCerrar} />;
  const importe = dinero(tributo.importe);
  const errorMostrado = yaPagado
    ? { titulo: 'Este cedulón ya está pagado', mensaje: 'Se registró un pago desde otro dispositivo o pestaña. No hace falta pagarlo de nuevo.' }
    : error && error.campo !== 'medio'
      ? { titulo: 'No se pudo completar el pago', mensaje: error.message }
      : null;
  const reintentar = !yaPagado && error && (error.codigo === 'sin-conexion' || error.codigo === 'servidor');

  const confirmar = () => {
    // Sin tarjeta elegida, el error queda junto a las opciones y el foco va a la primera.
    if (!onConfirmar()) setTimeout(() => refMedios.current?.focus?.(), 0);
  };
  const alta = medio.agregando && !ocupado ? dialogoAlta(medio) : null;

  let acciones;
  if (ocupado) {
    acciones = [];
  } else if (yaPagado || error?.codigo === 'ya-pagado') {
    acciones = [{ titulo: 'Cerrar', onPress: onCerrar, testID: 'cerrar-pago' }];
  } else {
    acciones = [
      { titulo: 'Cancelar', variante: 'secundario', onPress: onCerrar, testID: 'cancelar-pago' },
      {
        titulo: reintentar ? `Reintentar el pago de ${importe}` : `Pagar ${importe}`,
        onPress: confirmar,
        testID: 'confirmar-pago',
      },
    ];
  }

  return (
    <Dialogo
      visible={visible}
      titulo={alta?.titulo ?? 'Pagar cedulón'}
      onCerrar={onCerrar}
      cerrable={!ocupado && !alta?.ocupado}
      acciones={alta?.acciones ?? acciones}
      pie={alta ? alta.pie : errorMostrado && !ocupado ? (
        <Aviso tono="peligro" rol="alert" titulo={errorMostrado.titulo} mensaje={errorMostrado.mensaje} testID="error-pago" />
      ) : null}
      testID="dialogo-pago"
    >
      {ocupado ? (
        <Procesando importe={tributo.importe} tarjeta={medio.tarjeta} />
      ) : alta ? (
        <AltaEnPago medio={medio} />
      ) : (
        <ContenidoDialogo etiqueta="Detalle del pago">
          <View>
            <FilaDato etiqueta="Concepto" valor={tributo.concepto} />
            <FilaDato etiqueta="Período" valor={tributo.periodo} />
            <FilaDato etiqueta="Cedulón" valor={tributo.id} />
            <FilaDato etiqueta="Vencimiento" valor={`${fecha(tributo.vence)} (${cuandoVence(tributo.vence, ahora)})`} />
          </View>
          <View style={estilos.importe}>
            <Texto variante="chico" color={colores.textoSuave}>
              Total a pagar
            </Texto>
            <Texto variante="titulo1" testID="importe-pago">
              {importe}
            </Texto>
          </View>

          {tributo.estado === 'vencido' ? (
            <Aviso
              tono="alerta"
              mensaje="Este cedulón está vencido. No se aplican recargos por mora."
              testID="aviso-vencido-pago"
            />
          ) : null}

          <MediosDePago ref={refMedios} medio={medio} />

          {/* El mismo formato que Estacionamiento (EST-…): es el número que va a tener el comprobante.
              El requestId completo queda en data-operacion para las pruebas. */}
          <Texto variante="chico" color={colores.textoSuave} selectable testID="numero-operacion" dataSet={{ operacion: requestId }}>
            {`Número de operación: ${comprobante('REC', requestId)}`}
          </Texto>
        </ContenidoDialogo>
      )}
    </Dialogo>
  );
}

const estilos = StyleSheet.create({
  importe: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: espacio.m,
    borderRadius: radios.medio,
    backgroundColor: colores.celesteClaro,
  },
});
