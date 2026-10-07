import { randomUUID, createHash } from "node:crypto";
import { HttpsError } from "firebase-functions/v2/https";
import {
  DomainError,
  required,
  member,
  categories,
  zones,
  minutes,
  plate,
  parkingCost,
  validateAttachments,
} from "./domain.mjs";
import { seed } from "./seed.mjs";
import { collectReminders } from "./reminders.mjs";

const types = [
  "Obras",
  "Servicios",
  "Eventos",
  "Alarmas",
  "Tributos",
  "Estacionamiento",
  "Reclamos",
];
const personalTypes = ["Tributos", "Estacionamiento", "Reclamos"];
const collections = {
  claims: "reclamos",
  taxes: "tributos",
  parking: "estacionamiento",
  notifications: "notificaciones",
};
const dateFields = {
  claims: "createdAt",
  taxes: "due",
  parking: "startedAt",
  notifications: "createdAt",
};
const digest = (value) => createHash("sha256").update(value).digest("hex");
const sortDate = (field) => (a, b) =>
  String(b[field]).localeCompare(String(a[field]));
const notice = (title, body, type, zone, target, timestamp, extra = {}) => ({
  id: randomUUID(),
  title,
  body,
  type,
  zone,
  target,
  createdAt: timestamp,
  read: false,
  ...extra,
});

