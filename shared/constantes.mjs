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

export const LIMITES = congelar({
  adjuntos: 3, bytesAdjunto: 2 * 1024 * 1024, ladoImagen: 1600, largoNombreAdjunto: 100,
  bloqueMinutos: 15, minutosMax: 240, toleranciaFinMin: 2, radioAlarmaKm: 1,
  avisoEstacionamientoMinPorDefecto: 5, avisoEstacionamientoMinMax: 14, // el valor vigente está en municipal/config
  diasAvisoVencimiento: 3, cercaniaMin: 30, cercaniaMaxMin: 60, desfaseCordobaHoras: -3,
});

export const COLECCIONES = congelar({
  municipal: 'municipal', estaciones: 'estaciones', alarmas: 'alarmas',
  zonas: 'zonasEstacionamiento', contactos: 'contactos', avisos: 'avisos', eventos: 'eventos',
  administradores: 'administradores', bloqueos: 'bloqueosPatente', usuarios: 'usuarios',
  tributos: 'tributos', pagos: 'pagos', reclamos: 'reclamos', estacionamiento: 'estacionamiento',
  notificaciones: 'notificaciones', avisosLeidos: 'avisosLeidos', dispositivos: 'dispositivos',
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
});

export const ZONA_HORARIA = 'America/Argentina/Cordoba';
