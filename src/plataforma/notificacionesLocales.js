// Variante nativa de las notificaciones locales (WP4, sección 5.9): no muestra nada.
// La versión web está en notificacionesLocales.web.js, que Vite elige antes que este archivo.
export async function mostrarNotificacionLocal() {
  return false;
}
