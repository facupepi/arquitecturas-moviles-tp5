import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
  signInWithCredential,
  signOut,
} from "firebase/auth";
import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
} from "firebase/functions";
import {
  doc,
  getDoc,
  setDoc,
  getFirestore,
  connectFirestoreEmulator,
  terminate,
} from "firebase/firestore";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { createMunicipalService } from "../../functions/lib/service.mjs";
const require = createRequire(
  new URL("../../functions/package.json", import.meta.url),
);
const {
  initializeApp: adminApp,
  deleteApp: deleteAdmin,
} = require("firebase-admin/app");
const { getAuth: adminAuth } = require("firebase-admin/auth");
const { getFirestore: adminDb } = require("firebase-admin/firestore");
const { getStorage: adminStorage } = require("firebase-admin/storage");
const projectId = "demo-conecta-tp5-test",
  checks = [];
const emulatorPorts = { auth: 9098, functions: 5002, firestore: 8086 };
let root, db, bucket, service, rules;
const clients = [];
function googleToken(email, name) {
  return (
    [
      { alg: "none", typ: "JWT" },
      {
        iss: "https://accounts.google.com",
        aud: "test-google-client",
        sub: email,
        email,
        email_verified: true,
        name,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    ]
      .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
      .join(".") + "."
  );
}
async function client(email, name) {
  const app = initializeApp(
    {
      projectId,
      apiKey: "emulator-only",
      authDomain: `${projectId}.firebaseapp.com`,
    },
    randomUUID(),
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://127.0.0.1:${emulatorPorts.auth}`, {
    disableWarnings: true,
  });
  const functions = getFunctions(app, "southamerica-east1");
  connectFunctionsEmulator(functions, "127.0.0.1", emulatorPorts.functions);
  const firestore = getFirestore(app);
  connectFirestoreEmulator(firestore, "127.0.0.1", emulatorPorts.firestore);
  await signInWithCredential(
    auth,
    GoogleAuthProvider.credential(googleToken(email, name)),
  );
  const value = {
    app,
    auth,
    firestore,
    uid: auth.currentUser.uid,
    call: async (name, data = {}) =>
      (await httpsCallable(functions, name)(data)).data,
  };
  clients.push(value);
  await value.call("bootstrapResident");
  return value;
}
before(async () => {
  assert.equal(
    process.env.FIRESTORE_EMULATOR_HOST,
    "127.0.0.1:8086",
    "Estas pruebas requieren el entorno aislado; no usan producción.",
  );
  root = adminApp(
    { projectId, storageBucket: `${projectId}.firebasestorage.app` },
    "tests",
  );
  db = adminDb(root);
  bucket = adminStorage(root).bucket();
  service = createMunicipalService({ db, bucket });
  rules = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8086,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});
