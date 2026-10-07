// Estado de la red y señales de la página en el navegador (WP3, sección 4.1).
import { useSyncExternalStore } from 'react';

function suscribir(avisar) {
  window.addEventListener('online', avisar);
  window.addEventListener('offline', avisar);
  return () => {
    window.removeEventListener('online', avisar);
    window.removeEventListener('offline', avisar);
  };
}

export function estaEnLinea() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

// { enLinea } con los eventos online/offline del navegador.
export function useConexion() {
  const enLinea = useSyncExternalStore(suscribir, estaEnLinea, () => true);
  return { enLinea };
}

// Marca que la app ya mostró datos: lo esperan las pruebas e2e y la medición de carga.
export function marcarListo() {
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-listo', 'true');
}

export function pestanaOculta() {
  return typeof document !== 'undefined' && document.hidden === true;
}
