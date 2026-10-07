// Datos del cedulón ya formateados (S4). Los usan el diálogo "Ver cedulón" y la versión imprimible
// (imprimirCedulon de plataforma/cedulon), así lo que se ve y lo que se imprime es lo mismo.
import { codigoPagoTributo } from '../../../shared/dominio.mjs';
import { dinero, fecha, fechaHora } from '../../../shared/formato.mjs';
import { ESTADOS, cuandoVence } from './estado';
import { ZONA_SILENCIO_ITF, agruparCodigo, anchoITF, barrasITF } from './barrasITF';

export const TEXTO_SIN_CARGOS = 'Pago simulado, sin cargos reales.';
export const MEDIO_DE_PAGO = 'Pasarela simulada';

/**
 * @param tributo  tributo del almacén con `estado`
 * @param opciones { municipal: info de municipal/info, leyenda, ahora }
 */
export function datosCedulon(tributo, { municipal = null, leyenda, ahora = Date.now() } = {}) {
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
    filas.push(['Medio de pago', MEDIO_DE_PAGO]);
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
    aviso: pagado
      ? `${TEXTO_SIN_CARGOS} Este comprobante no tiene validez fiscal.`
      : `${TEXTO_SIN_CARGOS} Pagalo desde la app: este cedulón no sirve para pagar en bancos ni comercios.`,
    emitido: `Emitido el ${fechaHora(ahora)}`,
    pie,
  };
}
