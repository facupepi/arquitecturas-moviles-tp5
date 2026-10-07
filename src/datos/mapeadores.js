// Mapeadores de documentos de Firestore al estado del cliente (sección 4.1).
// Puros y sin imports: convierten Timestamp a milisegundos, agregan id, pendiente y,
// en grupos de colecciones, el uid del dueño. Se prueban en Node con documentos falsos.

const esTimestamp = (v) => v != null && typeof v === 'object' && typeof v.toMillis === 'function';

// Recorre mapas y arrays: toda fecha queda en milisegundos (sección 0).
export function convertirFechas(valor) {
  if (valor == null) return valor ?? null;
  if (esTimestamp(valor)) return valor.toMillis();
  if (valor instanceof Date) return valor.getTime();
  if (Array.isArray(valor)) return valor.map(convertirFechas);
  if (typeof valor === 'object') {
    // GeoPoint, DocumentReference u otros objetos del SDK se dejan como están.
    const proto = Object.getPrototypeOf(valor);
    if (proto !== Object.prototype && proto !== null) return valor;
    const salida = {};
    for (const [clave, v] of Object.entries(valor)) salida[clave] = convertirFechas(v);
    return salida;
  }
  return valor;
}

const msONull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const textoONull = (v) => (typeof v === 'string' ? v : null);
const numero = (v, porDefecto = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : porDefecto);

// Documento genérico: { id, ...datos con fechas en ms, pendiente }.
export function desdeDoc(snap, { grupo = false } = {}) {
  if (!snap || (typeof snap.exists === 'function' && !snap.exists())) return null;
  const crudo = snap.data({ serverTimestamps: 'estimate' }) ?? {};
  const datos = convertirFechas(crudo);
  const salida = { ...datos, id: snap.id, pendiente: Boolean(snap.metadata?.hasPendingWrites) };
  if (grupo) salida.uid = snap.ref?.parent?.parent?.id ?? null;
  return salida;
}

export function infoDesdeDoc(snap) {
  const d = desdeDoc(snap);
  if (!d) return null;
  return { ...d, centroMapa: d.centroMapa ?? { lat: -31.429, lng: -62.082 } };
}

export function configDesdeDoc(snap) {
  const d = desdeDoc(snap);
  if (!d) return null;
  return {
    ...d,
    simuladorActivo: d.simuladorActivo === true,
    simuladorCadaMin: numero(d.simuladorCadaMin, 2),
    horarioEstricto: d.horarioEstricto !== false,
    avisoEstacionamientoMin: numero(d.avisoEstacionamientoMin, 5),   // respaldo 5 (sección 4.5)
    ultimaSimulacion: msONull(d.ultimaSimulacion),
    actualizadoEn: msONull(d.actualizadoEn),
  };
}

export function estacionDesdeDoc(snap) {
  const d = desdeDoc(snap);
  if (!d) return null;
  const capacidad = numero(d.capacidad);
  const bicicletas = numero(d.bicicletas);
  return {
    ...d,
    bicicletas, capacidad,
    anclajesLibres: Math.max(0, capacidad - bicicletas),
    estado: d.estado === 'fuera_de_servicio' ? 'fuera_de_servicio' : 'operativa',
    actualizadoEn: msONull(d.actualizadoEn),
  };
}

export function alarmaDesdeDoc(snap) {
  const d = desdeDoc(snap);
  if (!d) return null;
  return {
    ...d,
    activa: d.activa === true,
    activadaEn: msONull(d.activadaEn),
    activacionId: textoONull(d.activacionId),
    actualizadoEn: msONull(d.actualizadoEn),
  };
}

export function zonaDesdeDoc(snap) {
  const d = desdeDoc(snap);
  if (!d) return null;
  return { ...d, tramo: Array.isArray(d.tramo) ? d.tramo : [], tarifaHora: numero(d.tarifaHora) };
}

export function contactoDesdeDoc(snap) {
  const d = desdeDoc(snap);
  if (!d) return null;
  return {
    ...d,
    telefono: textoONull(d.telefono), correo: textoONull(d.correo),
    whatsapp: textoONull(d.whatsapp), sitio: textoONull(d.sitio),
    orden: numero(d.orden, 999),
  };
}

