// Datos del cedulón ya formateados (S4). Los usan el diálogo "Ver cedulón" y la versión imprimible
// (imprimirCedulon de plataforma/cedulon), así lo que se ve y lo que se imprime es lo mismo.
import { codigoPagoTributo } from '../../../shared/dominio.mjs';
import { dinero, fecha, fechaHora } from '../../../shared/formato.mjs';
import { ESTADOS, cuandoVence } from './estado';
import { ZONA_SILENCIO_ITF, agruparCodigo, anchoITF, barrasITF } from './barrasITF';
import { etiquetaMedio } from '../pagos/pasarela';

export const TEXTO_PAGAR_EN_APP = 'Pagalo desde la app San Francisco Conecta.';
export const TEXTO_PAGADO_EN_APP = 'Pagado desde la app San Francisco Conecta.';

/**
 * @param tributo  tributo del almacén con `estado`
 * @param opciones { municipal: info de municipal/info, leyenda, ahora, pago: el pago del cedulón (para
 *                 mostrar la tarjeta enmascarada con la que se pagó), si está en el almacén }
 */
export function datosCedulon(tributo, { municipal = null, leyenda, ahora = Date.now(), pago = null } = {}) {
  const estado = ESTADOS[tributo.estado] ?? ESTADOS.pendiente;
  const pagado = tributo.estado === 'pagado';
  const codigo = codigoPagoTributo(tributo);
  const barras = barrasITF(codigo);
  const vencimiento = pagado
    ? fecha(tributo.vence)
    : `${fecha(tributo.vence)} (${cuandoVence(tributo.vence, ahora)})`;

  const filas = [
    ['Cedulón', tributo.id],
    ['Concepto', tributo.concepto],
    ['Período', tributo.periodo],
    ['Cuenta', tributo.cuenta],
    ['Vencimiento', vencimiento],
    ['Estado', estado.texto],
  ];
  if (pagado) {
    filas.push(['Pagado el', fechaHora(tributo.pagadoEn)]);
    if (tributo.comprobante) filas.push(['Comprobante', tributo.comprobante]);
    const medio = etiquetaMedio(tributo.medio, pago?.medio === tributo.medio ? pago.tarjeta : null);
    if (medio) filas.push(['Medio de pago', medio]);
  }

  const pie = [municipal?.direccion, municipal?.lineaVecino ? `Atención al vecino ${municipal.lineaVecino}` : null]
    .filter(Boolean)
    .join(' · ');

  return {
    titulo: `Cedulón ${tributo.id}`,
    subtitulo: [tributo.concepto, tributo.periodo].filter(Boolean).join(' · '),
    municipio: municipal?.nombre ?? 'Municipalidad de San Francisco',
    leyenda,
    estado: { texto: estado.texto, tono: estado.tono },
    filas,
    importe: dinero(tributo.importe),
    codigo,
    codigoAgrupado: agruparCodigo(codigo),
    barras,
    unidades: anchoITF(barras),
    silencio: ZONA_SILENCIO_ITF,
    aviso: pagado ? TEXTO_PAGADO_EN_APP : TEXTO_PAGAR_EN_APP,
    emitido: `Emitido el ${fechaHora(ahora)}`,
    pie,
  };
}