after(async () => {
  mkdirSync("test-results", { recursive: true });
  writeFileSync(
    "test-results/firebase.json",
    JSON.stringify(
      { at: new Date().toISOString(), projectId, checks },
      null,
      2,
    ),
  );
  await rules?.cleanup();
  await Promise.all(
    clients.map(async (c) => {
      await signOut(c.auth);
      await terminate(c.firestore);
      await deleteApp(c.app);
    }),
  );
  await deleteAdmin(root);
});
let a, b;
test("Google crea la cuenta una sola vez y separa los datos por UID", async () => {
  a = await client("vecino-a@example.test", "Vecino A");
  b = await client("vecino-b@example.test", "Vecino B");
  const stateA = await a.call("getMunicipalState"),
    stateB = await b.call("getMunicipalState");
  assert.notEqual(a.uid, b.uid);
  assert.equal(stateA.profile.uid, a.uid);
  assert.equal(stateB.profile.uid, b.uid);
  assert.equal(stateA.claims.length, 0);
  assert.equal(stateA.taxes.length, 3);
  await a.call("bootstrapResident");
  assert.equal((await a.call("getMunicipalState")).taxes.length, 3);
  checks.push("Google, alta idempotente y aislamiento de cuentas");
});
test("API real callable rechaza ausencia de sesión y UID inyectado", async () => {
  const response = await fetch(
    `http://127.0.0.1:5002/${projectId}/southamerica-east1/payTax`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: { id: "T-1001", confirm: true, requestId: "unauth-test-1" },
      }),
    },
  );
  assert.equal(response.status, 401);
  await assert.rejects(
    a.call("getMunicipalState", { uid: b.uid }),
    (e) => e.code === "functions/invalid-argument",
  );
  checks.push(
    "Autenticación obligatoria y rechazo de identidad enviada por cliente",
  );
});
let claim;
test("Reclamo persiste en Firestore y el archivo privado se conserva en Storage", async () => {
  const data = {
    category: "Bacheo",
    address: "Bv. 9 de Julio 1187",
    description: "Hay un bache profundo en esta cuadra.",
    attachments: [
      {
        name: "foto.pdf",
        type: "application/pdf",
        data:
          "data:application/pdf;base64," +
          Buffer.from("%PDF-1.7 prueba de reclamo").toString("base64"),
      },
    ],
    requestId: "claim-test-1",
  };
  claim = await a.call("createClaim", data);
  assert.equal(claim.status, "Recibido");
  assert.ok(claim.attachments[0].path);
  assert.equal(claim.attachments[0].data, undefined);
  const download = await a.call("downloadClaimAttachment", {
    id: claim.id,
    index: 0,
  });
  assert.equal(download.data, data.attachments[0].data);
  await assert.rejects(
    b.call("downloadClaimAttachment", { id: claim.id, index: 0 }),
    (e) => e.code === "functions/not-found",
  );
  const replay = await a.call("createClaim", data);
  assert.equal(replay.id, claim.id);
  assert.equal((await a.call("getMunicipalState")).claims.length, 1);
  await assert.rejects(
    a.call("createClaim", {
      ...data,
      description: "Otra descripción diferente de la anterior.",
    }),
    (e) => e.code === "functions/already-exists",
  );
  assert.equal(
    (await a.call("downloadClaimAttachment", { id: claim.id, index: 0 })).data,
    download.data,
  );
  assert.equal((await b.call("getMunicipalState")).claims.length, 0);
  checks.push(
    "Reclamos, adjuntos privados, idempotencia y rechazo de acceso ajeno",
  );
});
test("Reglas bloquean acceso ajeno, escrituras directas y documentos internos", async () => {
  const own = rules.authenticatedContext(a.uid).firestore(),
    other = rules.authenticatedContext(b.uid).firestore(),
    none = rules.unauthenticatedContext().firestore();
  await assertSucceeds(
    getDoc(doc(own, `usuarios/${a.uid}/reclamos/${claim.id}`)),
  );
  await assertFails(
    getDoc(doc(other, `usuarios/${a.uid}/reclamos/${claim.id}`)),
  );
  await assertFails(getDoc(doc(none, `usuarios/${a.uid}`)));
  await assertFails(
    setDoc(doc(own, `usuarios/${a.uid}/tributos/T-1001`), {
      paidAt: "inventado",
    }),
  );
  await assertFails(setDoc(doc(own, "municipal/catalogo"), { stations: [] }));
  await assertFails(
    getDoc(doc(own, `usuarios/${a.uid}/operaciones/claim-test-1`)),
  );
  checks.push("Reglas Firestore de dueño y escritura sólo mediante API");
});
test("Sólo personal autorizado puede avanzar reclamos y cambiar servicios", async () => {
  await assert.rejects(
    a.call("adminAdvanceClaim", {
      uid: a.uid,
      id: claim.id,
      status: "En proceso",
    }),
    (e) => e.code === "functions/permission-denied",
  );
  await assert.rejects(
    a.call("adminUpdateBikes", { id: "b1", bikes: 1 }),
    (e) => e.code === "functions/permission-denied",
  );
  await adminAuth(root).setCustomUserClaims(b.uid, { municipalAdmin: true });
  await b.auth.currentUser.getIdToken(true);
  await assert.rejects(
    b.call("adminAdvanceClaim", {
      uid: a.uid,
      id: claim.id,
      status: "Resuelto",
    }),
    (e) => e.code === "functions/already-exists",
  );
  const result = await b.call("adminAdvanceClaim", {
    uid: a.uid,
    id: claim.id,
    status: "En proceso",
  });
  assert.equal(result.history.length, 2);
  const bike = await b.call("adminUpdateBikes", { id: "b1", bikes: 4 });
  assert.equal(bike.bikes, 4);
  await assert.rejects(
    b.call("adminUpdateBikes", { id: "b1", bikes: 999 }),
    (e) => e.code === "functions/invalid-argument",
  );
  checks.push("Roles, progresión válida del reclamo y stock validado");
});
test("Pago concurrente calcula el importe en el servidor y genera un comprobante", async () => {
  await assert.rejects(
    a.call("payTax", { id: "T-1001", requestId: "tax-test-1" }),
    (e) => e.code === "functions/invalid-argument",
  );
  await assert.rejects(
    a.call("payTax", {
      id: "T-1001",
      amount: 1,
      confirm: true,
      requestId: "tax-test-2",
    }),
    (e) => e.code === "functions/invalid-argument",
  );
  const results = await Promise.all([
    a.call("payTax", { id: "T-1001", confirm: true, requestId: "tax-test-3" }),
    a.call("payTax", { id: "T-1001", confirm: true, requestId: "tax-test-4" }),
  ]);
  assert.equal(results[0].receipt, results[1].receipt);
  assert.equal(results[0].amount, 18500);
  assert.equal(
    (await a.call("getMunicipalState")).notifications.filter(
      (n) => n.title === "Pago registrado",
    ).length,
    1,
  );
  assert.equal(
    (await b.call("getMunicipalState")).taxes.find((t) => t.id === "T-1001")
      .paidAt,
    null,
  );
  checks.push("Pago concurrente, tarifa del servidor y comprobante único");
});
let parking;
test("Estacionamiento impide dos sesiones activas para la misma patente entre cuentas", async () => {
  const input = {
    plate: "AB123CD",
    minutes: 60,
    zoneId: "p1",
    confirm: true,
    requestId: "park-test-1",
  };
  const results = await Promise.allSettled([
    a.call("startParking", input),
    b.call("startParking", input),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    results.find((r) => r.status === "rejected").reason.code,
    "functions/already-exists",
  );
  const winner = results[0].status === "fulfilled" ? a : b;
  parking = await winner.call("startParking", {
    ...input,
    plate: "AC123CD",
    requestId: "park-test-2",
  });
  assert.equal(parking.amount, 800);
  const extended = await winner.call("extendParking", {
    id: parking.id,
    minutes: 15,
    confirm: true,
    requestId: "extend-test-1",
  });
  const replay = await winner.call("extendParking", {
    id: parking.id,
    minutes: 15,
    confirm: true,
    requestId: "extend-test-1",
  });
  assert.equal(extended.minutes, 75);
  assert.equal(replay.amount, 1000);
  assert.equal(replay.endsAt, extended.endsAt);
  await assert.rejects(
    winner.call("extendParking", {
      id: parking.id,
      minutes: 240,
      confirm: true,
      requestId: "extend-test-2",
    }),
    (e) => e.code === "functions/invalid-argument",
  );
  checks.push("Exclusión de patente entre vecinos y extensión idempotente");
});
test("Preferencias, alarmas por zona y recordatorios automáticos sin duplicados", async () => {
  await a.call("savePreferences", {
    types: ["Alarmas"],
    zones: ["Parque"],
    frequency: "Inmediata",
    desktop: false,
  });
  await b.call("adminSetAlarm", { id: "a2", active: true });
  await b.call("adminSetAlarm", { id: "a2", active: true });
  const state = await a.call("getMunicipalState");
  assert.equal(
    state.notifications.filter(
      (n) => n.type === "Alarmas" && n.zone === "Parque",
    ).length,
    1,
  );
  await service.processReminders(a.uid);
  await service.processReminders(a.uid);
  const rows = (await a.call("getMunicipalState")).notifications;
  assert.equal(rows.filter((n) => n.key?.startsWith("tax:T-1001")).length, 1);
  const pref = await a.call("savePreferences", {
    types: ["Tributos"],
    zones: ["Centro"],
    frequency: "Solo historial",
    desktop: false,
  });
  assert.equal(pref.frequency, "Solo historial");
  checks.push(
    "Suscripción de zonas, activación sin duplicados y recordatorios",
  );
});
test("Valida firmas de adjuntos, patentes y campos antes de persistir", async () => {
  const invalid = [
    a.call("createClaim", {
      category: "Bacheo",
      address: "x",
      description: "corta",
      requestId: "invalid-test-1",
    }),
    a.call("startParking", {
      plate: "BAD",
      minutes: 60,
      zoneId: "p1",
      confirm: true,
      requestId: "invalid-test-2",
    }),
    a.call("createClaim", {
      category: "Bacheo",
      address: "Bv. 9 de Julio 100",
      description: "Hay un problema en esta esquina.",
      attachments: [
        {
          name: "x.pdf",
          type: "application/pdf",
          data:
            "data:application/pdf;base64," +
            Buffer.from("esto no es PDF").toString("base64"),
        },
      ],
      requestId: "invalid-test-3",
    }),
  ];
  for (const result of await Promise.allSettled(invalid)) {
    assert.equal(result.status, "rejected");
    assert.equal(result.reason.code, "functions/invalid-argument");
  }
  checks.push("Validación del contrato y contenido real del adjunto");
});
test("Cercanía permite recibir una alarma fuera de la zona elegida sin guardar coordenadas", async () => {
  await a.call("savePreferences", {
    types: ["Alarmas"],
    zones: ["Centro"],
    frequency: "Inmediata",
    desktop: false,
  });
  await a.call("subscribeNearbyAlarms", { alarmIds: ["a2"] });
  await b.call("adminSetAlarm", { id: "a2", active: false });
  await b.call("adminSetAlarm", { id: "a2", active: true });
  const row = (
    await db.doc(`usuarios/${a.uid}/configuracion/cercania`).get()
  ).data();
  assert.deepEqual(Object.keys(row).sort(), ["alarmIds", "expiresAt"]);
  assert.equal(
    (await a.call("getMunicipalState")).notifications.filter(
      (n) => n.alarmId === "a2",
    ).length,
    2,
  );
  checks.push("Cercanía con vigencia corta y sin coordenadas persistidas");
});
test("Un dispositivo cambia de dueño al cambiar de cuenta y puede revocar push", async () => {
  const token = "token-del-dispositivo-de-prueba-123456789";
  await a.call("registerPushToken", { token });
  await b.call("registerPushToken", { token });
  assert.equal(
    (await db.collection(`usuarios/${a.uid}/dispositivos`).get()).size,
    0,
  );
  assert.equal(
    (await db.collection(`usuarios/${b.uid}/dispositivos`).get()).size,
    1,
  );
  await b.call("unregisterPushToken", { token });
  assert.equal(
    (await db.collection(`usuarios/${b.uid}/dispositivos`).get()).size,
    0,
  );
  checks.push(
    "Token push único por dispositivo, cambio de cuenta y revocación",
  );
});
test("Historia paginada conserva orden, empates y aislamiento más allá de 150 registros", async () => {
  const c = await client("historial-qa@example.test", "Historial QA");
  const kinds = {
    claims: ["reclamos", "createdAt"],
    taxes: ["tributos", "due"],
    parking: ["estacionamiento", "startedAt"],
    notifications: ["notificaciones", "createdAt"],
  };
  for (const [kind, [collection, field]] of Object.entries(kinds)) {
    const batch = db.batch(),
      ref = db.collection(`usuarios/${c.uid}/${collection}`);
    for (const existing of (await ref.get()).docs) batch.delete(existing.ref);
    for (let i = 0; i < 154; i++) {
      const id = `${kind}-${String(i).padStart(4, "0")}`;
      batch.set(ref.doc(id), {
        id,
        marker: "historial-qa-privado",
        [field]: new Date(
          Date.UTC(2024, 0, 1) + Math.floor(i / 4) * 1000,
        ).toISOString(),
        paidAt: "2024-01-01T00:00:00.000Z",
        endsAt: "2030-01-01T00:00:00.000Z",
        title: "Registro histórico QA",
        type: "Eventos",
        zone: "Centro",
        target: "notificaciones",
        read: false,
      });
    }
    await batch.commit();
  }
  const state = await c.call("getMunicipalState");
  for (const kind of Object.keys(kinds)) {
    assert.equal(state[kind].length, 150);
    assert.ok(state.historyCursors[kind]);
    const older = await c.call("getResidentHistory", {
      kind,
      cursor: state.historyCursors[kind],
    });
    assert.equal(older.items.length, 4);
    assert.equal(older.nextCursor, null);
    const first = await c.call("getResidentHistory", { kind });
    assert.equal(first.items.length, 50);
    assert.equal(first.items[0].id, state[kind][0].id);
    const second = await c.call("getResidentHistory", {
      kind,
      cursor: first.nextCursor,
      limit: 100,
    });
    const third = await c.call("getResidentHistory", {
      kind,
      cursor: second.nextCursor,
    });
    const all = [...first.items, ...second.items, ...third.items];
    assert.equal(all.length, 154);
    assert.equal(new Set(all.map((x) => x.id)).size, 154);
    assert.deepEqual(
      all.map((x) => x.id),
      [...all]
        .sort(
          (x, y) =>
            String(y[kinds[kind][1]]).localeCompare(
              String(x[kinds[kind][1]]),
            ) || y.id.localeCompare(x.id),
        )
        .map((x) => x.id),
    );
    assert.equal(
      (await a.call("getResidentHistory", { kind })).items.some(
        (x) => x.marker === "historial-qa-privado",
      ),
      false,
    );
  }
  for (const bad of [
    { kind: "otras" },
    { kind: "claims", limit: 101 },
    { kind: "claims", limit: 1.5 },
    { kind: "claims", cursor: { value: "fecha mala", id: "x" } },
    {
      kind: "claims",
      cursor: { value: "2024-01-01T00:00:00.000Z", id: "a/b" },
    },
    {
      kind: "claims",
      cursor: { value: "2024-01-01T00:00:00.000Z", id: "a", uid: a.uid },
    },
    { kind: "claims", uid: a.uid },
  ]) {
    await assert.rejects(
      c.call("getResidentHistory", bad),
      (e) => e.code === "functions/invalid-argument",
    );
  }
  checks.push(
    "Historia completa por cursor, empates de fecha, contrato validado y UID aislado",
  );
});
