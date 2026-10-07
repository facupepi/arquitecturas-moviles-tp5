// Contrato de nombres de archivo de pantallas para el enrutador (WP5, 7.3).
// Cada pantalla es src/pantallas/<Archivo>.jsx con export default y recibe la prop `ruta`.

export const ARCHIVO_POR_RUTA = {
  inicio: 'Inicio',
  bicicletas: 'Bicicletas',
  tributos: 'Tributos',
  reclamos: 'Reclamos',
  contactos: 'Contactos',
  alarmas: 'Alarmas',
  estacionamiento: 'Estacionamiento',
  notificaciones: 'Notificaciones',
  cuenta: 'Cuenta',
  panel: 'PanelMunicipal',
};

// Solo en desarrollo (__DEV__, definido por Vite): la galería de componentes.
export const RUTA_GALERIA = 'galeria';
export const EN_DESARROLLO = typeof __DEV__ !== 'undefined' && __DEV__ === true;

export function esRutaConocida(nombre) {
  return Object.hasOwn(ARCHIVO_POR_RUTA, nombre) || (EN_DESARROLLO && nombre === RUTA_GALERIA);
}
