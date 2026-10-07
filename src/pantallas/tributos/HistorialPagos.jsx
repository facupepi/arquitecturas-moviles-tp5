// Historial de pagos de tributos (T3, S4): los `pagos` de tipo tributo, del más nuevo al más viejo,
// con "Cargar más" (cargarMas('pagos') sube el límite de la escucha; siguen en tiempo real).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio } from '../../tema/tokens';
import { Boton, ErrorCarga, EtiquetaEstado, FilaDato, Tarjeta, Texto, Vacio } from '../../ui';
import { dinero, fechaHora, tiempoRelativo } from '../../../shared/formato.mjs';

export default function HistorialPagos({ pagos, tributosPorId, hayMas, error, ahora, onVerComprobante, onCargarMas, onReintentar }) {
  if (error && !pagos.length) return <ErrorCarga error={error} onReintentar={onReintentar} testID="error-pagos" />;
  if (!pagos.length) {
    return (
      <Vacio
        icono="tributo"
        titulo="Todavía no registraste pagos"
        mensaje="Cuando pagues un cedulón desde la app, el comprobante va a quedar acá."
        testID="pagos-vacio"
      />
    );
  }
  return (
    <View style={estilos.lista}>
      {error ? <ErrorCarga error={error} onReintentar={onReintentar} testID="error-pagos" /> : null}
      {pagos.map((pago) => {
        const tributo = tributosPorId.get(pago.refId);
        return (
          <Tarjeta
            key={pago.id}
            testID={`pago-${pago.id}`}
            titulo={tributo?.concepto ?? `Cedulón ${pago.refId}`}
            accion={<EtiquetaEstado texto="Pagado" tono="exito" icono="check" />}
          >
            <Texto variante="chico" color={colores.textoSuave}>
              {tributo ? `Período ${tributo.periodo} · ` : ''}Cedulón {pago.refId} · {tiempoRelativo(pago.creadoEn, Math.max(ahora, pago.creadoEn ?? 0))}
            </Texto>
            <View>
              <FilaDato etiqueta="Importe" valor={dinero(pago.importe)} />
              <FilaDato etiqueta="Fecha" valor={fechaHora(pago.creadoEn)} />
              <FilaDato etiqueta="Comprobante" valor={pago.comprobante} testID={`comprobante-${pago.id}`} />
            </View>
            <Boton
              titulo="Ver comprobante"
              variante="secundario"
              icono="tributo"
              onPress={() => onVerComprobante(pago)}
              etiquetaAccesible={`Ver comprobante ${pago.comprobante}`}
              testID={`ver-comprobante-${pago.id}`}
            />
          </Tarjeta>
        );
      })}
      {hayMas ? (
        <Boton titulo="Cargar más pagos" variante="texto" icono="mas" onPress={onCargarMas} testID="cargar-mas-pagos" />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espacio.m },
});
