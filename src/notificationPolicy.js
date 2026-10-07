import { distanceKm } from "../server/domain.mjs";

export function shouldAlert(notification, preferences, position) {
  if (
    preferences.frequency !== "Inmediata" ||
    !preferences.types.includes(notification.type)
  )
    return false;
  if (["Tributos", "Estacionamiento", "Reclamos"].includes(notification.type))
    return true;
  const subscribed = preferences.zones.includes(notification.zone);
  const nearby =
    notification.type === "Alarmas" &&
    position &&
    Number.isFinite(notification.lat) &&
    Number.isFinite(notification.lng) &&
    distanceKm(position, notification) <= 1;
  return Boolean(subscribed || nearby);
}

export async function showBrowserNotification(notification) {
  if (!("Notification" in window) || Notification.permission !== "granted")
    return;
  const options = {
    body: notification.body,
    tag: notification.id,
    data: { target: notification.target },
  };
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.register("/notifications-sw.js");
    const ready = await navigator.serviceWorker.ready;
    await ready.showNotification(notification.title, options);
    return;
  }
  const alert = new Notification(notification.title, options);
  alert.onclick = () => {
    location.hash = notification.target;
    window.focus();
    alert.close();
  };
}
