// Cliente de Supabase con la clave secreta, solo para Storage y la tabla de ejecuciones.
// Nunca se usa con la identidad del vecino: la identidad es Firebase (sección 6).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const BUCKET = Deno.env.get("ADJUNTOS_BUCKET") ?? "adjuntos-reclamos";

function claveSecreta(): string {
  // Claves nuevas primero (sb_secret_…); la legacy service_role queda de respaldo (sección 6.11).
  try {
    const claves = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
    if (claves.default) return claves.default;
  } catch { /* sin claves nuevas */ }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!legacy) throw new Error("Faltan SUPABASE_SECRET_KEYS y SUPABASE_SERVICE_ROLE_KEY");
  return legacy;
}

let cliente: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!cliente) {
    cliente = createClient(Deno.env.get("SUPABASE_URL")!, claveSecreta(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return cliente;
}

export function almacen() {
  return supabase().storage.from(BUCKET);
}

// Rutas de todos los archivos bajo un prefijo (uid/ → uid/reclamoId/archivo).
export async function listarArchivos(prefijo: string): Promise<string[]> {
  const rutas: string[] = [];
  const pendientes = [prefijo.replace(/\/+$/, "")];
  while (pendientes.length) {
    const carpeta = pendientes.pop()!;
    for (let desde = 0;; desde += 1000) {
      const { data, error } = await almacen().list(carpeta, { limit: 1000, offset: desde });
      if (error) throw new Error(`Storage list: ${error.message}`);
      for (const item of data ?? []) {
        const ruta = `${carpeta}/${item.name}`;
        // Las carpetas no tienen id; los archivos sí.
        if (item.id) rutas.push(ruta);
        else pendientes.push(ruta);
      }
      if (!data || data.length < 1000) break;
    }
  }
  return rutas;
}
