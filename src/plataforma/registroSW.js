// Variante nativa del registro del service worker (WP4, sección 5.1): no hay service worker.
// La versión web está en registroSW.web.js, que Vite elige antes que este archivo.
import { ErrorApp } from '../datos/errores.js';

export function registrarServiceWorker() {}

export function alHaberActualizacion() {
  return () => {};
}

export async function aplicarActualizacion() {}

export function registroListo() {
  return Promise.reject(new ErrorApp('no-soportado', 'Esta plataforma no tiene service worker.'));
}
