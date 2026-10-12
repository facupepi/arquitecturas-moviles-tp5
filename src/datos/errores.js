// Errores de la aplicación (sección 4.2). Este módulo NO importa nada: lo usan
// src/firebase (WP4) y src/supabase (WP6) sin crear ciclos.

export const CODIGOS = Object.freeze([
  'sin-sesion', 'sin-conexion', 'app-check', 'permiso', 'validacion', 'no-encontrado', 'ya-pagado',
  'patente-ocupada', 'fuera-de-horario', 'sesion-vencida', 'maximo-alcanzado', 'adjunto-invalido',
  'popup-bloqueado', 'no-soportado', 'cuota', 'servidor', 'desconocido',
]);

export const MENSAJES = Object.freeze({
  'sin-sesion': 'Ingresá para continuar.',
  'sin-conexion': 'No hay conexión. Revisá tu red e intentá de nuevo.',
  'app-check': 'No pudimos verificar la aplicación. Recargá la página.',
  permiso: 'No se pudo validar la operación.',
  validacion: 'Revisá los datos ingresados.',
  'no-encontrado': 'No encontramos el registro.',
  'ya-pagado': 'Este cedulón ya está pagado.',
  'patente-ocupada': 'La patente ya tiene una sesión activa.',
  'fuera-de-horario': 'La zona está fuera de su horario de cobro.',
  'sesion-vencida': 'La sesión venció. Iniciá una nueva.',
  'maximo-alcanzado': 'El máximo por sesión es de 4 horas.',
  'adjunto-invalido': 'El archivo adjunto no es válido.',
  'popup-bloqueado': 'El navegador bloqueó la ventana de Google.',
  'no-soportado': 'Tu navegador no admite esta función.',
  cuota: 'El servicio está saturado. Probá en unos minutos.',
  servidor: 'El servicio no respondió. Intentá nuevamente.',
  desconocido: 'No se pudo completar la operación.',
});

// "La patente ya tiene una sesión activa hasta las HH:MM." con la hora de Córdoba.
function horaCordoba(ms) {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Cordoba', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(new Date(ms));
  } catch {
    const d = new Date(ms - 3 * 3600_000);
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  }
}

function mensajePorDefecto(codigo, datos) {
  if (codigo === 'patente-ocupada' && typeof datos?.fin === 'number') {
    return `La patente ya tiene una sesión activa hasta las ${horaCordoba(datos.fin)}.`;
  }
  return MENSAJES[codigo] ?? MENSAJES.desconocido;
}

export class ErrorApp extends Error {
  constructor(codigo, mensaje, { campo = null, datos = null, causa = null } = {}) {
    const valido = CODIGOS.includes(codigo) ? codigo : 'desconocido';
    super(mensaje || mensajePorDefecto(valido, datos));
    this.name = 'ErrorApp';
    this.codigo = valido;
    this.mensaje = this.message;
    this.campo = campo;
    this.datos = datos;
    this.causa = causa;
  }

  // Los errores de red o del servidor se pueden reintentar (UIX-05).
  get reintentable() {
    return this.codigo === 'sin-conexion' || this.codigo === 'servidor';
  }
}

export function esErrorApp(e) {
  return e instanceof ErrorApp || (e != null && e.name === 'ErrorApp' && typeof e.codigo === 'string');
}

// Firestore: código sin prefijo ('permission-denied'). Auth: 'auth/...'. Otros SDK: 'firestore/...'.
const POR_CODIGO_FIREBASE = {
  'permission-denied': 'permiso',
  unauthenticated: 'sin-sesion',
  unavailable: 'sin-conexion',
  'deadline-exceeded': 'sin-conexion',
  'resource-exhausted': 'cuota',
  'not-found': 'no-encontrado',
  'auth/network-request-failed': 'sin-conexion',
  'auth/popup-blocked': 'popup-bloqueado',
  'auth/too-many-requests': 'cuota',
  'auth/quota-exceeded': 'cuota',
  'auth/operation-not-supported-in-this-environment': 'no-soportado',
  'auth/web-storage-unsupported': 'no-soportado',
  'auth/user-token-expired': 'sin-sesion',
  'auth/requires-recent-login': 'sin-sesion',
  'auth/user-disabled': 'permiso',
  'auth/admin-restricted-operation': 'permiso',
  'messaging/permission-blocked': 'permiso',
  'messaging/unsupported-browser': 'no-soportado',
};

const MENSAJES_RED = /failed to fetch|networkerror|network request failed|load failed|err_internet_disconnected|client is offline/i;

function codigoHttp(status) {
  if (status === 401) return 'sin-sesion';
  if (status === 403) return 'permiso';
  if (status === 404) return 'no-encontrado';
  if (status === 413) return 'adjunto-invalido';
  if (status === 429) return 'cuota';
  if (status >= 500) return 'servidor';
  return null;
}

// Convierte cualquier error (Firestore, Auth, fetch, dominio, HTTP) en un ErrorApp.
// Nunca deja pasar un mensaje crudo del SDK (UIX-07): solo los mensajes propios en español.
export function desdeFirebase(e) {
  if (esErrorApp(e)) return e;
  if (e == null) return new ErrorApp('desconocido');

  // ErrorDominio de shared/dominio.mjs (no se importa para no crear dependencias).
  if (e.name === 'ErrorDominio' || e.constructor?.name === 'ErrorDominio') {
    return new ErrorApp('validacion', e.message || MENSAJES.validacion, { campo: e.campo ?? null, causa: e });
  }

  // Objetos con forma { codigo, mensaje } (respuesta de Supabase ya parseada).
  if (typeof e.codigo === 'string' && CODIGOS.includes(e.codigo)) {
    return new ErrorApp(e.codigo, typeof e.mensaje === 'string' && e.mensaje ? e.mensaje : undefined, {
      campo: e.campo ?? null, datos: e.datos ?? null, causa: e,
    });
  }

  if (e.name === 'AbortError' || e.name === 'TimeoutError') return new ErrorApp('servidor', undefined, { causa: e });

  const codigo = typeof e.code === 'string' ? e.code : '';
  const sinPrefijo = codigo.replace(/^firestore\//, '');
  if (POR_CODIGO_FIREBASE[codigo]) return new ErrorApp(POR_CODIGO_FIREBASE[codigo], undefined, { causa: e });
  if (POR_CODIGO_FIREBASE[sinPrefijo]) return new ErrorApp(POR_CODIGO_FIREBASE[sinPrefijo], undefined, { causa: e });

  if (typeof e.status === 'number') {
    const http = codigoHttp(e.status);
    if (http) return new ErrorApp(http, undefined, { causa: e });
  }

  const mensaje = typeof e.message === 'string' ? e.message : '';
  if ((e.name === 'TypeError' && MENSAJES_RED.test(mensaje)) || MENSAJES_RED.test(mensaje)) {
    return new ErrorApp('sin-conexion', undefined, { causa: e });
  }
  return new ErrorApp('desconocido', undefined, { causa: e });
}
