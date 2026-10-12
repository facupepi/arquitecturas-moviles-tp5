// Catálogo municipal y datos iniciales de cada vecino (de heredado:functions/lib/seed.mjs, sección 2.4).
// Lo usan scripts/sembrar.mjs, el edge simulado de las e2e, vecino/alta de Supabase y restablecerDemo.
//
// Forma: cada colección es un array de objetos con `id`, que es el id del documento (no un campo que
// haya que guardar). Las fechas son ms; quien escribe en Firestore las convierte a Timestamp.
// Cada llamada devuelve objetos nuevos: modificarlos no afecta a la siguiente.
//
// Coordenadas: las heredadas y las de la zona Sur y del tramo de p3 se contrastaron con OpenStreetMap
// el 2026-10-07 (VERIFICAR 10): b7/a5 = plaza del barrio Bouchard (way 300728721, sobre calle Rioja);
// tramo de p3 = nodos de la calle Paraguay sobre el lado norte de la Plaza General Paz (way 294861652).

import { PREFERENCIAS_POR_DEFECTO } from './constantes.mjs';

const MS_HORA = 60 * 60 * 1000;
const MS_DIA = 24 * MS_HORA;

const LUGARES = {
  plaza: { lat: -31.4351133, lng: -62.0862566 },
  municipalidad: { lat: -31.4319946, lng: -62.0797907 },
  parque: { lat: -31.4254107, lng: -62.0684119 },
  terminal: { lat: -31.4297491, lng: -62.0916357 },
  utn: { lat: -31.4204884, lng: -62.1110106 },
  hospital: { lat: -31.4279816, lng: -62.0679246 },
  bouchard: { lat: -31.4414958, lng: -62.0904377 },
};

const WHATSAPP_TANA = '5493564336062';
const CONMUTADOR = '+543564439111';
const SITIO = 'https://www.sanfrancisco.gov.ar';
const PORTAL_TRIBUTARIO = 'https://drt.sanfrancisco.gov.ar';
const DIRECCION_MUNICIPALIDAD = 'Bv. 9 de Julio 1187';
const AVISO_DEMO = 'Aviso de demostración: lo publica el prototipo San Francisco Conecta y no es un comunicado oficial de la Municipalidad.';

