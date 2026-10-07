// Cliente de las Edge Functions de Supabase (sección 6.13).
// Manda el ID token de Firebase y, si hay, el token de App Check. Ninguna clave de Supabase.
import { obtenerTokenId } from '../firebase/auth.js';
import { obtenerTokenAppCheck } from '../firebase/appCheck.js';
import { SUPABASE_URL } from '../firebase/config.js';
import { ErrorApp } from '../datos/errores.js';

// Códigos que el servidor puede devolver y que el cliente conoce (sección 4.2).
const CODIGOS_SERVIDOR = new Set([
  'sin-sesion', 'app-check', 'permiso', 'validacion', 'no-encontrado', 'adjunto-invalido',
  'cuota', 'servidor', 'sin-conexion', 'desconocido',
]);

function codigoPorEstado(estado) {
  if (estado === 401) return 'sin-sesion';
  if (estado === 403) return 'permiso';
  if (estado === 404) return 'no-encontrado';
  if (estado === 413) return 'adjunto-invalido';
  if (estado === 429) return 'cuota';
  if (estado >= 500) return 'servidor';
  if (estado === 400) return 'validacion';
  return 'desconocido';
}

async function intentar(promesa) {
  try {
    return await promesa;
  } catch {
    return null;
  }
}

async function pedir(ruta, { cuerpo, formulario, metodo, esperaMs, forzarToken }) {
  const encabezados = {};
  const token = await intentar(obtenerTokenId(forzarToken));
  if (token) encabezados.Authorization = `Bearer ${token}`;
  else if (metodo !== 'GET') throw new ErrorApp('sin-sesion');
  const tokenAppCheck = await intentar(obtenerTokenAppCheck());
  if (tokenAppCheck) encabezados['X-Firebase-AppCheck'] = tokenAppCheck;

  let body;
  if (formulario) body = formulario; // el navegador pone el Content-Type multipart con su límite
  else if (cuerpo !== undefined) {
    encabezados['Content-Type'] = 'application/json';
    body = JSON.stringify(cuerpo);
  }

  const base = String(SUPABASE_URL || '').replace(/\/+$/, '');
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), esperaMs);
  let respuesta;
  try {
    respuesta = await fetch(`${base}/functions/v1/${ruta}`, {
      method: metodo,
      headers: encabezados,
      body,
      signal: control.signal,
    });
  } catch (causa) {
    throw new ErrorApp('sin-conexion', undefined, { causa });
  } finally {
    clearTimeout(temporizador);
  }

  let json = null;
  try {
    json = await respuesta.json();
  } catch {
    json = null;
  }
  return { estado: respuesta.status, json };
}

/**
 * Llama a una Edge Function y devuelve `datos`.
 * @param {string} ruta 'vecino/alta' | 'vecino/baja' | 'adjuntos/subir' | 'adjuntos/url' | 'despachar' | 'tareas'
 * @param {{ cuerpo?: unknown, formulario?: FormData, metodo?: string, esperaMs?: number }} [opciones]
 * @throws {ErrorApp} con el código del servidor, 'sin-conexion' si fetch falla o vence el tiempo.
 */
export async function llamarFuncion(ruta, { cuerpo, formulario, metodo = 'POST', esperaMs = 20000 } = {}) {
  const opciones = { cuerpo, formulario, metodo, esperaMs, forzarToken: false };
  let { estado, json } = await pedir(ruta, opciones);

  // Un token vencido entre la lectura y la llamada: se renueva una vez y se reintenta.
  if (estado === 401 && json?.error?.codigo === 'sin-sesion') {
    ({ estado, json } = await pedir(ruta, { ...opciones, forzarToken: true }));
  }

  if (json && json.ok === true) return json.datos;
  if (json && json.ok === false && json.error) {
    const codigo = CODIGOS_SERVIDOR.has(json.error.codigo) ? json.error.codigo : codigoPorEstado(estado);
    const mensaje = typeof json.error.mensaje === 'string' && json.error.mensaje ? json.error.mensaje : undefined;
    throw new ErrorApp(codigo, mensaje, { datos: { estado } });
  }
  throw new ErrorApp(estado >= 200 && estado < 300 ? 'desconocido' : codigoPorEstado(estado), undefined, {
    datos: { estado },
  });
}
