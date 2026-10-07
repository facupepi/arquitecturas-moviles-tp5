import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getMessaging } from "firebase-admin/messaging";
import { onCall } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { createMunicipalService } from "./lib/service.mjs";

initializeApp({
  storageBucket: `${process.env.GCLOUD_PROJECT || "san-francisco-conecta-tp5"}.firebasestorage.app`,
});
const service = createMunicipalService({
  db: getFirestore(),
  bucket: getStorage().bucket(),
  messaging: process.env.FUNCTIONS_EMULATOR === "true" ? null : getMessaging(),
});
const options = {
  region: "southamerica-east1",
  maxInstances: 3,
  memory: "256MiB",
  timeoutSeconds: 60,
  cors: [
    /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/,
    /^https:\/\/san-francisco-conecta-tp5\.(firebaseapp\.com|web\.app)$/,
  ],
};
const callable = (name) => onCall(options, (request) => service[name](request));
export const bootstrapResident = callable("bootstrapResident");
export const getMunicipalState = callable("getMunicipalState");
export const getResidentHistory = callable("getResidentHistory");
export const createClaim = callable("createClaim");
export const downloadClaimAttachment = callable("downloadClaimAttachment");
export const payTax = callable("payTax");
export const startParking = callable("startParking");
export const extendParking = callable("extendParking");
export const savePreferences = callable("savePreferences");
export const markNotificationRead = callable("markNotificationRead");
export const registerPushToken = callable("registerPushToken");
export const unregisterPushToken = callable("unregisterPushToken");
export const subscribeNearbyAlarms = callable("subscribeNearbyAlarms");
export const adminAdvanceClaim = callable("adminAdvanceClaim");
export const adminUpdateBikes = callable("adminUpdateBikes");
export const adminSetAlarm = callable("adminSetAlarm");
export const publishMunicipalNotice = callable("publishMunicipalNotice");
export const dispatchNotification = onDocumentCreated(
  { ...options, document: "usuarios/{uid}/notificaciones/{id}" },
  (event) => service.deliverPush(event.params.uid, event.data.data()),
);
export const dispatchMunicipalEvent = onDocumentCreated(
  { ...options, document: "municipalEvents/{id}", retry: true },
  (event) => service.processMunicipalEvent(event.params.id),
);
export const municipalReminders = onSchedule(
  {
    ...options,
    schedule: "every 1 minutes",
    timeZone: "America/Argentina/Cordoba",
  },
  () => service.processAllReminders(),
);
