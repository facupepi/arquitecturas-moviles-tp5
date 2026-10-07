import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { firebaseApp, localServices } from "./firebase";
export const db = getFirestore(firebaseApp);
export const functions = getFunctions(firebaseApp, "southamerica-east1");
if (localServices) {
  connectFirestoreEmulator(
    db,
    "127.0.0.1",
    Number(import.meta.env.VITE_FIRESTORE_PORT || 8085),
  );
  connectFunctionsEmulator(
    functions,
    "127.0.0.1",
    Number(import.meta.env.VITE_FIREBASE_FUNCTIONS_PORT || 5001),
  );
}
