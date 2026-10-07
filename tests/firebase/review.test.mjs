import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
} from "@firebase/rules-unit-testing";
import { ref, uploadBytes, getBytes } from "firebase/storage";
import { createMunicipalService } from "../../functions/lib/service.mjs";

const require = createRequire(
  new URL("../../functions/package.json", import.meta.url),
);
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const projectId = "demo-conecta-tp5-test";
let app, db, bucket, service, rules;
const residents = [];
const request = (uid, data = {}, extra = {}) => ({
  auth: {
    uid,
    token: {
      name: "QA",
      firebase: { sign_in_provider: "google.com" },
      ...extra,
    },
  },
  data,
});
const admin = (data) => request("qa-admin", data, { municipalAdmin: true });
async function resident() {
  const uid = "qa-" + randomUUID();
  residents.push(uid);
  await service.bootstrapResident(request(uid));
  return uid;
}
before(async () => {
  assert.equal(
    process.env.FIRESTORE_EMULATOR_HOST,
    "127.0.0.1:8086",
    "Sólo emuladores del proyecto demo aislado",
  );
  app = initializeApp(
    { projectId, storageBucket: `${projectId}.firebasestorage.app` },
    "qa-review",
  );
  db = getFirestore(app);
  bucket = getStorage(app).bucket();
  service = createMunicipalService({ db, bucket });
  rules = await initializeTestEnvironment({
    projectId,
    storage: {
      host: "127.0.0.1",
      port: 9198,
      rules: readFileSync("storage.rules", "utf8"),
    },
  });
});
after(async () => {
  await rules?.cleanup();
  await deleteApp(app);
});

test("QA: rechaza identidad anónima aunque tenga UID", async () => {
  await assert.rejects(
    service.bootstrapResident(
      request(
        "anonymous-qa",
        {},
        { firebase: { sign_in_provider: "anonymous" } },
      ),
    ),
    (e) => e.code === "permission-denied",
  );
  assert.equal((await db.doc("usuarios/anonymous-qa").get()).exists, false);
});

test("QA: Storage niega escritura y lectura directa incluso al dueño", async () => {
  const uid = await resident();
  const data =
    "data:application/pdf;base64," +
    Buffer.from("%PDF-1.7 QA").toString("base64");
  const claim = await service.createClaim(
    request(uid, {
      category: "Otros",
      address: "Bv. 9 de Julio 1187",
      description: "Prueba de adjunto privado del tribunal.",
      attachments: [{ name: "qa.pdf", type: "application/pdf", data }],
      requestId: randomUUID(),
    }),
  );
  for (const context of [
    rules.authenticatedContext(uid),
    rules.authenticatedContext("otro-qa"),
    rules.unauthenticatedContext(),
  ]) {
    const storage = context.storage(`${projectId}.firebasestorage.app`);
    await assertFails(getBytes(ref(storage, claim.attachments[0].path)));
    await assertFails(
      uploadBytes(
        ref(storage, `usuarios/${uid}/reclamos/directo.pdf`),
        Buffer.from("%PDF-1.7 QA"),
      ),
    );
  }
  assert.equal(
    (
      await service.downloadClaimAttachment(
        request(uid, { id: claim.id, index: 0 }),
      )
    ).data,
    data,
  );
});

