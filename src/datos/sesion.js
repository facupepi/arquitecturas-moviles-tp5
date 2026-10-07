// Orquestación de sesión y push (WP3, sección 4.7). Único lugar que combina Auth, mensajería,
// repositorio y Supabase, para que el grafo de imports quede sin ciclos.
import {
  cerrarSesionFirebase, ingresarConCredencial, obtenerTokenId, vincularConGoogle,
} from '../firebase/auth';
import {
  borrarTokenPush, estadoPushLocal, guardarTokenLocal, obtenerTokenPush,
} from '../firebase/mensajeria';
import { borrarDatosEnServidor, eliminarDispositivo, registrarDispositivo } from './repositorio';
import { desdeFirebase } from './errores';

function estadoLocal() {
  try {
    return estadoPushLocal() ?? {};
  } catch {
    return {};
  }
}

// Pide permiso y token, registra el dispositivo y guarda el token en este navegador.
// Lanza no-soportado o permiso (los arma obtenerTokenPush).
export async function activarPush() {
  const anterior = estadoLocal().token ?? null;
  const token = await obtenerTokenPush();
  await registrarDispositivo(token, anterior);
  guardarTokenLocal(token);
  return token;
}

// Borra el token de FCM y el dispositivo; preferencias.push se apaga solo si no quedan otros.
export async function desactivarPush() {
  const guardado = estadoLocal().token ?? null;
  const borrado = await borrarTokenPush();
  const token = borrado || guardado;
  if (token) await eliminarDispositivo(token);
  guardarTokenLocal(null);
}

// Al iniciar: si este navegador tenía push activo, vuelve a pedir el token (sin pedir permiso)
// y lo registra si cambió. Reemplaza el pushsubscriptionchange que hacía el SDK en el SW.
export async function refrescarPush() {
  const local = estadoLocal();
  if (!local.activo) return;
  try {
    const nuevo = await obtenerTokenPush();
    if (nuevo && nuevo !== local.token) {
      await registrarDispositivo(nuevo, local.token ?? null);
      guardarTokenLocal(nuevo);
    }
  } catch (e) {
    console.warn('No se pudo refrescar el token de notificaciones:', desdeFirebase(e).message);
  }
}

async function desactivarPushSinErrores() {
  if (!estadoLocal().activo) return;
  try {
    await desactivarPush();
  } catch (e) {
    console.warn('No se pudo desactivar el push de este dispositivo:', desdeFirebase(e).message);
    try { guardarTokenLocal(null); } catch { /* sin almacenamiento local */ }
  }
}

// Con cuenta de Google: apaga el push de este dispositivo (sin propagar errores) y cierra sesión.
export async function salir() {
  await desactivarPushSinErrores();
  await cerrarSesionFirebase();
}

// Borra el token local, después los datos y el usuario de Auth en el servidor (vecino/baja,
// que también borra los dispositivos) y recién entonces cierra la sesión.
// Si vecino/baja falla, no cierra la sesión y lanza el error.
export async function borrarCuentaYSalir() {
  const local = estadoLocal();
  if (local.activo || local.token) {
    try { await borrarTokenPush(); } catch { /* el servidor borra igual los dispositivos */ }
    try { guardarTokenLocal(null); } catch { /* sin almacenamiento local */ }
  }
  await borrarDatosEnServidor();
  await cerrarSesionFirebase();
}

// Vincula al invitado con Google (conserva el uid). El cambio de usuario.anonimo hace que el
// almacén vuelva a llamar asegurarAlta, que sincroniza nombre y anonimo.
export async function vincular() {
  await vincularConGoogle();
  await obtenerTokenId(true);
}

// El invitado elige entrar con una cuenta de Google que ya tenía datos: se borran sus datos y
// el usuario anónimo, y el teléfono deja de recibir sus push.
export async function cambiarACuentaExistente(credencial) {
  await desactivarPushSinErrores();
  await borrarDatosEnServidor();
  await ingresarConCredencial(credencial);
}
