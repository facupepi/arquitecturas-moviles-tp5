// Reglas temporales aisladas de HTTP para verificarlas con un reloj controlado.
export function collectReminders(state, now = Date.now()) {
  const alerts = [];
  for (const tax of state.taxes) {
    const left = Date.parse(tax.due) - now;
    if (tax.paidAt || left > 3 * 86400000) continue;
    const stage = left <= 0 ? "overdue" : "due";
    const key = `tax:${tax.id}:${tax.due}:${stage}`;
    if (state.notifications.some((n) => n.key === key)) continue;
    alerts.push({
      key,
      title:
        left <= 0 ? "Tenés un tributo vencido" : "Se acerca un vencimiento",
      body: `${tax.concept}, ${tax.id}. Vencimiento: ${new Date(tax.due).toLocaleDateString("es-AR")}.`,
      type: "Tributos",
      zone: "Centro",
      target: "tributos",
    });
  }
  for (const session of state.parking) {
    const left = Date.parse(session.endsAt) - now;
    const stage = left <= 0 ? "expired" : left <= 5 * 60000 ? "soon" : null;
    if (!stage) continue;
    const key = `parking:${session.id}:${session.endsAt}:${stage}`;
    if (state.notifications.some((n) => n.key === key)) continue;
    alerts.push({
      key,
      title:
        stage === "expired"
          ? "Tu estacionamiento finalizó"
          : "Tu estacionamiento está por vencer",
      body: `Patente ${session.plate}, ${session.zone}. ${stage === "expired" ? "Iniciá otra sesión si necesitás más tiempo." : "Quedan menos de cinco minutos. Podés extender la sesión."}`,
      type: "Estacionamiento",
      zone: session.subscriptionZone || "Centro",
      target: "estacionamiento",
    });
  }
  return alerts;
}
