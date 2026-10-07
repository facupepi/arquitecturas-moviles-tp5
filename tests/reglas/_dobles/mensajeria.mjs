// Doble de src/firebase/mensajeria.js.
export const local = { soportado: true, permiso: 'granted', activo: false, token: null };
export const llamadas = [];
let siguienteToken = 'token-fcm-'.padEnd(40, 'a');
export function fijarSiguienteToken(t) { siguienteToken = t; }
export async function soportaPush() { return true; }
export async function obtenerTokenPush() { llamadas.push('obtener'); return siguienteToken; }
export async function borrarTokenPush() { llamadas.push('borrar'); const t = local.token; return t; }
export function estadoPushLocal() { return { ...local }; }
export function guardarTokenLocal(t) { local.token = t; local.activo = Boolean(t); }
