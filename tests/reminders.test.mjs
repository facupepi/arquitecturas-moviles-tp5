import { test } from "node:test";
import assert from "node:assert/strict";
import { seed } from "../server/seed.mjs";
import { collectReminders } from "../server/reminders.mjs";
import { shouldAlert } from "../src/notificationPolicy.js";

const now = Date.parse("2026-10-06T12:00:00Z");
test("vencimientos tributarios: umbral, no duplicados, vencido y pago", () => {
  const state = seed(now);
  const due = collectReminders(state, now);
  assert.equal(due.length, 1);
  assert.match(due[0].key, /T-1001/);
  state.notifications.push(...due);
  assert.equal(collectReminders(state, now).length, 0);
  const expired = collectReminders(state, now + 3 * 86400000);
  assert.equal(expired[0].title, "Tenés un tributo vencido");
  state.taxes[0].paidAt = new Date(now).toISOString();
  assert.equal(collectReminders(state, now).length, 0);
});
test("estacionamiento avisa a cinco minutos, al finalizar y tras extender", () => {
  const state = seed(now);
  state.taxes = [];
  const session = {
    id: "session",
    plate: "AB123CD",
    zone: "Terminal",
    endsAt: new Date(now + 6 * 60000).toISOString(),
  };
  state.parking.push(session);
  assert.equal(collectReminders(state, now).length, 0);
  const alerts = collectReminders(state, now + 60000);
  assert.equal(alerts.length, 1);
  state.notifications.push(...alerts);
  assert.equal(collectReminders(state, now + 60000).length, 0);
  assert.equal(
    collectReminders(state, now + 7 * 60000)[0].title,
    "Tu estacionamiento finalizó",
  );
  session.endsAt = new Date(now + 21 * 60000).toISOString();
  assert.equal(collectReminders(state, now + 17 * 60000).length, 1);
});
test("alertas por tipo, frecuencia, suscripción y proximidad geográfica", () => {
  const preferences = {
    frequency: "Inmediata",
    types: ["Alarmas", "Tributos"],
    zones: ["Centro"],
  };
  const alarm = { type: "Alarmas", zone: "Parque", lat: -31.425, lng: -62.068 };
  assert.equal(shouldAlert(alarm, preferences, null), false);
  assert.equal(
    shouldAlert(alarm, preferences, { lat: -31.425, lng: -62.068 }),
    true,
  );
  assert.equal(shouldAlert(alarm, preferences, { lat: 0, lng: 0 }), false);
  assert.equal(
    shouldAlert({ ...alarm, zone: "Centro" }, preferences, null),
    true,
  );
  assert.equal(
    shouldAlert(
      alarm,
      { ...preferences, frequency: "Solo historial" },
      { lat: -31.425, lng: -62.068 },
    ),
    false,
  );
  assert.equal(
    shouldAlert({ type: "Tributos", zone: "Sur" }, preferences, null),
    true,
  );
});
