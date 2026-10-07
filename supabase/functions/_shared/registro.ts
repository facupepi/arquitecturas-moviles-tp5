// Registro de cada ejecución en public.ejecuciones (evidencia para el informe y detector de
// índices faltantes en producción, sección 6.8).
import { supabase } from "./almacenamiento.ts";

export async function registrar(tarea: string, inicio: number, ok: boolean, resultado: unknown): Promise<void> {
  try {
    const { error } = await supabase().from("ejecuciones").insert({
      tarea,
      inicio: new Date(inicio).toISOString(),
      duracion_ms: Date.now() - inicio,
      ok,
      resultado: resultado ?? null,
    });
    if (error) console.error("No se pudo registrar la ejecución:", error.message);
  } catch (e) {
    console.error("No se pudo registrar la ejecución:", (e as Error).message);
  }
}

// Ejecuta la tarea y deja la fila, salga bien o mal. Relanza el error para la respuesta HTTP.
export async function conRegistro<T>(tarea: string, fn: () => Promise<T>): Promise<T> {
  const inicio = Date.now();
  try {
    const resultado = await fn();
    await registrar(tarea, inicio, true, resultado);
    return resultado;
  } catch (e) {
    await registrar(tarea, inicio, false, { error: String((e as Error)?.message ?? e).slice(0, 500) });
    throw e;
  }
}