export function createMunicipalService({
  db,
  bucket,
  messaging,
  now = () => Date.now(),
}) {
  const resident = (uid) => db.doc(`usuarios/${uid}`);
  const catalog = db.doc("municipal/catalogo");
  const events = db.collection("municipalEvents");
  const item = (uid, kind, id) =>
    resident(uid).collection(collections[kind]).doc(id);
  function identity(request, admin = false) {
    if (!request.auth?.uid)
      throw new HttpsError(
        "unauthenticated",
        "Ingresá con tu cuenta de Google.",
      );
    if (admin && request.auth.token.municipalAdmin !== true)
      throw new HttpsError(
        "permission-denied",
        "Esta operación corresponde al personal municipal.",
      );
    if (
      !admin &&
      request.auth.token.firebase?.sign_in_provider !== "google.com"
    )
      throw new HttpsError(
        "permission-denied",
        "Usá una cuenta de Google para ingresar.",
      );
    return request.auth.uid;
  }
  function input(request, allowed = []) {
    const data = request.data || {};
    if (typeof data !== "object" || Array.isArray(data))
      throw new DomainError("Solicitud inválida.");
    if (Object.keys(data).some((k) => !allowed.includes(k)))
      throw new DomainError("La solicitud contiene campos no admitidos.");
    return data;
  }
  async function run(fn) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      if (e instanceof DomainError)
        throw new HttpsError(
          { 403: "permission-denied", 404: "not-found", 409: "already-exists" }[
            e.status
          ] || "invalid-argument",
          e.message,
        );
      console.error("Operación municipal rechazada:", e.code || e.name);
      throw new HttpsError(
        "internal",
        "No se pudo completar la operación. Intentá nuevamente.",
      );
    }
  }
  const find = async (tx, ref) => {
    const doc = await tx.get(ref);
    if (!doc.exists) throw new DomainError("Registro no encontrado.", 404);
    return doc.data();
  };
  // La clave se conserva en Firestore, incluso entre reinicios. Un reintento no
  // vuelve a cobrar ni crea otra sesión; reutilizarla con otra carga se rechaza.
  function operationIdentity(uid, name, data) {
    const requestId = required(
      data.requestId,
      "Identificador de operación",
      8,
      80,
    );
    if (!/^[a-zA-Z0-9_-]+$/.test(requestId))
      throw new DomainError("Identificador de operación inválido.");
    const op = resident(uid).collection("operaciones").doc(requestId);
    const hash = digest(JSON.stringify({ name, data }));
    return { op, hash };
  }
  async function reserveOperation(uid, name, data) {
    const { op, hash } = operationIdentity(uid, name, data);
    return db.runTransaction(async (tx) => {
      const previous = await tx.get(op);
      if (previous.exists) {
        if (previous.data().hash !== hash)
          throw new DomainError(
            "La operación ya fue utilizada con otros datos.",
            409,
          );
        return previous.data().result || null;
      }
      tx.create(op, {
        name,
        hash,
        status: "pending",
        createdAt: new Date(now()).toISOString(),
      });
      return null;
    });
  }
  async function operation(uid, name, data, execute) {
    const { op, hash } = operationIdentity(uid, name, data);
    return db.runTransaction(async (tx) => {
      const previous = await tx.get(op);
      if (previous.exists) {
        if (previous.data().hash !== hash)
          throw new DomainError(
            "La operación ya fue utilizada con otros datos.",
            409,
          );
        if (previous.data().status !== "pending") return previous.data().result;
      }
      const timestamp = new Date(now()).toISOString();
      const result = await execute(tx, timestamp);
      tx.set(op, {
        name,
        hash,
        status: "complete",
        result,
        createdAt: timestamp,
      });
      tx.set(resident(uid), { updatedAt: timestamp }, { merge: true });
      return result;
    });
  }
  function addNotice(tx, uid, value) {
    tx.set(item(uid, "notifications", value.id), value);
  }
  function confirmed(data) {
    if (data.confirm !== true) throw new DomainError("Confirmá el pago.");
  }
  function payment(reference, amount, timestamp) {
    // Adaptador del servicio no disponible. El importe nace del catálogo del
    // servidor y nunca del navegador. No recibe tarjetas ni genera cargos reales.
    return {
      receipt: `${reference}-${randomUUID().slice(0, 8).toUpperCase()}`,
      amount,
      paidAt: timestamp,
      provider: "municipal-test-gateway",
    };
  }
  async function initializeCatalog() {
    const config = seed(now());
    const value = Object.fromEntries(
      [
        "municipal",
        "places",
        "stations",
        "alarms",
        "contacts",
        "parkingZones",
      ].map((k) => [k, config[k]]),
    );
    value.parkingZones = value.parkingZones.map((z) => ({
      ...z,
      path: z.path?.map(([lat, lng]) => ({ lat, lng })),
    }));
    await db.runTransaction(async (tx) => {
      if (!(await tx.get(catalog)).exists)
        tx.create(catalog, {
          ...value,
          updatedAt: new Date(now()).toISOString(),
        });
    });
  }
  async function bootstrapResident(request) {
    const uid = identity(request);
    input(request);
    await initializeCatalog();
    await db.runTransaction(async (tx) => {
      const ref = resident(uid);
      const existing = await tx.get(ref);
      const timestamp = new Date(now()).toISOString();
      if (existing.exists) {
        tx.update(ref, {
          displayName: request.auth.token.name || "Vecino",
          updatedAt: timestamp,
        });
        return;
      }
      tx.create(ref, {
        uid,
        displayName: request.auth.token.name || "Vecino",
        email: request.auth.token.email || "",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      const initial = seed(now());
      // Obligaciones ficticias del proveedor tributario de práctica; cada vecino
      // tiene documentos distintos. No se importan operaciones del archivo viejo.
      for (const tax of initial.taxes)
        tx.create(item(uid, "taxes", tax.id), tax);
      tx.create(
        ref.collection("configuracion").doc("preferencias"),
        initial.preferences,
      );
      for (const n of initial.notifications.filter(
        (n) => !personalTypes.includes(n.type),
      ))
        tx.create(item(uid, "notifications", n.id), n);
    });
    return { uid };
  }
  async function getMunicipalState(request) {
    const uid = identity(request);
    input(request);
    await processReminders(uid);
    const [configuration, profile, preferences, ...lists] = await Promise.all([
      catalog.get(),
      resident(uid).get(),
      resident(uid).collection("configuracion").doc("preferencias").get(),
      ...Object.keys(collections).map((kind) =>
        historyQuery(uid, kind).limit(151).get(),
      ),
    ]);
    if (!profile.exists)
      throw new HttpsError(
        "failed-precondition",
        "La cuenta todavía no está preparada. Volvé a ingresar.",
      );
    const result = {
      ...configuration.data(),
      profile: profile.data(),
      preferences: preferences.data(),
      version: 2,
      historyCursors: {},
    };
    result.parkingZones = result.parkingZones.map((z) => ({
      ...z,
      path: z.path?.map((p) => [p.lat, p.lng]),
    }));
    Object.keys(collections).forEach((k, i) => {
      const page = historyPage(lists[i], k, 150);
      result[k] = page.items;
      result.historyCursors[k] = page.nextCursor;
    });
    return result;
  }
  function historyQuery(uid, kind) {
    return resident(uid)
      .collection(collections[kind])
      .orderBy(dateFields[kind], "desc")
      .orderBy("__name__", "desc");
  }
  function historyPage(snapshot, kind, size) {
    const docs = snapshot.docs.slice(0, size);
    const last = docs.at(-1);
    return {
      items: docs.map((d) => ({ ...d.data(), id: d.id })),
      nextCursor:
        snapshot.size > size && last
          ? { value: last.data()[dateFields[kind]], id: last.id }
          : null,
    };
  }
  async function getResidentHistory(request) {
    const uid = identity(request),
      data = input(request, ["kind", "cursor", "limit"]);
    const kind = member(data.kind, Object.keys(collections), "Historial"),
      size = data.limit ?? 50;
    if (!Number.isInteger(size) || size < 1 || size > 100)
      throw new DomainError(
        "El historial admite entre 1 y 100 registros por página.",
      );
    let query = historyQuery(uid, kind);
    if (data.cursor != null) {
      const cursor = data.cursor;
      if (
        typeof cursor !== "object" ||
        Array.isArray(cursor) ||
        Object.keys(cursor).sort().join(",") !== "id,value"
      )
        throw new DomainError("Cursor de historial inválido.");
      const value = required(cursor.value, "Fecha del cursor", 20, 40),
        id = required(cursor.id, "Registro del cursor", 1, 1500);
      if (!Number.isFinite(Date.parse(value)) || id.includes("/"))
        throw new DomainError("Cursor de historial inválido.");
      query = query.startAfter(value, id);
    }
    return historyPage(await query.limit(size + 1).get(), kind, size);
  }
  async function createClaim(request) {
    const uid = identity(request);
    const data = input(request, [
      "category",
      "address",
      "description",
      "attachments",
      "requestId",
    ]);
    const key = required(data.requestId, "Identificador de operación", 8, 80);
    if (!/^[a-zA-Z0-9_-]+$/.test(key))
      throw new DomainError("Identificador de operación inválido.");
    const valid = {
      category: member(data.category, categories, "Categoría"),
      address: required(data.address, "Ubicación", 5, 160),
      description: required(data.description, "Descripción", 10, 1500),
      attachments: validateAttachments(data.attachments),
    };
    // Reserva atómica antes de Storage: otro contenido con el mismo requestId
    // se rechaza sin escribir archivos. Un fallo de subida conserva una reserva
    // recuperable con la misma carga y los reintentos completos no vuelven a subir.
    const replay = await reserveOperation(uid, "createClaim", data);
    if (replay) return replay;
    const id =
      "R-" + digest(`${uid}:${data.requestId}`).slice(0, 12).toUpperCase();
    const files = valid.attachments.map((f, i) => ({
      name: f.name,
      type: f.type,
      size: f.size,
      path: `usuarios/${uid}/reclamos/${id}/${digest(f.data).slice(0, 20)}-${i}`,
    }));
    // Datos binarios en Storage, no dentro de documentos Firestore (límite 1 MiB).
    await Promise.all(
      valid.attachments.map((f, i) =>
        bucket
          .file(files[i].path)
          .save(Buffer.from(f.data.split(",")[1], "base64"), {
            resumable: false,
            metadata: { contentType: f.type },
          }),
      ),
    );
    return operation(uid, "createClaim", data, async (tx, timestamp) => {
      const result = {
        id,
        category: valid.category,
        address: valid.address,
        description: valid.description,
        attachments: files,
        status: "Recibido",
        createdAt: timestamp,
        history: [{ status: "Recibido", date: timestamp }],
      };
      tx.create(item(uid, "claims", id), result);
      addNotice(
        tx,
        uid,
        notice(
          "Reclamo recibido",
          `Registramos ${id}. Podés seguir su estado.`,
          "Reclamos",
          "Centro",
          "reclamos",
          timestamp,
        ),
      );
      return result;
    });
  }
  async function downloadClaimAttachment(request) {
    const uid = identity(request);
    const data = input(request, ["id", "index", "requestId"]);
    const id = required(data.id, "Reclamo", 1, 80);
    const claim = await item(uid, "claims", id).get();
    if (!claim.exists) throw new DomainError("Reclamo no encontrado.", 404);
    if (!Number.isInteger(data.index) || !claim.data().attachments[data.index])
      throw new DomainError("Adjunto no encontrado.", 404);
    const attachment = claim.data().attachments[data.index];
    const [bytes] = await bucket.file(attachment.path).download();
    return {
      name: attachment.name,
      type: attachment.type,
      data: `data:${attachment.type};base64,${bytes.toString("base64")}`,
    };
  }
  async function payTax(request) {
    const uid = identity(request);
    const data = input(request, ["id", "confirm", "requestId"]);
    confirmed(data);
    const ref = item(uid, "taxes", required(data.id, "Cedulón", 1, 80));
    return operation(uid, "payTax", data, async (tx, timestamp) => {
      const tax = await find(tx, ref);
      if (tax.paidAt) return tax;
      const result = { ...tax, ...payment("REC", tax.amount, timestamp) };
      tx.update(ref, result);
      addNotice(
        tx,
        uid,
        notice(
          "Pago registrado",
          `${tax.concept}: comprobante ${result.receipt}.`,
          "Tributos",
          "Centro",
          "tributos",
          timestamp,
        ),
      );
      return result;
    });
  }
  async function startParking(request) {
    const uid = identity(request),
      data = input(request, [
        "plate",
        "minutes",
        "zoneId",
        "confirm",
        "requestId",
      ]);
    confirmed(data);
    const p = plate(data.plate),
      duration = minutes(data.minutes);
    return operation(uid, "startParking", data, async (tx, timestamp) => {
      const configuration = await find(tx, catalog),
        zone = configuration.parkingZones.find((z) => z.id === data.zoneId);
      if (!zone)
        throw new DomainError(
          "Ubicación de estacionamiento no encontrada.",
          404,
        );
      const lock = db.doc(`parkingLocks/${p}`),
        existing = await tx.get(lock);
      if (existing.exists && Date.parse(existing.data().endsAt) > now())
        throw new DomainError("La patente ya tiene una sesión activa.", 409);
      const amount = parkingCost(zone.rate, duration),
        charge = payment("EST", amount, timestamp);
      const result = {
        id: randomUUID(),
        plate: p,
        zoneId: zone.id,
        zone: zone.name,
        subscriptionZone: zone.zone,
        address: zone.address || zone.landmark,
        startedAt: timestamp,
        endsAt: new Date(now() + duration * 60000).toISOString(),
        minutes: duration,
        ...charge,
      };
      tx.create(item(uid, "parking", result.id), result);
      tx.set(lock, { uid, id: result.id, endsAt: result.endsAt });
      return result;
    });
  }
  async function extendParking(request) {
    const uid = identity(request),
      data = input(request, ["id", "minutes", "confirm", "requestId"]);
    confirmed(data);
    const duration = minutes(data.minutes),
      ref = item(uid, "parking", required(data.id, "Sesión", 1, 80));
    return operation(uid, "extendParking", data, async (tx, timestamp) => {
      const session = await find(tx, ref),
        configuration = await find(tx, catalog);
      if (Date.parse(session.endsAt) <= now())
        throw new DomainError("La sesión venció. Iniciá otra.", 409);
      if (session.minutes + duration > 240)
        throw new DomainError("El máximo por sesión es de 240 minutos.");
      const zone = configuration.parkingZones.find(
        (z) => z.id === session.zoneId,
      );
      const charge = payment(
        "EXT",
        parkingCost(zone.rate, duration),
        timestamp,
      );
      const result = {
        ...session,
        endsAt: new Date(
          Date.parse(session.endsAt) + duration * 60000,
        ).toISOString(),
        minutes: session.minutes + duration,
        amount: session.amount + charge.amount,
        extensions: [...(session.extensions || []), charge],
      };
      tx.update(ref, result);
      tx.set(db.doc(`parkingLocks/${session.plate}`), {
        uid,
        id: session.id,
        endsAt: result.endsAt,
      });
      return result;
    });
  }
  async function savePreferences(request) {
    const uid = identity(request),
      data = input(request, [
        "types",
        "zones",
        "frequency",
        "desktop",
        "requestId",
      ]);
    if (
      !Array.isArray(data.types) ||
      !Array.isArray(data.zones) ||
      typeof data.desktop !== "boolean"
    )
      throw new DomainError("Preferencias inválidas.");
    const result = {
      types: [...new Set(data.types.map((t) => member(t, types, "Tipo")))],
      zones: [...new Set(data.zones.map((z) => member(z, zones, "Zona")))],
      frequency: member(
        data.frequency,
        ["Inmediata", "Solo historial"],
        "Frecuencia",
      ),
      desktop: data.desktop,
    };
    await resident(uid)
      .collection("configuracion")
      .doc("preferencias")
      .set(result);
    return result;
  }
  async function markNotificationRead(request) {
    const uid = identity(request),
      data = input(request, ["id", "requestId"]),
      ref = item(uid, "notifications", required(data.id, "Aviso", 1, 80));
    return db.runTransaction(async (tx) => {
      await find(tx, ref);
      tx.update(ref, { read: true });
      return { ok: true };
    });
  }
  async function registerPushToken(request) {
    const uid = identity(request),
      data = input(request, ["token", "requestId"]),
      token = required(data.token, "Token de notificaciones", 20, 4096);
    const id = digest(token),
      ref = db.doc(`pushTokens/${id}`);
    await db.runTransaction(async (tx) => {
      const previous = await tx.get(ref),
        timestamp = new Date(now()).toISOString();
      if (previous.exists && previous.data().uid !== uid)
        tx.delete(
          resident(previous.data().uid).collection("dispositivos").doc(id),
        );
      tx.set(ref, { uid, updatedAt: timestamp });
      tx.set(resident(uid).collection("dispositivos").doc(id), {
        token,
        updatedAt: timestamp,
      });
    });
    return { ok: true };
  }
  async function subscribeNearbyAlarms(request) {
    const uid = identity(request),
      data = input(request, ["alarmIds", "requestId"]);
    if (!Array.isArray(data.alarmIds) || data.alarmIds.length > 20)
      throw new DomainError("Suscripción de cercanía inválida.");
    const value = (await catalog.get()).data();
    const ids = [
      ...new Set(
        data.alarmIds.map((id) =>
          member(
            id,
            value.alarms.map((a) => a.id),
            "Alarma",
          ),
        ),
      ),
    ];
    // Se guardan IDs de alarmas cercanas y una vigencia corta, nunca coordenadas
    // ni recorridos del vecino. La selección nace de su solicitud de ubicación.
    await resident(uid)
      .collection("configuracion")
      .doc("cercania")
      .set({
        alarmIds: ids,
        expiresAt: new Date(now() + 15 * 60000).toISOString(),
      });
    return { ok: true };
  }
  async function unregisterPushToken(request) {
    const uid = identity(request),
      data = input(request, ["token", "requestId"]),
      token = required(data.token, "Token de notificaciones", 20, 4096);
    const id = digest(token),
      ref = db.doc(`pushTokens/${id}`);
    await db.runTransaction(async (tx) => {
      const previous = await tx.get(ref);
      tx.delete(resident(uid).collection("dispositivos").doc(id));
      if (previous.data()?.uid === uid) tx.delete(ref);
    });
    return { ok: true };
  }
  async function processReminders(uid) {
    const ref = resident(uid);
    const [taxes, parking, notifications] = await Promise.all(
      ["tributos", "estacionamiento", "notificaciones"].map((c) =>
        ref.collection(c).get(),
      ),
    );
    const alerts = collectReminders(
      {
        taxes: taxes.docs.map((d) => d.data()),
        parking: parking.docs.map((d) => d.data()),
        notifications: notifications.docs.map((d) => d.data()),
      },
      now(),
    );
    if (!alerts.length) return;
    const timestamp = new Date(now()).toISOString();
    await db.runTransaction(async (tx) => {
      const refs = alerts.map((a) =>
        item(uid, "notifications", digest(a.key).slice(0, 32)),
      );
      const docs = await tx.getAll(...refs);
      alerts.forEach((a, i) => {
        if (!docs[i].exists)
          tx.create(refs[i], {
            ...a,
            id: refs[i].id,
            createdAt: timestamp,
            read: false,
          });
      });
    });
  }
  async function processAllReminders() {
    await processPendingMunicipalEvents();
    // Paginado para no cargar toda la ciudad en una sola ejecución.
    let last;
    do {
      let query = db.collection("usuarios").orderBy("__name__").limit(100);
      if (last) query = query.startAfter(last);
      const page = await query.get();
      await Promise.all(page.docs.map((d) => processReminders(d.id)));
      last = page.size === 100 ? page.docs.at(-1) : null;
    } while (last);
  }
  async function adminAdvanceClaim(request) {
    identity(request, true);
    const data = input(request, ["uid", "id", "status"]);
    const uid = required(data.uid, "Vecino", 1, 128),
      ref = item(uid, "claims", required(data.id, "Reclamo", 1, 80));
    return db.runTransaction(async (tx) => {
      const claim = await find(tx, ref),
        steps = ["Recibido", "En proceso", "Resuelto"];
      const status = member(data.status, steps, "Estado");
      if (steps.indexOf(status) !== steps.indexOf(claim.status) + 1)
        throw new DomainError(
          "El reclamo debe avanzar al siguiente estado.",
          409,
        );
      const timestamp = new Date(now()).toISOString(),
        result = {
          ...claim,
          status,
          history: [...claim.history, { status, date: timestamp }],
        };
      tx.update(ref, result);
      addNotice(
        tx,
        uid,
        notice(
          "Avance de tu reclamo",
          `${claim.id}: ${status}.`,
          "Reclamos",
          "Centro",
          "reclamos",
          timestamp,
        ),
      );
      return result;
    });
  }
  async function adminUpdateBikes(request) {
    identity(request, true);
    const data = input(request, ["id", "bikes"]);
    return db.runTransaction(async (tx) => {
      const value = await find(tx, catalog),
        station = value.stations.find((s) => s.id === data.id);
      if (!station) throw new DomainError("Estación no encontrada.", 404);
      if (
        !Number.isInteger(data.bikes) ||
        data.bikes < 0 ||
        data.bikes > station.capacity
      )
        throw new DomainError("Disponibilidad inválida.");
      station.bikes = data.bikes;
      station.updatedAt = new Date(now()).toISOString();
      tx.update(catalog, {
        stations: value.stations,
        updatedAt: station.updatedAt,
      });
      return station;
    });
  }
  async function publishToResidents(value) {
    let last;
    do {
      let query = db.collection("usuarios").orderBy("__name__").limit(100);
      if (last) query = query.startAfter(last);
      const page = await query.get();
      await Promise.all(
        page.docs.map(async (d) => {
          const pref = await d.ref
            .collection("configuracion")
            .doc("preferencias")
            .get();
          const nearby = (
            await d.ref.collection("configuracion").doc("cercania").get()
          ).data();
          const close =
            value.type === "Alarmas" &&
            nearby?.alarmIds.includes(value.alarmId) &&
            Date.parse(nearby.expiresAt) > now();
          if (
            pref.data()?.types.includes(value.type) &&
            (pref.data()?.zones.includes(value.zone) || close)
          )
            try {
              // create preserva un aviso ya leído y evita otro disparador push
              // cuando un evento se reintenta después de una publicación parcial.
              await item(d.id, "notifications", value.id).create(value);
            } catch (e) {
              if (e.code !== 6 && e.code !== "already-exists") throw e;
            }
        }),
      );
      last = page.size === 100 ? page.docs.at(-1) : null;
    } while (last);
  }
  async function adminSetAlarm(request) {
    identity(request, true);
    const data = input(request, ["id", "active"]);
    if (typeof data.active !== "boolean")
      throw new DomainError("Estado de alarma inválido.");
    const result = await db.runTransaction(async (tx) => {
      const value = await find(tx, catalog),
        alarm = value.alarms.find((a) => a.id === data.id);
      if (!alarm) throw new DomainError("Alarma no encontrada.", 404);
      const changed = alarm.active !== data.active;
      alarm.active = data.active;
      alarm.updatedAt = new Date(now()).toISOString();
      if (changed && alarm.active) {
        const value = notice(
          "Alarma comunitaria activada",
          `${alarm.name}: activación en zona ${alarm.zone}.`,
          "Alarmas",
          alarm.zone,
          "alarmas",
          alarm.updatedAt,
          { lat: alarm.lat, lng: alarm.lng, alarmId: alarm.id },
        );
        alarm.notificationEventId = value.id;
        tx.create(events.doc(value.id), {
          notification: value,
          status: "pending",
          createdAt: alarm.updatedAt,
        });
      }
      tx.update(catalog, { alarms: value.alarms, updatedAt: alarm.updatedAt });
      return { ...alarm, changed };
    });
    if (result.active && result.notificationEventId)
      await processMunicipalEvent(result.notificationEventId);
    return result;
  }
  async function publishMunicipalNotice(request) {
    identity(request, true);
    const data = input(request, ["title", "body", "type", "zone", "details"]);
    const value = notice(
      required(data.title, "Título", 3, 100),
      required(data.body, "Mensaje", 10, 1000),
      member(
        data.type,
        types.filter((t) => !personalTypes.includes(t)),
        "Tipo",
      ),
      member(data.zone, zones, "Zona"),
      "notificaciones",
      new Date(now()).toISOString(),
      { details: required(data.details || data.body, "Información", 10, 3000) },
    );
    await events
      .doc(value.id)
      .create({
        notification: value,
        status: "pending",
        createdAt: value.createdAt,
      });
    await processMunicipalEvent(value.id);
    return { id: value.id };
  }
  async function processMunicipalEvent(id) {
    const ref = events.doc(id),
      snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data().status === "complete") return;
    await publishToResidents(snapshot.data().notification);
    await ref.update({
      status: "complete",
      completedAt: new Date(now()).toISOString(),
    });
  }
  async function processPendingMunicipalEvents() {
    let last;
    do {
      let query = events
        .where("status", "==", "pending")
        .orderBy("__name__")
        .limit(100);
      if (last) query = query.startAfter(last);
      const page = await query.get();
      await Promise.all(page.docs.map((d) => processMunicipalEvent(d.id)));
      last = page.size === 100 ? page.docs.at(-1) : null;
    } while (last);
  }
  async function deliverPush(uid, n) {
    if (!messaging) return { skipped: true };
    const pref = (
      await resident(uid).collection("configuracion").doc("preferencias").get()
    ).data();
    const nearby = (
      await resident(uid).collection("configuracion").doc("cercania").get()
    ).data();
    const close =
      n.type === "Alarmas" &&
      nearby?.alarmIds.includes(n.alarmId) &&
      Date.parse(nearby.expiresAt) > now();
    if (
      !pref?.desktop ||
      pref.frequency !== "Inmediata" ||
      !pref.types.includes(n.type) ||
      (!personalTypes.includes(n.type) &&
        !pref.zones.includes(n.zone) &&
        !close)
    )
      return { skipped: true };
    const devices = await resident(uid).collection("dispositivos").get();
    if (!devices.size) return { skipped: true };
    const result = await messaging.sendEachForMulticast({
      tokens: devices.docs.map((d) => d.data().token).slice(0, 500),
      data: { id: n.id, title: n.title, body: n.body, target: n.target },
      webpush: { headers: { TTL: "3600" } },
    });
    await Promise.all(
      result.responses.map((r, i) =>
        [
          "messaging/registration-token-not-registered",
          "messaging/invalid-registration-token",
        ].includes(r.error?.code)
          ? devices.docs[i].ref.delete()
          : null,
      ),
    );
    return { sent: result.successCount };
  }
  const actions = {
    bootstrapResident,
    getMunicipalState,
    getResidentHistory,
    createClaim,
    downloadClaimAttachment,
    payTax,
    startParking,
    extendParking,
    savePreferences,
    markNotificationRead,
    registerPushToken,
    unregisterPushToken,
    subscribeNearbyAlarms,
    adminAdvanceClaim,
    adminUpdateBikes,
    adminSetAlarm,
    publishMunicipalNotice,
  };
  return {
    ...Object.fromEntries(
      Object.entries(actions).map(([k, fn]) => [
        k,
        (request) => run(() => fn(request)),
      ]),
    ),
    initializeCatalog,
    processReminders,
    processAllReminders,
    processMunicipalEvent,
    deliverPush,
  };
}
