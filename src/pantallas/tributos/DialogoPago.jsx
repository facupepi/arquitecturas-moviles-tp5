// Confirmación del pago simulado (T2, S4). Muestra el importe, la leyenda "Pago simulado, sin cargos
// reales" y el código de operación (del requestId) generado al abrir el diálogo, que se reutiliza en
// los reintentos: un reintento después de un corte no cobra dos veces (idempotencia, sección 0).
// Los errores del comando (ya-pagado, sin-conexion…) van en el pie del diálogo, arriba del botón.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio, radios } from '../../tema/tokens';
import { Aviso, Dialogo, FilaDato, Texto } from '../../ui';
import ContenidoDialogo from './ContenidoDialogo';
import { dinero, fecha } from '../../../shared/formato.mjs';
import { comprobante } from '../../../shared/dominio.mjs';
import { cuandoVence } from './estado';
import { MEDIO_DE_PAGO, TEXTO_SIN_CARGOS } from './datosCedulon';

export default function DialogoPago({ visible, tributo, requestId, ahora, ocupado, error, yaPagado, onConfirmar, onCerrar }) {
  if (!tributo) return <Dialogo visible={false} titulo="" onCerrar={onCerrar} />;
  const importe = dinero(tributo.importe);
  const errorMostrado = yaPagado
    ? { titulo: 'Este cedulón ya está pagado', mensaje: 'Se registró un pago desde otro dispositivo o pestaña. No hace falta pagarlo de nuevo.' }
    : error
      ? { titulo: 'No se pudo completar el pago', mensaje: error.message }
      : null;
  const reintentar = !yaPagado && error && (error.codigo === 'sin-conexion' || error.codigo === 'servidor');

  const acciones = yaPagado || error?.codigo === 'ya-pagado'
    ? [{ titulo: 'Cerrar', onPress: onCerrar, testID: 'cerrar-pago' }]
    : [
      { titulo: 'Cancelar', variante: 'secundario', onPress: onCerrar, deshabilitado: ocupado, testID: 'cancelar-pago' },
      {
        titulo: reintentar ? `Reintentar el pago de ${importe}` : `Pagar ${importe}`,
        onPress: onConfirmar,
        cargando: ocupado,
        testID: 'confirmar-pago',
      },
    ];

  return (
    <Dialogo
      visible={visible}
      titulo="Confirmá el pago"
      onCerrar={onCerrar}
      cerrable={!ocupado}
      acciones={acciones}
      pie={errorMostrado ? (
        <Aviso tono="peligro" rol="alert" titulo={errorMostrado.titulo} mensaje={errorMostrado.mensaje} testID="error-pago" />
      ) : null}
      testID="dialogo-pago"
    >
      <ContenidoDialogo etiqueta="Detalle del pago">
        <Texto variante="cuerpo">
          Vas a pagar el cedulón {tributo.id}. Revisá los datos antes de confirmar.
        </Texto>
        <View>
          <FilaDato etiqueta="Concepto" valor={tributo.concepto} />
          <FilaDato etiqueta="Período" valor={tributo.periodo} />
          <FilaDato etiqueta="Vencimiento" valor={`${fecha(tributo.vence)} (${cuandoVence(tributo.vence, ahora)})`} />
          <FilaDato etiqueta="Medio de pago" valor={MEDIO_DE_PAGO} />
        </View>
        <View style={estilos.importe}>
          <Texto variante="cuerpo" color={colores.textoSuave}>
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

        <Aviso
          tono="aviso"
          titulo={TEXTO_SIN_CARGOS}
          mensaje="No se debita dinero de ninguna cuenta."
          testID="aviso-sin-cargos"
        />

        {/* El mismo formato que Estacionamiento (EST-…): es el número que va a tener el comprobante.
            El requestId completo queda en data-operacion para las pruebas. */}
        <Texto variante="chico" color={colores.textoSuave} selectable testID="numero-operacion" dataSet={{ operacion: requestId }}>
          {`Código de operación: ${comprobante('REC', requestId)}`}
        </Texto>
      </ContenidoDialogo>
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
