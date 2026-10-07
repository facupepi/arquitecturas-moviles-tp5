// Performance Monitoring diferido (WP4, sección 5.6).
//
// El SDK mide solo la carga de página y las solicitudes de red; aunque se inicialice tarde, la carga
// de página se registra igual (lee las mediciones de navegación al ocultar la página). Las trazas
// propias se guardan acá hasta que el SDK carga con iniciarRendimiento() (lo llama diferidos.js).
import { app } from './app.js';
import { USAR_EMULADORES } from './config.js';
import { habiaSesionAlIniciar } from './auth.js';

export const TRAZAS = Object.freeze({
  INICIO_CON_DATOS: 'inicio_con_datos',
  ALTA_VECINO: 'alta_vecino',
  ALTA_RECLAMO: 'alta_reclamo',
  PAGO_TRIBUTO: 'pago_tributo',
  INICIO_ESTACIONAMIENTO: 'inicio_estacionamiento',
  CARGA_MAPA: 'carga_mapa',
});

const MAXIMO_EN_COLA = 50;
let cola = [];
let estado = 'pendiente'; // 'pendiente' | 'cargando' | 'activo' | 'inactivo'
let sdk = null;
let rendimiento = null;
let inicio = null;
let inicioRegistrado = false;

const ahoraEpoch = () => (typeof performance !== 'undefined' && performance.timeOrigin
  ? performance.timeOrigin + performance.now()
  : Date.now());

// Atributos de Performance: hasta 5, nombre de hasta 40 caracteres y valor de texto de hasta 100.
function atributosValidos(atributos) {
  const salida = {};
  for (const [clave, valor] of Object.entries(atributos || {}).slice(0, 5)) {
    if (valor === undefined || valor === null) continue;
    const texto = typeof valor === 'boolean' ? (valor ? 'si' : 'no') : String(valor);
    salida[clave.slice(0, 40)] = texto.slice(0, 100);
  }
  return salida;
}

function grabar({ nombre, inicioMs, duracionMs, atributos }) {
  try {
    // Performance exige una duración positiva: una operación que falla al instante se registra con 1 ms.
    sdk.trace(rendimiento, nombre).record(Math.round(inicioMs), Math.max(1, Math.round(duracionMs)), { attributes: atributos });
  } catch (e) {
    console.warn('[Performance] No se pudo registrar la traza:', nombre, e);
  }
}

/** Registra una traza ya medida. inicioMs en milisegundos desde la época. Nunca lanza. */
export function registrarTraza(nombre, inicioMs, duracionMs, atributos = {}) {
  if (!nombre || estado === 'inactivo') return;
  const traza = { nombre, inicioMs, duracionMs, atributos: atributosValidos(atributos) };
  if (estado === 'activo') { grabar(traza); return; }
  if (cola.length < MAXIMO_EN_COLA) cola.push(traza);
}

/**
 * Mide una operación asíncrona y devuelve su resultado (o vuelve a lanzar su error).
 *   medir(TRAZAS.PAGO_TRIBUTO, () => pagarTributo(id, requestId))
 *   medir(TRAZAS.ALTA_RECLAMO, promesa, { adjuntos: 2 })
 *   medir(TRAZAS.ALTA_VECINO, fn, (resultado) => ({ creado: resultado?.creado }))
 * `operacion` puede ser una función que devuelve una promesa o una promesa ya creada. `atributos`
 * es un objeto o una función que recibe el resultado. Si falla, la traza lleva resultado = 'error'.
 */
export async function medir(traza, operacion, atributos = {}) {
  const inicioMs = ahoraEpoch();
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const transcurrido = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  try {
    const resultado = await (typeof operacion === 'function' ? operacion() : operacion);
    const extra = typeof atributos === 'function' ? safe(() => atributos(resultado)) : atributos;
    registrarTraza(traza, inicioMs, transcurrido(), { ...extra, resultado: 'ok' });
    return resultado;
  } catch (e) {
    const extra = typeof atributos === 'function' ? {} : atributos;
    registrarTraza(traza, inicioMs, transcurrido(), { ...extra, resultado: 'error' });
    throw e;
  }
}

function safe(fn) {
  try { return fn() || {}; } catch { return {}; }
}

/**
 * Traza inicio_con_datos: desde performance.timeOrigin hasta que el almacén queda listo por
 * primera vez. Solo se registra una vez por carga de página.
 */
export function registrarInicioConDatos({ desdeCache = false, autenticado } = {}) {
  if (inicioRegistrado || typeof performance === 'undefined') return;
  inicioRegistrado = true;
  registrarTraza(TRAZAS.INICIO_CON_DATOS, performance.timeOrigin, performance.now(), {
    desde_cache: !!desdeCache,
    autenticado: autenticado ?? habiaSesionAlIniciar(),
  });
}

/** Carga el SDK (import dinámico) y graba las trazas guardadas. Idempotente. */
export function iniciarRendimiento() {
  if (inicio) return inicio;
  inicio = (async () => {
    if (USAR_EMULADORES) {
      estado = 'inactivo';
      cola = [];
      return false;
    }
    estado = 'cargando';
    try {
      sdk = await import('firebase/performance');
      rendimiento = sdk.initializePerformance(app);
      estado = 'activo';
      const pendientes = cola;
      cola = [];
      for (const traza of pendientes) grabar(traza);
      return true;
    } catch (e) {
      console.info('[Performance] Inactivo:', e?.message || e);
      estado = 'inactivo';
      cola = [];
      return false;
    }
  })();
  return inicio;
}
