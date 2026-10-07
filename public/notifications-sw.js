self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(
    "/#" + (event.notification.data?.target || "notificaciones"),
    self.location.origin,
  ).href;
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
