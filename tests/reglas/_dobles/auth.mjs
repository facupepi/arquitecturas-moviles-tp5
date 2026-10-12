// Doble de src/firebase/auth.js.
export const auth = { currentUser: null };
export function fijarUsuario(uid) { auth.currentUser = uid ? { uid } : null; }
export const llamadas = [];
export async function obtenerTokenId(forzar = false) { llamadas.push(`token:${forzar}`); return 'token'; }
export async function cerrarSesionFirebase() { llamadas.push('salir'); }
