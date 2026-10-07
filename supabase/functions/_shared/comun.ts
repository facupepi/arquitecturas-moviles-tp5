// Ayudantes compartidos por la entrega, los recordatorios y el simulador.
import { PREFERENCIAS_POR_DEFECTO } from "../../../shared/constantes.mjs";
import { HORA_SERVIDOR } from "./firestore.ts";

export type Preferencias = { tipos: string[]; zonas: string[]; frecuencia: string; push: boolean };

// Preferencias del perfil con respaldo en los valores por defecto (perfil viejo o incompleto).
export function preferenciasDe(perfil: Record<string, unknown> | null | undefined): Preferencias {
  const p = (perfil?.preferencias ?? {}) as Partial<Preferencias>;
  const defecto = PREFERENCIAS_POR_DEFECTO as Preferencias;
  return {
    tipos: Array.isArray(p.tipos) ? p.tipos : [...defecto.tipos],
    zonas: Array.isArray(p.zonas) ? p.zonas : [...defecto.zonas],
    frecuencia: typeof p.frecuencia === "string" ? p.frecuencia : defecto.frecuencia,
    push: p.push === true,
  };
}

// Documento de notificaciones/{id} creado por el servidor (campos de la sección 2.2).
export function notificacionPersonal(n: {
  titulo: string;
  cuerpo: string;
  tipo: string;
  zona?: string | null;
  destino?: string | null;
  enlace?: string | null;
}): Record<string, unknown> {
  return {
    titulo: String(n.titulo).slice(0, 100),
    cuerpo: String(n.cuerpo).slice(0, 500),
    tipo: n.tipo,
    zona: n.zona ?? null,
    destino: n.destino ?? null,
    enlace: n.enlace ?? null,
    creadoEn: HORA_SERVIDOR,
    leida: false,
    leidaEn: null,
    origen: "servidor",
  };
}

// Ejecuta fn sobre los elementos con a lo sumo `n` promesas en vuelo.
export async function enParalelo<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const resultados: R[] = new Array(items.length);
  let siguiente = 0;
  const trabajadores = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (siguiente < items.length) {
      const i = siguiente++;
      resultados[i] = await fn(items[i]);
    }
  });
  await Promise.all(trabajadores);
  return resultados;
}

export function suma(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

// Día calendario en Córdoba (UTC−3 sin horario de verano), AAAA-MM-DD.
export function diaCordoba(ms: number): string {
  return new Date(ms - 3 * 3600_000).toISOString().slice(0, 10);
}
