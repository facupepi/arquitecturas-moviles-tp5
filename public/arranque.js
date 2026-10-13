// Pista de sesión para la pantalla de arranque de index.html (se carga en <head>, antes de pintar).
// src/plataforma/arranque.web.js anota en localStorage si la última visita terminó con sesión: en ese
// caso la pantalla estática muestra la portada neutra en lugar de la copia del Ingreso, que es lo que
// React va a dibujar para quien no ingresó. Es un archivo aparte porque la CSP no admite scripts en línea.
try {
  if (localStorage.getItem('sfc:sesion') === '1') document.documentElement.setAttribute('data-sesion', '');
} catch (e) {
  // Sin localStorage (navegación privada estricta): se muestra la copia del Ingreso.
}