export function catalogo(ahora = Date.now()) {
  const info = {
    nombre: 'Municipalidad de San Francisco',
    direccion: 'Bv. 9 de Julio 1187, San Francisco, Córdoba',
    telefono: '+54 3564 439111',
    lineaVecino: '147',
    whatsapp: WHATSAPP_TANA,
    sitio: SITIO,
    portalTributario: PORTAL_TRIBUTARIO,
    centroMapa: { lat: -31.429, lng: -62.082 },
  };

  const config = {
    simuladorActivo: false,
    simuladorCadaMin: 2,
    horarioEstricto: true,
    avisoEstacionamientoMin: 5,
    ultimaSimulacion: null,
    actualizadoEn: ahora,
  };

  const estacion = (id, nombre, referencia, zona, lugar, bicicletas, capacidad) => ({
    id, nombre, referencia, zona, ...LUGARES[lugar], bicicletas, capacidad, estado: 'operativa', actualizadoEn: ahora,
  });
  const estaciones = [
    estacion('b1', 'Estación Plaza General Paz', 'Plaza General Paz', 'centro', 'plaza', 8, 14),
    estacion('b2', 'Estación Municipalidad', 'Municipalidad de San Francisco', 'centro', 'municipalidad', 3, 12),
    estacion('b3', 'Estación Parque Cincuentenario', 'Parque Cincuentenario', 'parque', 'parque', 6, 10),
    estacion('b4', 'Estación Terminal', 'Terminal de Ómnibus', 'centro', 'terminal', 2, 10),
    estacion('b5', 'Estación UTN', 'UTN Facultad Regional San Francisco', 'norte', 'utn', 5, 10),
    estacion('b6', 'Estación Hospital Iturraspe', 'Hospital Regional J. B. Iturraspe', 'parque', 'hospital', 0, 8),
    estacion('b7', 'Estación Plaza Bouchard', 'Plaza del barrio Bouchard, calle Rioja', 'sur', 'bouchard', 4, 10),
  ];

  const alarma = (id, nombre, referencia, zona, lugar) => ({
    id, nombre, referencia, zona, ...LUGARES[lugar],
    activa: false, activadaEn: null, activacionId: null, actualizadoEn: ahora,
  });
  const alarmas = [
    alarma('a1', 'Alarma Municipalidad', 'Municipalidad de San Francisco', 'centro', 'municipalidad'),
    alarma('a2', 'Alarma Parque Cincuentenario', 'Parque Cincuentenario', 'parque', 'parque'),
    alarma('a3', 'Alarma Plaza General Paz', 'Plaza General Paz', 'centro', 'plaza'),
    alarma('a4', 'Alarma UTN', 'UTN Facultad Regional San Francisco', 'norte', 'utn'),
    alarma('a5', 'Alarma barrio Bouchard', 'Plaza del barrio Bouchard, calle Rioja', 'sur', 'bouchard'),
  ];

  const zonasEstacionamiento = [
    {
      id: 'p1', nombre: 'Municipalidad, Bv. 9 de Julio', referencia: 'Municipalidad de San Francisco',
      direccion: DIRECCION_MUNICIPALIDAD, zona: 'centro', ...LUGARES.municipalidad,
      tramo: [{ lat: -31.43185, lng: -62.08065 }, { lat: -31.43214, lng: -62.0789 }],
      tarifaHora: 800, horario: { dias: [1, 2, 3, 4, 5], desde: 8, hasta: 20 },
      horarioTexto: 'Lunes a viernes, 8 a 20 h',
    },
    {
      id: 'p2', nombre: 'Terminal, Bv. 9 de Julio', referencia: 'Terminal de Ómnibus',
      direccion: 'Bv. 9 de Julio', zona: 'centro', ...LUGARES.terminal,
      tramo: [{ lat: -31.42961, lng: -62.09245 }, { lat: -31.4299, lng: -62.09085 }],
      tarifaHora: 500, horario: { dias: [1, 2, 3, 4, 5], desde: 8, hasta: 18 },
      horarioTexto: 'Lunes a viernes, 8 a 18 h',
    },
    {
      id: 'p3', nombre: 'Plaza General Paz', referencia: 'Calle Paraguay, frente a la plaza',
      direccion: 'Paraguay, entre Rivadavia y Avellaneda', zona: 'centro', lat: -31.4346631, lng: -62.0861604,
      tramo: [
        { lat: -31.4346025, lng: -62.0865923 },
        { lat: -31.4346631, lng: -62.0861604 },
        { lat: -31.4347457, lng: -62.0856697 },
      ],
      tarifaHora: 600, horario: { dias: [1, 2, 3, 4, 5, 6], desde: 8, hasta: 13 },
      horarioTexto: 'Lunes a sábado, 8 a 13 h',
    },
  ];

  const contacto = (id, orden, categoria, area, nombre, descripcion, horario, direccion, medios) => ({
    id, area, nombre, descripcion, horario, direccion, categoria,
    telefono: medios.telefono ?? null, correo: medios.correo ?? null,
    whatsapp: medios.whatsapp ?? null, sitio: medios.sitio ?? null, orden,
  });
  const CIUDAD = 'San Francisco, Córdoba';
  const contactos = [
    contacto('c01', 1, 'municipal', 'Atención ciudadana', 'Línea 147',
      'Consultas, solicitudes y orientación municipal.', 'Línea municipal de atención al vecino',
      DIRECCION_MUNICIPALIDAD, { telefono: '147', whatsapp: WHATSAPP_TANA }),
    contacto('c02', 2, 'municipal', 'Tributos', 'Dirección General Tributaria',
      'Tasas, cedulones y obligaciones municipales.', 'Consultas en el portal tributario municipal',
      DIRECCION_MUNICIPALIDAD, { telefono: CONMUTADOR, sitio: PORTAL_TRIBUTARIO }),
    contacto('c03', 3, 'municipal', 'Reclamos', 'Centro de reclamos',
      'Alumbrado, bacheo, limpieza y espacios públicos.', 'Por la línea 147 o por WhatsApp',
      DIRECCION_MUNICIPALIDAD, { telefono: '147', whatsapp: WHATSAPP_TANA }),
    contacto('c04', 4, 'municipal', 'Municipalidad', 'Conmutador municipal',
      'Comunicación con todas las áreas del Palacio Municipal.', 'Horario de atención municipal',
      DIRECCION_MUNICIPALIDAD, { telefono: CONMUTADOR, sitio: SITIO }),
    contacto('c05', 5, 'municipal', 'Comunicación', 'Prensa municipal',
      'Información y comunicación institucional.', 'Contacto por correo electrónico',
      DIRECCION_MUNICIPALIDAD, { correo: 'prensa@sanfrancisco.gov.ar' }),
    contacto('c06', 6, 'salud', 'Salud', 'Hospital Regional J. B. Iturraspe',
      'Hospital regional de referencia.', 'Guardia y atención hospitalaria',
      'Dominga Cullen 450', { telefono: '+543564443718' }),
    contacto('c07', 7, 'emergencias', 'Emergencias', 'Emergencias médicas',
      'Ambulancias y emergencias médicas.', 'Atención permanente', CIUDAD, { telefono: '107' }),
    contacto('c08', 8, 'emergencias', 'Emergencias', 'Policía',
      'Emergencias policiales.', 'Atención permanente', CIUDAD, { telefono: '101' }),
    contacto('c09', 9, 'emergencias', 'Emergencias', 'Bomberos',
      'Incendios y rescates.', 'Atención permanente', CIUDAD, { telefono: '100' }),
    contacto('c10', 10, 'emergencias', 'Emergencias', 'Defensa Civil',
      'Temporales, inundaciones y situaciones de riesgo.', 'Atención permanente', CIUDAD, { telefono: '103' }),
  ];

  const aviso = (id, horasAtras, tipo, zona, titulo, cuerpo, destino = null, enlace = null) => ({
    id, titulo, cuerpo, detalle: AVISO_DEMO, tipo, zona, destino, enlace,
    creadoEn: ahora - horasAtras * MS_HORA, autor: 'municipalidad', eventoId: `ev-semilla-${id}`,
    vigenteHasta: null,
  });
  const avisos = [
    aviso('av-obras-centro', 2, 'obras', 'centro', 'Mejoras en el espacio público',
      'Tareas de mantenimiento en espacios verdes de la zona Centro.'),
    aviso('av-corte-sur', 5, 'cortes', 'sur', 'Corte de agua programado en la zona Sur',
      'Corte programado del servicio de agua por trabajos en la red. Reservá agua para el día.'),
    aviso('av-evento-parque', 24, 'eventos', 'parque', 'Feria de fin de semana en el Parque',
      'Actividades recreativas y puestos de emprendedores en el Parque Cincuentenario.', '#/bicicletas/b3'),
    aviso('av-servicios-todas', 48, 'servicios', 'todas', 'Nuevo canal de reclamos en línea',
      'Ya podés cargar reclamos con fotos y seguir su estado desde la app.', '#/reclamos', SITIO),
  ];

  return { info, config, estaciones, alarmas, zonasEstacionamiento, contactos, avisos };
}

