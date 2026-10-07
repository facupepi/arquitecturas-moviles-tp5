// Token OAuth2 de la cuenta de servicio de Firebase, con caché en memoria (sección 6.5).
import { importPKCS8, SignJWT } from "npm:jose@6.2.12";
import { ErrorHttp } from "./firebase-auth.ts";

const ALCANCES = [
  "https://www.googleapis.com/auth/datastore", // Firestore REST
  "https://www.googleapis.com/auth/firebase.messaging", // FCM HTTP v1
  "https://www.googleapis.com/auth/identitytoolkit", // borrar el usuario de Auth (vecino/baja)
].join(" ");

type Cuenta = { client_email: string; private_key: string; private_key_id: string };
let cuenta: Cuenta | null = null;
let cache: { token: string; vence: number } | null = null;

// Se lee al primer uso y no al importar: así GET /tareas responde aunque falte el secreto.
function leerCuenta(): Cuenta {
  if (cuenta) return cuenta;
  const b64 = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_B64");
  if (!b64) {
    console.error("Falta el secreto FIREBASE_SERVICE_ACCOUNT_B64");
    throw new ErrorHttp(500, "servidor", "El servicio no está configurado. Intentá más tarde.");
  }
  cuenta = JSON.parse(atob(b64)) as Cuenta;
  return cuenta;
}

export async function tokenGoogle(): Promise<string> {
  if (cache && cache.vence - 60_000 > Date.now()) return cache.token;
  const c = leerCuenta();
  const clave = await importPKCS8(c.private_key, "RS256");
  const ahora = Math.floor(Date.now() / 1000);
  const asercion = await new SignJWT({ scope: ALCANCES })
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: c.private_key_id })
    .setIssuer(c.client_email).setSubject(c.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(ahora).setExpirationTime(ahora + 3600)
    .sign(clave);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: asercion }),
  });
  if (!r.ok) throw new Error(`OAuth de Google respondió ${r.status}`);
  const j = await r.json();
  cache = { token: j.access_token, vence: Date.now() + j.expires_in * 1000 };
  return cache.token;
}
