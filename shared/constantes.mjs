// Constantes del dominio compartidas por el navegador, Node (pruebas, siembra) y Deno (Supabase).
// Módulo puro: sin dependencias ni APIs de una plataforma. Las listas que también figuran en
// firestore.rules deben coincidir con estas (tests/unidad/catalogo.test.mjs lo controla).

// Congela un valor y todo lo que contiene, para que nadie modifique por error una constante compartida.
function congelar(valor) {
  if (valor && typeof valor === 'object' && !Object.isFrozen(valor)) {
    Object.freeze(valor);
    for (const v of Object.values(valor)) congelar(v);
  }
  return valor;
}

export const ZONAS = congelar(['centro', 'parque', 'norte', 'sur']);
export const CATEGORIAS_RECLAMO = congelar(['alumbrado', 'bacheo', 'limpieza', 'bicicletas', 'otros']);
export const ESTADOS_RECLAMO = congelar(['recibido', 'en_proceso', 'resuelto']);
export const TIPOS_AVISO = congelar(['obras', 'cortes', 'eventos', 'emergencias', 'servicios']); // los que publica el panel
export const TIPOS_PERSONALES = congelar(['tributos', 'estacionamiento', 'reclamos']);
export const TIPOS_NOTIFICACION = congelar([...TIPOS_AVISO, 'alarmas', ...TIPOS_PERSONALES]);
export const FRECUENCIAS = congelar(['inmediata', 'resumen_diario', 'solo_historial']);
export const TIPOS_ARCHIVO = congelar(['image/jpeg', 'image/png', 'application/pdf']);
export const EXTENSION_ARCHIVO = congelar({ 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' });

// Agregados a lo que pide el Anexo A (no lo contradicen): valores de campos enumerados de 2.1.
export const ESTADOS_ESTACION = congelar(['operativa', 'fuera_de_servicio']);
export const CATEGORIAS_CONTACTO = congelar(['municipal', 'emergencias', 'salud']);
export const PREFIJOS_COMPROBANTE = congelar(['REC', 'EST', 'EXT']);
// Medios que ofrece la pasarela de pagos (T2, E2, E4): las tarjetas de crédito y de débito que el
// vecino guarda en Mi cuenta. Deben coincidir con mediosPago() de firestore.rules.
export const MEDIOS_PAGO = congelar(['credito', 'debito']);
// Medios de pagos registrados antes de las tarjetas guardadas: solo se muestran, ya no se ofrecen.
export const MEDIOS_PAGO_ANTERIORES = congelar(['billetera', 'transferencia']);
// Tarjetas guardadas (usuarios/{uid}/tarjetas): de cada una se guarda el tipo (un medio de pago), la
// red, los últimos 4 dígitos, el titular y el vencimiento. Nunca el número completo ni el código de
// seguridad. La red se deduce del número y es solo un texto ("Tarjeta" si no se reconoce).
// Los ids son lugares fijos: así las reglas limitan la cantidad sin leer la colección.
// Deben coincidir con redesTarjeta() e idsTarjeta() de firestore.rules.
export const REDES_TARJETA = congelar(['Visa', 'Mastercard', 'American Express', 'Tarjeta']);
export const IDS_TARJETA = congelar(['tarjeta-1', 'tarjeta-2', 'tarjeta-3', 'tarjeta-4', 'tarjeta-5']);

export const LIMITES = congelar({
  adjuntos: 3, adjuntosPorVecino: 30, bytesAdjunto: 2 * 1024 * 1024, ladoImagen: 1600, largoNombreAdjunto: 100,
  bloqueMinutos: 15, minutosMax: 240, toleranciaFinMin: 2, radioAlarmaKm: 1,
  avisoEstacionamientoMinPorDefecto: 5, avisoEstacionamientoMinMax: 14, // el valor vigente está en municipal/config
  diasAvisoVencimiento: 3, cercaniaMin: 30, cercaniaMaxMin: 60, desfaseCordobaHoras: -3,
  tarjetas: 5, largoTarjetaMin: 13, largoTarjetaMax: 19, largoTitularMin: 2, largoTitularMax: 60,
});

export const COLECCIONES = congelar({
  municipal: 'municipal', estaciones: 'estaciones', alarmas: 'alarmas',
  zonas: 'zonasEstacionamiento', contactos: 'contactos', avisos: 'avisos', eventos: 'eventos',
  administradores: 'administradores', bloqueos: 'bloqueosPatente', usuarios: 'usuarios',
  tributos: 'tributos', pagos: 'pagos', reclamos: 'reclamos', estacionamiento: 'estacionamiento',
  notificaciones: 'notificaciones', avisosLeidos: 'avisosLeidos', dispositivos: 'dispositivos',
  tarjetas: 'tarjetas',
});

// Congelado: quien necesite modificarlas parte de una copia (datosInicialesVecino ya entrega una).
export const PREFERENCIAS_POR_DEFECTO = congelar({
  tipos: [...TIPOS_NOTIFICACION], zonas: ['centro', 'parque'], frecuencia: 'inmediata', push: false,
});

export const ETIQUETAS = congelar({
  zonas: { centro: 'Centro', parque: 'Parque', norte: 'Norte', sur: 'Sur', todas: 'Toda la ciudad' },
  categorias: {
    alumbrado: 'Alumbrado', bacheo: 'Bacheo', limpieza: 'Limpieza', bicicletas: 'Bicicletas', otros: 'Otros',
  },
  estadosReclamo: { recibido: 'Recibido', en_proceso: 'En proceso', resuelto: 'Resuelto' },
  tipos: {
    obras: 'Obras', cortes: 'Cortes de servicio', eventos: 'Eventos', emergencias: 'Emergencias',
    servicios: 'Servicios', alarmas: 'Alarmas', tributos: 'Tributos', estacionamiento: 'Estacionamiento',
    reclamos: 'Reclamos',
  },
  frecuencias: { inmediata: 'Inmediata', resumen_diario: 'Resumen diario', solo_historial: 'Solo historial' },
  estadosTributo: { pagado: 'Pagado', vencido: 'Vencido', por_vencer: 'Por vencer', pendiente: 'Pendiente' },
  estadosEstacion: { operativa: 'Operativa', fuera_de_servicio: 'Fuera de servicio' },
  categoriasContacto: { municipal: 'Municipal', emergencias: 'Emergencias', salud: 'Salud' },
  // billetera y transferencia: solo para mostrar pagos registrados antes de las tarjetas guardadas.
  mediosPago: {
    credito: 'Tarjeta de crédito', debito: 'Tarjeta de débito', billetera: 'Billetera virtual',
    transferencia: 'Transferencia bancaria',
  },
  // Tipo de tarjeta en corto ("Visa crédito •••• 4242").
  tiposTarjeta: { credito: 'crédito', debito: 'débito' },
});

export const ZONA_HORARIA = 'America/Argentina/Cordoba';
