// Doble de src/firebase/rendimiento.js.
export const registros = [];
export const TRAZAS = { PAGO_TRIBUTO: 'pago_tributo' };
export function registrarInicioConDatos(datos) { registros.push(datos); }
export async function medir(traza, fn) { registros.push({ traza }); return fn(); }
