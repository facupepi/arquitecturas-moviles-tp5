// Notificaciones locales del sistema (WP4, sección 5.9).
//
// Usa la registración del service worker único (corrige heredado:src/notificationPolicy.js:28-33,
// que registraba un segundo service worker). `tag` es siempre la claveEntrega (Anexo A): el push del
// servidor con el mismo data.id reemplaza a esta notificación en lugar de duplicarla.
// Solo la llama el almacén (src/datos/almacen.js).
import { registroListo } from './registroSW';
import { rutaSegura } from '../../shared/rutas.mjs';

/**
 * Muestra una notificación del sistema si hay permiso. Devuelve true si se mostró. Nunca lanza.
 * @param {{ titulo: string, cuerpo?: string, destino?: string | null, tag?: string }} aviso
 */
export async function mostrarNotificacionLocal({ titulo, cuerpo, destino, tag } = {}) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
    const registro = await registroListo();
    await registro.showNotification(titulo || 'San Francisco Conecta', {
      body: cuerpo || '',
      tag: tag || undefined,
      icon: '/icons/icono-192.png',
      badge: '/icons/insignia-96.png',
      lang: 'es-AR',
      data: { destino: rutaSegura(destino) },
    });
    return true;
  } catch (e) {
    console.warn('[Notificaciones] No se pudo mostrar la notificación local:', e?.message || e);
    return false;
  }
}
