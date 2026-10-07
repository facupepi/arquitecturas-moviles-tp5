import { firebaseApp, localServices } from "./firebase";
import { repository } from "./repository";
let messaging, token;
export async function enablePush() {
  if (!("Notification" in window))
    throw new Error(
      "Este navegador no admite avisos. Podés consultar el historial.",
    );
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      "No se habilitaron las notificaciones. Podés consultar el historial.",
    );
  if (localServices) {
    await navigator.serviceWorker?.register("/notifications-sw.js");
    return;
  }
  const key = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!key)
    throw new Error(
      "El servicio de notificaciones todavía no está configurado. Podés consultar el historial.",
    );
  const sdk = await import("firebase/messaging");
  if (!(await sdk.isSupported()))
    throw new Error(
      "Este navegador no admite notificaciones push. Podés consultar el historial.",
    );
  const worker = await navigator.serviceWorker.register(
    import.meta.env.DEV ? "/src/push-worker.js" : "/firebase-messaging-sw.js",
    { type: "module" },
  );
  messaging = sdk.getMessaging(firebaseApp);
  token = await sdk.getToken(messaging, {
    vapidKey: key,
    serviceWorkerRegistration: worker,
  });
  await repository.request("/push/register", { token });
}
export async function disablePush() {
  if (
    !token &&
    !localServices &&
    "Notification" in window &&
    Notification.permission === "granted" &&
    import.meta.env.VITE_FIREBASE_VAPID_KEY
  ) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const sdk = await import("firebase/messaging");
      messaging = sdk.getMessaging(firebaseApp);
      token = await sdk.getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration,
      });
    }
  }
  if (token) {
    await repository.request("/push/unregister", { token });
    const sdk = await import("firebase/messaging");
    await sdk.deleteToken(messaging);
    token = null;
  }
}
