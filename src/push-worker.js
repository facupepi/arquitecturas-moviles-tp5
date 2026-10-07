import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";
import { firebaseConfig as config } from "./firebaseConfig.js";
const allowed = [
  "inicio",
  "bicicletas",
  "tributos",
  "reclamos",
  "contactos",
  "alarmas",
  "estacionamiento",
  "notificaciones",
];
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = allowed.includes(event.notification.data?.target)
    ? event.notification.data.target
    : "notificaciones";
  const url = new URL("/#" + target, self.location.origin).href;
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windows) => {
        const existing = windows.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );
        if (existing) {
          await existing.navigate(url);
          return existing.focus();
        }
        return clients.openWindow(url);
      }),
  );
});
onBackgroundMessage(getMessaging(initializeApp(config)), (payload) => {
  const value = payload.data || {};
  return self.registration.showNotification(
    value.title || "San Francisco Conecta",
    {
      body: value.body || "Tenés un nuevo aviso.",
      tag: value.id,
      data: { target: value.target },
    },
  );
});
