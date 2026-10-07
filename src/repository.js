import { httpsCallable } from "firebase/functions";
import { collection, doc, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { auth } from "./firebase";
import { functions, db } from "./firebaseData";
const routes = {
  "/claims": "createClaim",
  "/claims/attachment": "downloadClaimAttachment",
  "/taxes/pay": "payTax",
  "/parking": "startParking",
  "/parking/extend": "extendParking",
  "/preferences": "savePreferences",
  "/notifications/read": "markNotificationRead",
  "/push/register": "registerPushToken",
  "/push/unregister": "unregisterPushToken",
  "/alarms/nearby": "subscribeNearbyAlarms",
};
export const repository = {
  async bootstrap() {
    return this.call("bootstrapResident", {});
  },
  async state() {
    return this.call("getMunicipalState", {});
  },
  async call(name, data) {
    if (!auth.currentUser) throw new Error("Ingresá con tu cuenta de Google.");
    try {
      return (await httpsCallable(functions, name, { timeout: 25000 })(data))
        .data;
    } catch (e) {
      if (
        ["functions/unavailable", "functions/deadline-exceeded"].includes(
          e.code,
        )
      )
        throw new Error(
          "No se pudo conectar con el servicio. Revisá tu conexión e intentá nuevamente.",
        );
      throw new Error(
        e.code === "functions/internal"
          ? "No se pudo completar la operación. Intentá nuevamente."
          : e.message,
      );
    }
  },
  async request(path, body) {
    const name = routes[path];
    if (!name) throw new Error("Servicio no disponible.");
    return this.call(name, body);
  },
  subscribe(onUpdate, onError) {
    const uid = auth.currentUser?.uid;
    if (!uid) return () => {};
    let timer;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(onUpdate, 80);
    };
    const refs = [
      doc(db, "municipal", "catalogo"),
      doc(db, "usuarios", uid),
      ...[
        ["reclamos", "createdAt"],
        ["tributos", "due"],
        ["estacionamiento", "startedAt"],
        ["notificaciones", "createdAt"],
      ].map(([c, field]) => query(collection(db, "usuarios", uid, c), orderBy(field, "desc"), limit(150))),
      doc(db, "usuarios", uid, "configuracion", "preferencias"),
    ];
    const off = refs.map((ref) => onSnapshot(ref, update, onError));
    return () => {
      clearTimeout(timer);
      off.forEach((close) => close());
    };
  },
};
