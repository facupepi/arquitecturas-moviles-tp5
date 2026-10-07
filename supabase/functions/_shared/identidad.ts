// Borrado del usuario de Firebase Auth por Identity Toolkit (vecino/baja, sección 6.8).
// No depende de deleteUser() del cliente, que exige un ingreso reciente en cuentas de Google.
import { tokenGoogle } from "./google-token.ts";

const PROYECTO = Deno.env.get("FIREBASE_PROJECT_ID") ?? "san-francisco-conecta-tp5";

export async function borrarUsuarioAuth(uid: string): Promise<boolean> {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROYECTO}/accounts:delete`, {
    method: "POST",
    headers: { authorization: `Bearer ${await tokenGoogle()}`, "content-type": "application/json" },
    body: JSON.stringify({ localId: uid }),
  });
  if (r.ok) return true;
  const e = await r.json().catch(() => ({})) as { error?: { message?: string } };
  // Idempotente: si el usuario ya no existe, el resultado es el mismo.
  if (e?.error?.message?.startsWith("USER_NOT_FOUND")) return false;
  throw new Error(`Identity Toolkit respondió ${r.status} ${e?.error?.message ?? ""}`.trim());
}
