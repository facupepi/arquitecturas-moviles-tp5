// Service worker único de la app (WP4, sección 9.2). vite-plugin-pwa lo compila con injectManifest.
// Reemplaza a heredado:src/push-worker.js y heredado:public/notifications-sw.js: ya no hay un segundo
// service worker ni se importa Firebase acá (no depende de la configuración web).
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';
import { rutaSegura } from '../shared/rutas.mjs';

// registerType 'prompt': una versión nueva espera hasta que el vecino acepta el aviso
// (aplicarActualizacion → updateSW(true) → mensaje SKIP_WAITING).
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
// En la primera instalación toma control de la página abierta, así las teselas y la navegación ya
// pasan por el service worker sin recargar. En una actualización solo ocurre después de SKIP_WAITING.
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Navegación: siempre index.html desde el precache (la app usa rutas por hash). Las rutas /__/ del
// Hosting (handler de Auth) quedan afuera. En desarrollo (npm run dev) vite-plugin-pwa inyecta un
// precache vacío y createHandlerBoundToURL lanzaría "not precached", lo que haría fallar la
// evaluación del service worker: ahí la navegación la atiende el servidor de Vite.
if (!import.meta.env.DEV) {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/__\//] }));
}

// Teselas pedidas con crossOrigin (7.2): respuestas CORS con estado 200, nunca opacas (una opaca
// ocupa unos 7 MB de cuota en Chrome y CacheFirst no la guarda sin este plugin).
registerRoute(({ url }) => url.hostname === 'tile.openstreetmap.org',
  new CacheFirst({
    cacheName: 'teselas-osm',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 7 * 86400 }),
    ],
  }));

// Push de FCM sin el SDK firebase/messaging/sw: con una ventana visible ese SDK reenvía el mensaje a
// la página y no muestra nada, y WebKit revoca la suscripción si un push no termina en una
// notificación visible. Este manejador SIEMPRE muestra la notificación.
// Los mensajes del servidor son solo de datos: { id (claveEntrega), titulo, cuerpo, destino, tipo }.
// Un mensaje de prueba enviado desde la consola trae `notification` { title, body }: también se muestra.
self.addEventListener('push', (event) => {
  let d = {};
  try {
    const carga = event.data?.json() ?? {};
    const notificacion = carga.notification ?? {};
    d = { ...(carga.data ?? {}) };
    d.titulo ||= notificacion.title;
    d.cuerpo ||= notificacion.body;
  } catch {
    // Cuerpo no JSON: se usan los textos por defecto.
  }
  event.waitUntil(self.registration.showNotification(d.titulo || 'San Francisco Conecta', {
    body: d.cuerpo || 'Tenés un aviso nuevo.',
    tag: d.id || undefined, // claveEntrega: reemplaza a la notificación local con la misma clave
    icon: '/icons/icono-192.png',
    badge: '/icons/insignia-96.png',
    lang: 'es-AR',
    data: { destino: rutaSegura(d.destino) },
  }));
});

// Lista de destinos permitidos y reutilización de la ventana: heredado:src/push-worker.js:4-35.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL('/' + rutaSegura(event.notification.data?.destino), self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (ventanas) => {
    const abierta = ventanas.find((c) => new URL(c.url).origin === self.location.origin);
    if (abierta) {
      try {
        await abierta.navigate(url);
      } catch {
        // navigate() falla si la ventana no está controlada por este service worker: se enfoca igual
        // y se le pide por mensaje que cambie de ruta (lo atiende src/plataforma/registroSW.web.js).
        abierta.postMessage({ tipo: 'navegar', destino: rutaSegura(event.notification.data?.destino) });
      }
      return abierta.focus();
    }
    return self.clients.openWindow(url);
  }));
});
