import { initializeApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import { firebaseConfig as config } from "./firebaseConfig.js";
export const firebaseApp = initializeApp(config);
export const auth = getAuth(firebaseApp);
export const localServices =
  import.meta.env.VITE_FIREBASE_EMULATORS !== "false";
export const localAuth = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR === "true";
if (localAuth)
  connectAuthEmulator(
    auth,
    `http://127.0.0.1:${import.meta.env.VITE_FIREBASE_AUTH_PORT || 9099}`,
    { disableWarnings: true },
  );
auth.languageCode = "es";
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });
export const authReady = setPersistence(auth, browserLocalPersistence);
export const observeSession = (callback) => onAuthStateChanged(auth, callback);
export async function loginGoogle() {
  await authReady;
  try {
    return await signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === "auth/popup-blocked")
      return signInWithRedirect(auth, provider);
    throw e;
  }
}
export const completeRedirect = () => getRedirectResult(auth);
export const logout = () => signOut(auth);
export function authMessage(error) {
  return (
    {
      "auth/popup-closed-by-user":
        "Cerraste la ventana de Google. Podés volver a ingresar.",
      "auth/cancelled-popup-request": "Ya hay una ventana de ingreso abierta.",
      "auth/unauthorized-domain":
        "El ingreso con Google no está disponible en esta dirección. Contactá a atención ciudadana.",
      "auth/operation-not-allowed":
        "El ingreso con Google no está disponible en este momento. Intentá más tarde.",
      "auth/network-request-failed":
        "No se pudo conectar con Google. Revisá tu conexión.",
      "auth/user-disabled":
        "Esta cuenta está deshabilitada. Contactá a atención ciudadana.",
    }[error.code] || "No se pudo iniciar sesión. Intentá nuevamente."
  );
}
