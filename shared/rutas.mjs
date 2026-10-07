// Rutas por hash con enlaces profundos (sección 7.3): #/<ruta>[/<id>][?clave=valor].
// Lo usan el enrutador (WP5), el service worker (rutaSegura sobre data.destino de un push) y Supabase.

export const RUTAS = Object.freeze([
  'inicio', 'bicicletas', 'tributos', 'reclamos', 'contactos', 'alarmas',
  'estacionamiento', 'notificaciones', 'cuenta', 'panel', 'galeria',
]);

const RUTA_POR_DEFECTO = 'inicio';
const RUTA_SEGURA_POR_DEFECTO = 'notificaciones';
const PATRON_ID = /^[A-Za-z0-9_-]{1,80}$/;

// Mismo patrón que destinoValido() de firestore.rules (destinos guardados en avisos y notificaciones).
export function destinoValido(destino) {
  return destino === null || (typeof destino === 'string' && /^#\/[a-z]+(\/[A-Za-z0-9_-]+)?$/.test(destino));
}

function decodificar(texto) {
  try { return decodeURIComponent(texto); } catch { return null; }
}

// Interpreta el hash sin normalizar la ruta: devuelve también si la ruta era conocida.
function interpretar(hash) {
  let texto = typeof hash === 'string' ? hash.trim() : '';
  const almohadilla = texto.indexOf('#');
  if (almohadilla >= 0) texto = texto.slice(almohadilla + 1); // admite '/#/tributos' o una URL completa
  texto = texto.replace(/^\/+/, ''); // '#/tributos' y el formato heredado '#tributos'
  const pregunta = texto.indexOf('?');
  const camino = pregunta >= 0 ? texto.slice(0, pregunta) : texto;
  const consulta = pregunta >= 0 ? texto.slice(pregunta + 1) : '';
  const [segNombre = '', segId = ''] = camino.split('/');
  const nombre = (decodificar(segNombre) ?? '').toLowerCase();
  const id = segId ? decodificar(segId) : null;
  const vistos = new Map();
  for (const [clave, valor] of new URLSearchParams(consulta)) {
    if (!vistos.has(clave)) vistos.set(clave, valor); // la primera aparición gana
  }
  return {
    conocida: RUTAS.includes(nombre),
    nombre,
    id: id !== null && PATRON_ID.test(id) ? id : null,
    params: Object.fromEntries(vistos), // propiedades propias: '__proto__' no toca el prototipo
  };
}

// → { nombre, id, params }. Ruta vacía o desconocida → 'inicio' (sin id ni params).
export function parsearHash(hash) {
  const r = interpretar(hash);
  if (!r.conocida) return { nombre: RUTA_POR_DEFECTO, id: null, params: {} };
  return { nombre: r.nombre, id: r.id, params: r.params };
}

// → '#/nombre[/id][?clave=valor]'. Una ruta que no está en RUTAS es un error de programación.
export function construirHash(nombre, id = null, params = null) {
  if (!RUTAS.includes(nombre)) throw new TypeError(`Ruta desconocida: ${nombre}`);
  let hash = `#/${nombre}`;
  if (id !== null && id !== undefined && id !== '') hash += `/${encodeURIComponent(String(id))}`;
  if (params) {
    const consulta = new URLSearchParams();
    for (const [clave, valor] of Object.entries(params)) {
      if (valor !== null && valor !== undefined) consulta.append(clave, String(valor));
    }
    const texto = consulta.toString();
    if (texto) hash += `?${texto}`;
  }
  return hash;
}

// Hash válido y reconstruido (#/… con ruta en RUTAS) o '#/notificaciones'. Para destinos que vienen
// de afuera (data.destino de un push, avisos): nunca deja pasar un esquema, un origen ni una ruta rara.
export function rutaSegura(destino) {
  const r = interpretar(destino);
  if (!r.conocida) return `#/${RUTA_SEGURA_POR_DEFECTO}`;
  return construirHash(r.nombre, r.id, r.params);
}
