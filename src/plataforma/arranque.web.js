// Pantalla de arranque estática de index.html (#arranque, sección 9.4).
// - quitarArranque(): la saca cuando React ya dibujó debajo la pantalla que corresponde (el Ingreso,
//   con sus mismas medidas, o la app con sesión). Mientras tanto tapa los estados intermedios de React
//   (Cargando), así no hay saltos entre lo estático y lo montado.
// - recordarSesion(conSesion): pista para public/arranque.js, que elige la variante de la pantalla
//   estática en la próxima visita (copia del Ingreso o portada neutra).
const CLAVE = 'sfc:sesion';

export function quitarArranque() {
  document.getElementById('arranque')?.remove();
}

/** true si public/arranque.js encontró la pista de sesión (la visita anterior terminó con sesión). */
export function sesionAnotada() {
  return document.documentElement.hasAttribute('data-sesion');
}

export function recordarSesion(conSesion) {
  try {
    if (conSesion) localStorage.setItem(CLAVE, '1');
    else localStorage.removeItem(CLAVE);
  } catch {
    // Sin localStorage: la pantalla de arranque queda en la copia del Ingreso.
  }
}