export function datosInicialesVecino(ahora = Date.now()) {
  const tributo = (id, concepto, periodo, importe, venceDias, pago = null) => ({
    id, concepto, periodo, cuenta: 'Cuenta municipal', importe, vence: ahora + venceDias * MS_DIA,
    pagadoEn: pago ? ahora + pago.dias * MS_DIA : null,
    comprobante: pago ? pago.comprobante : null,
    pagoId: pago ? pago.pagoId : null,
  });
  const tributos = [
    tributo('T-1001', 'Tasa de servicios municipales', '10/2026', 18500, 2),
    tributo('T-1002', 'Contribución sobre inmuebles', '10/2026', 24750, 8),
    tributo('T-0999', 'Tasa de servicios municipales', '08/2026', 18500, -40),
    tributo('T-1000', 'Tasa de servicios municipales', '09/2026', 18500, -20,
      { dias: -22, comprobante: 'REC-00001000', pagoId: 'semilla-T-1000' }),
  ];

  const pagos = [{
    id: 'semilla-T-1000', tipo: 'tributo', refId: 'T-1000', importe: 18500, comprobante: 'REC-00001000',
    proveedor: 'pasarela-simulada', creadoEn: ahora - 22 * MS_DIA,
  }];

  const reclamos = [{
    id: 'semilla-reclamo-1', codigo: 'R-000001', categoria: 'alumbrado', direccion: DIRECCION_MUNICIPALIDAD,
    descripcion: 'La luminaria de la esquina no enciende por la noche.', estacionId: null, adjuntos: [],
    estado: 'en_proceso', cronologia: { recibido: ahora - 2 * MS_DIA, en_proceso: ahora - MS_DIA },
    notaMunicipal: null, creadoEn: ahora - 2 * MS_DIA, actualizadoEn: ahora - MS_DIA, ultimoEventoId: null,
  }];

  const notificaciones = [{
    id: 'bienvenida',
    titulo: 'Te damos la bienvenida a San Francisco Conecta',
    cuerpo: 'Elegí qué avisos querés recibir y de qué zonas.',
    tipo: 'servicios', zona: null, destino: '#/notificaciones', enlace: null,
    creadoEn: ahora, leida: false, leidaEn: null, origen: 'servidor',
  }];

  const preferencias = {
    tipos: [...PREFERENCIAS_POR_DEFECTO.tipos],
    zonas: [...PREFERENCIAS_POR_DEFECTO.zonas],
    frecuencia: PREFERENCIAS_POR_DEFECTO.frecuencia,
    push: PREFERENCIAS_POR_DEFECTO.push,
  };

  return { tributos, pagos, reclamos, notificaciones, preferencias };
}