test("QA: dos extensiones concurrentes respetan el máximo y no cobran el rechazo", async () => {
  const uid = await resident();
  const session = await service.startParking(
    request(uid, {
      plate: "QA123AB",
      minutes: 225,
      zoneId: "p1",
      confirm: true,
      requestId: randomUUID(),
    }),
  );
  const results = await Promise.allSettled(
    [1, 2].map(() =>
      service.extendParking(
        request(uid, {
          id: session.id,
          minutes: 15,
          confirm: true,
          requestId: randomUUID(),
        }),
      ),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    results.find((r) => r.status === "rejected").reason.code,
    "invalid-argument",
  );
  const stored = (
    await db.doc(`usuarios/${uid}/estacionamiento/${session.id}`).get()
  ).data();
  assert.equal(stored.minutes, 240);
  assert.equal(stored.extensions.length, 1);
  assert.equal(stored.amount, 3200);
});

test("QA: una sesión vencida no se extiende ni cambia su recibo", async () => {
  const uid = await resident();
  const session = await service.startParking(
    request(uid, {
      plate: "QB123AB",
      minutes: 15,
      zoneId: "p1",
      confirm: true,
      requestId: randomUUID(),
    }),
  );
  const later = createMunicipalService({
    db,
    bucket,
    now: () => Date.parse(session.endsAt) + 1,
  });
  await assert.rejects(
    later.extendParking(
      request(uid, {
        id: session.id,
        minutes: 15,
        confirm: true,
        requestId: randomUUID(),
      }),
    ),
    (e) => e.code === "already-exists",
  );
  const stored = (
    await db.doc(`usuarios/${uid}/estacionamiento/${session.id}`).get()
  ).data();
  assert.equal(stored.minutes, 15);
  assert.equal(stored.amount, session.amount);
  assert.equal(stored.receipt, session.receipt);
});

test("QA: frecuencia y tipos también filtran push en el servidor", async () => {
  const uid = await resident();
  await service.registerPushToken(
    request(uid, { token: "qa-token-de-notificacion-1234567890" }),
  );
  const messages = [];
  const sender = createMunicipalService({
    db,
    bucket,
    messaging: {
      sendEachForMulticast: async (payload) => {
        messages.push(payload);
        return { responses: [{ success: true }], successCount: 1 };
      },
    },
  });
  const preferences = {
    types: ["Tributos"],
    zones: [],
    frequency: "Solo historial",
    desktop: true,
  };
  await service.savePreferences(request(uid, preferences));
  const tax = {
    id: "qa-aviso",
    type: "Tributos",
    zone: "Centro",
    title: "Vencimiento",
    body: "Revisá el cedulón",
    target: "tributos",
  };
  assert.deepEqual(await sender.deliverPush(uid, tax), { skipped: true });
  await service.savePreferences(
    request(uid, { ...preferences, frequency: "Inmediata" }),
  );
  assert.deepEqual(await sender.deliverPush(uid, { ...tax, type: "Eventos" }), {
    skipped: true,
  });
  assert.deepEqual(await sender.deliverPush(uid, tax), { sent: 1 });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].data.id, tax.id);
});

test("QA regresión: reintentar una alarma recupera el fanout que falló", async () => {
  const uid = await resident();
  await service.savePreferences(
    request(uid, {
      types: ["Alarmas"],
      zones: ["Centro"],
      frequency: "Inmediata",
      desktop: false,
    }),
  );
  await service.adminSetAlarm(admin({ id: "a1", active: false }));
  let failOnce = true;
  const wrapQuery = (query) =>
    new Proxy(query, {
      get(target, key) {
        if (key === "get")
          return async () => {
            if (failOnce) {
              failOnce = false;
              throw Object.assign(
                new Error("Interrupción de red en publicación"),
                { code: "UNAVAILABLE" },
              );
            }
            return target.get();
          };
        const value = target[key];
        if (["orderBy", "limit", "startAfter"].includes(key))
          return (...args) => wrapQuery(value.apply(target, args));
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  const interruptedDb = new Proxy(db, {
    get(target, key) {
      if (key === "collection")
        return (name) =>
          name === "usuarios"
            ? wrapQuery(target.collection(name))
            : target.collection(name);
      const value = target[key];
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const interrupted = createMunicipalService({ db: interruptedDb, bucket });
  await assert.rejects(
    interrupted.adminSetAlarm(admin({ id: "a1", active: true })),
    (e) => e.code === "internal",
  );
  await interrupted.adminSetAlarm(admin({ id: "a1", active: true }));
  const notifications = await db
    .collection(`usuarios/${uid}/notificaciones`)
    .get();
  assert.equal(
    notifications.docs.filter((d) => d.data().alarmId === "a1").length,
    1,
    "Una activación ya confirmada debe recuperar la publicación pendiente al reintentar",
  );
});

test("QA regresión: un requestId rechazado no deja otro archivo huérfano", async () => {
  const uid = await resident();
  const payload = {
    category: "Otros",
    address: "Bv. 9 de Julio 1187",
    description: "Adjunto original para verificar idempotencia.",
    attachments: [
      {
        name: "a.pdf",
        type: "application/pdf",
        data:
          "data:application/pdf;base64," +
          Buffer.from("%PDF-1.7 original").toString("base64"),
      },
    ],
    requestId: randomUUID(),
  };
  const original = await service.createClaim(request(uid, payload));
  await assert.rejects(
    service.createClaim(
      request(uid, {
        ...payload,
        attachments: [
          {
            ...payload.attachments[0],
            data:
              "data:application/pdf;base64," +
              Buffer.from("%PDF-1.7 modificado").toString("base64"),
          },
        ],
      }),
    ),
    (e) => e.code === "already-exists",
  );
  const [files] = await bucket.getFiles({
    prefix: `usuarios/${uid}/reclamos/${original.id}/`,
  });
  assert.equal(
    files.length,
    1,
    "El rechazo por idempotencia debe ocurrir antes de subir contenido alternativo",
  );
});