export function avisoDesdeDoc(snap) {
  const d = desdeDoc(snap);
  if (!d) return null;
  return {
    ...d,
    detalle: textoONull(d.detalle) ?? '',
    destino: textoONull(d.destino), enlace: textoONull(d.enlace),
    creadoEn: msONull(d.creadoEn) ?? 0,
    vigenteHasta: msONull(d.vigenteHasta),
    eventoId: textoONull(d.eventoId),
  };
}

export function perfilDesdeDoc(snap) {
  const d = desdeDoc(snap);
  if (!d) return null;
  const cercania = d.cercania && typeof d.cercania === 'object'
    ? { alarmas: Array.isArray(d.cercania.alarmas) ? d.cercania.alarmas : [], vence: msONull(d.cercania.vence) }
    : null;
  return {
    ...d,
    nombre: textoONull(d.nombre) ?? '',
    anonimo: d.anonimo === true,
    altaEn: msONull(d.altaEn),
    creadoEn: msONull(d.creadoEn),
    actualizadoEn: msONull(d.actualizadoEn),
    preferencias: d.preferencias ?? null,
    cercania,
    privacidadAceptadaEn: msONull(d.privacidadAceptadaEn),
  };
}

export function tributoDesdeDoc(snap) {
  const d = desdeDoc(snap);
  if (!d) return null;
  return {
    ...d,
    importe: numero(d.importe),
    vence: msONull(d.vence),
    pagadoEn: msONull(d.pagadoEn),
    comprobante: textoONull(d.comprobante),
    pagoId: textoONull(d.pagoId),
  };
}

export function pagoDesdeDoc(snap) {
  const d = desdeDoc(snap);
  if (!d) return null;
  return { ...d, importe: numero(d.importe), creadoEn: msONull(d.creadoEn) ?? 0 };
}

export function reclamoDesdeDoc(snap, opciones) {
  const d = desdeDoc(snap, opciones);
  if (!d) return null;
  return {
    ...d,
    adjuntos: Array.isArray(d.adjuntos) ? d.adjuntos : [],
    cronologia: d.cronologia ?? {},
    notaMunicipal: textoONull(d.notaMunicipal),
    estacionId: textoONull(d.estacionId),
    creadoEn: msONull(d.creadoEn) ?? 0,
    actualizadoEn: msONull(d.actualizadoEn),
    ultimoEventoId: textoONull(d.ultimoEventoId),
  };
}

export function reclamoDeGrupoDesdeDoc(snap) {
  return reclamoDesdeDoc(snap, { grupo: true });
}

export function sesionDesdeDoc(snap) {
  const d = desdeDoc(snap);
  if (!d) return null;
  return {
    ...d,
    minutos: numero(d.minutos), importe: numero(d.importe), extensiones: numero(d.extensiones),
    inicio: msONull(d.inicio), fin: msONull(d.fin), actualizadoEn: msONull(d.actualizadoEn),
    avisoPorVencer: d.avisoPorVencer === true, avisoFinalizado: d.avisoFinalizado === true,
  };
}

export function notificacionDesdeDoc(snap) {
  const d = desdeDoc(snap);
  if (!d) return null;
  return {
    ...d,
    zona: textoONull(d.zona), destino: textoONull(d.destino), enlace: textoONull(d.enlace),
    creadoEn: msONull(d.creadoEn) ?? 0,
    leida: d.leida === true,
    leidaEn: msONull(d.leidaEn),
  };
}

export function eventoDesdeDoc(snap) {
  const d = desdeDoc(snap);
  if (!d) return null;
  return {
    ...d,
    uid: textoONull(d.uid),
    intentos: numero(d.intentos),
    enviados: numero(d.enviados),
    creadoEn: msONull(d.creadoEn) ?? 0,
    procesadoEn: msONull(d.procesadoEn),
    error: textoONull(d.error),
  };
}

// Metadatos comunes de un snapshot (sección 4.3).
export function metaDe(snapshot) {
  return {
    desdeCache: Boolean(snapshot?.metadata?.fromCache),
    pendientes: Boolean(snapshot?.metadata?.hasPendingWrites),
  };
}
