// Stub nativo de plataforma/ubicacion (la variante web es ubicacion.web.js).
import { ErrorApp } from '../datos/errores';

const noSoportado = () => new ErrorApp('no-soportado', 'Este dispositivo no permite obtener tu ubicación.');

export function ubicar() {
  return Promise.reject(noSoportado());
}

export function seguirUbicacion(alCambiar, alFallar = () => {}) {
  queueMicrotask(() => alFallar(noSoportado()));
  return () => {};
}
