import { initializeApp } from "../functions/node_modules/firebase-admin/lib/esm/app/index.js";
import { getFirestore } from "../functions/node_modules/firebase-admin/lib/esm/firestore/index.js";
import { getStorage } from "../functions/node_modules/firebase-admin/lib/esm/storage/index.js";
import { createMunicipalService } from "../functions/lib/service.mjs";
if (!process.env.FIRESTORE_EMULATOR_HOST)
  throw new Error("Este proceso sólo se ejecuta con Firestore Emulator.");
initializeApp({
  projectId: "san-francisco-conecta-tp5",
  storageBucket: "san-francisco-conecta-tp5.firebasestorage.app",
});
const service = createMunicipalService({
  db: getFirestore(),
  bucket: getStorage().bucket(),
});
let active = false, initialized = false;
async function tick() {
  if (active) return;
  active = true;
  try {
    if (!initialized) {
      await service.initializeCatalog();
      initialized = true;
      console.log("Recordatorios municipales activos.");
    }
    await service.processAllReminders();
  } catch (e) {
    console.error("Recordatorios:", e.code || e.name);
  } finally {
    active = false;
  }
}
await tick();
setInterval(tick, 15000);
