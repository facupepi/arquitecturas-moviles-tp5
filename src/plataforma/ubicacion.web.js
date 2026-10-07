// Geolocalización del navegador (port de heredado:src/platform.web.js:1-16). La posición
// nunca se guarda: solo se usa en memoria para ordenar estaciones y calcular alarmas cercanas.
import { ErrorApp } from '../datos/errores';

// Textos generales: los usan Bicicletas y Alarmas, cada una agrega su propia alternativa.
const MENSAJE_PERMISO = 'No se pudo obtener tu ubicación. Permití el acceso a la ubicación en el navegador y probá de nuevo.';

function opciones(precision) {
  const alta = precision === 'alta';
  return { enableHighAccuracy: alta, timeout: alta ? 15000 : 10000, maximumAge: alta ? 0 : 60000 };
}

function convertirError(e) {
  if (e?.code === 1) return new ErrorApp('permiso', MENSAJE_PERMISO, { causa: e });
  if (e?.code === 3) return new ErrorApp('desconocido', 'La ubicación tardó demasiado. Probá de nuevo.', { causa: e });
  return new ErrorApp('desconocido', 'No pudimos obtener tu ubicación. Probá de nuevo en unos segundos.', { causa: e });
}

function sinGeolocalizacion() {
  return typeof navigator === 'undefined' || !navigator.geolocation;
}

const ERROR_NO_SOPORTADO = () => new ErrorApp('no-soportado', 'Este navegador no permite obtener tu ubicación.');

export function ubicar({ precision = 'normal' } = {}) {
  return new Promise((resolver, rechazar) => {
    if (sinGeolocalizacion()) return rechazar(ERROR_NO_SOPORTADO());
    navigator.geolocation.getCurrentPosition(
      (p) => resolver({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => rechazar(convertirError(e)),
      opciones(precision),
    );
  });
}

// Sigue la posición con watchPosition. Devuelve la función para detener el seguimiento.
export function seguirUbicacion(alCambiar, alFallar = () => {}, { precision = 'normal' } = {}) {
  if (sinGeolocalizacion()) {
    queueMicrotask(() => alFallar(ERROR_NO_SOPORTADO()));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (p) => alCambiar({ lat: p.coords.latitude, lng: p.coords.longitude }),
    (e) => alFallar(convertirError(e)),
    opciones(precision),
  );
  return () => navigator.geolocation.clearWatch(id);
}
