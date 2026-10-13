// Historial de pagos de tributos (T3, S4): los `pagos` de tipo tributo, del más nuevo al más viejo,
// con el medio elegido en la pasarela (y la tarjeta enmascarada) y "Cargar más" (cargarMas('pagos') sube el límite de la escucha; siguen en tiempo real).
// En el escritorio van en grilla, con la misma estructura que las tarjetas de Pendientes.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio } from '../../tema/tokens';
import { Boton, ErrorCarga, EtiquetaEstado, FilaDato, Grilla, Tarjeta, Texto, Vacio } from '../../ui';
import { dinero, fechaHora, tiempoRelativo } from '../../../shared/formato.mjs';
import { etiquetaMedio } from '../pagos/pasarela';

export default function HistorialPagos({ pagos, tributosPorId, hayMas, error, ahora, onVerComprobante, onCargarMas, onReintentar }) {
  if (error && !pagos.length) return <ErrorCarga error={error} onReintentar={onReintentar} testID="error-pagos" />;
  // La escucha trae los pagos más nuevos de todo tipo: si ninguno es de un cedulón pero hay más,
  // no es cierto que no haya pagos; se ofrece seguir buscando en lugar del vacío.
  if (!pagos.length && hayMas) {
    return (
      <Vacio
        icono="tributo"
        titulo="Tus últimos pagos no son de cedulones"
        mensaje="Cargá pagos anteriores para ver los de tus tributos."
        accion={{ titulo: 'Cargar más pagos', onPress: onCargarMas, testID: 'cargar-mas-pagos' }}
        testID="pagos-sin-tributos"
      />
    );
  }
  if (!pagos.length) {
    return <Vacio icono="tributo" titulo="Todavía no registraste pagos" testID="pagos-vacio" />;
  }
  return (
    <View style={estilos.lista}>
      {error ? <ErrorCarga error={error} onReintentar={onReintentar} testID="error-pagos" /> : null}
      <Grilla minAncho={300} maxColumnas={3}>
        {pagos.map((pago) => {
          const tributo = tributosPorId.get(pago.refId);
          return (
            <Tarjeta key={pago.id} testID={`pago-${pago.id}`} estilo={estilos.tarjeta}>
              <View style={estilos.estado}>
                <EtiquetaEstado texto="Pagado" tono="exito" icono="check" />
              </View>
              <View style={estilos.encabezado}>
                <Texto variante="titulo3" numberOfLines={2}>
                  {tributo?.concepto ?? `Cedulón ${pago.refId}`}
                </Texto>
                <Texto variante="chico" color={colores.textoSuave}>
                  {tributo ? `Período ${tributo.periodo} · ` : ''}Cedulón {pago.refId} · {tiempoRelativo(pago.creadoEn, Math.max(ahora, pago.creadoEn ?? 0))}
                </Texto>
              </View>
              <View style={estilos.pie}>
                <View>
                  <FilaDato etiqueta="Importe" valor={dinero(pago.importe)} />
                  <FilaDato etiqueta="Fecha" valor={fechaHora(pago.creadoEn)} />
                  {etiquetaMedio(pago.medio) ? (
                    <FilaDato etiqueta="Medio de pago" valor={etiquetaMedio(pago.medio, pago.tarjeta)} testID={`medio-${pago.id}`} />
                  ) : null}
                  <FilaDato etiqueta="Comprobante" valor={pago.comprobante} testID={`comprobante-${pago.id}`} />
                </View>
                <Boton
                  titulo="Ver comprobante"
                  variante="secundario"
                  icono="tributo"
                  ancho="completo"
                  onPress={() => onVerComprobante(pago)}
                  etiquetaAccesible={`Ver comprobante ${pago.comprobante}`}
                  testID={`ver-comprobante-${pago.id}`}
                />
              </View>
            </Tarjeta>
          );
        })}
      </Grilla>
      {hayMas ? (
        <Boton titulo="Cargar más pagos" variante="texto" icono="mas" onPress={onCargarMas} testID="cargar-mas-pagos" />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espacio.m },
  tarjeta: { flexGrow: 1 },
  estado: { flexDirection: 'row' },
  encabezado: { gap: 2 },
  pie: { marginTop: 'auto', gap: espacio.m },
});
