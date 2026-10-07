// Doble de src/firebase/analytics.js.
export const eventos = [];
export const EVENTOS = { ERROR_OPERACION: 'error_operacion' };
export function registrarEvento(nombre, parametros) { eventos.push({ nombre, parametros }); }
