// Verificación de identidad (sección 6.4): ID token de Firebase, App Check, secreto del cron y admin.
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.2.12";

const PROYECTO = Deno.env.get("FIREBASE_PROJECT_ID") ?? "san-francisco-conecta-tp5";
const NUMERO = Deno.env.get("FIREBASE_PROJECT_NUMBER") ?? "864192049474";
const MODO_APPCHECK = Deno.env.get("APPCHECK_MODO") ?? "monitor";

// Claves públicas de securetoken@system.gserviceaccount.com en formato JWK (con kid).
// jose las guarda en memoria y respeta el tiempo de enfriamiento entre descargas.
const CLAVES_ID = createRemoteJWKSet(new URL(
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
));
const CLAVES_APPCHECK = createRemoteJWKSet(new URL("https://firebaseappcheck.googleapis.com/v1/jwks"));

export class ErrorHttp extends Error {
  constructor(public estado: number, public codigo: string, mensaje: string) {
    super(mensaje);
    this.name = "ErrorHttp";
  }
}

export type Identidad = {
  uid: string;
  anonimo: boolean;
  proveedor: string;
  nombre: string | null;
};

function leerToken(req: Request): string {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1] ?? "";
  if (!token) throw new ErrorHttp(401, "sin-sesion", "Falta la sesión de Firebase.");
  return token;
}

export async function verificarUsuario(req: Request): Promise<Identidad> {
  const token = leerToken(req);
  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(token, CLAVES_ID, {
      issuer: `https://securetoken.google.com/${PROYECTO}`,
      audience: PROYECTO,
      algorithms: ["RS256"],
      clockTolerance: 30, // segundos; jose ya controla exp e iat
    }));
  } catch {
    throw new ErrorHttp(401, "sin-sesion", "La sesión no es válida o venció.");
  }
  const ahora = Math.floor(Date.now() / 1000);
  const sub = payload.sub;
  if (typeof sub !== "string" || sub.length === 0 || sub.length > 128) {
    throw new ErrorHttp(401, "sin-sesion", "La sesión no es válida.");
  }
  if (typeof payload.auth_time !== "number" || payload.auth_time > ahora + 30) {
    throw new ErrorHttp(401, "sin-sesion", "La sesión no es válida.");
  }
  const firebase = (payload.firebase ?? {}) as { sign_in_provider?: string };
  return {
    uid: sub,
    anonimo: firebase.sign_in_provider === "anonymous",
    proveedor: firebase.sign_in_provider ?? "desconocido",
    nombre: typeof payload.name === "string" ? payload.name : null,
  };
}

export async function verificarAppCheck(req: Request): Promise<void> {
  const token = req.headers.get("x-firebase-appcheck");
  try {
    if (!token) throw new Error("sin token");
    await jwtVerify(token, CLAVES_APPCHECK, {
      issuer: `https://firebaseappcheck.googleapis.com/${NUMERO}`,
      audience: `projects/${NUMERO}`,
      algorithms: ["RS256"],
    });
  } catch (e) {
    if (MODO_APPCHECK === "exigir") throw new ErrorHttp(401, "app-check", "Aplicación no verificada.");
    console.warn("App Check no verificado (modo monitor):", (e as Error).message);
  }
}

export function verificarCron(req: Request): boolean {
  const recibido = req.headers.get("x-cron-secret") ?? "";
  const esperado = Deno.env.get("CRON_SECRET") ?? "";
  if (!esperado || recibido.length !== esperado.length) return false;
  let dif = 0; // comparación en tiempo constante
  for (let i = 0; i < esperado.length; i++) dif |= recibido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return dif === 0;
}

// Admin = cuenta no anónima con administradores/{uid} en Firestore. MISMO criterio que esAdmin() de las reglas.
export async function exigirAdmin(id: Identidad, firestore: { obtener(r: string): Promise<unknown> }) {
  if (id.anonimo || !(await firestore.obtener(`administradores/${id.uid}`))) {
    throw new ErrorHttp(403, "permiso", "Esta operación corresponde al personal municipal.");
  }
}
