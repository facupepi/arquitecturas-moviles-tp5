// Cliente REST mínimo de Firestore con la cuenta de servicio (sección 6.6).
// Las fechas entran y salen como milisegundos: el códec convierte a timestampValue y de vuelta.
// No hay modo emulador: las pruebas e2e usan tests/e2e/edge-simulado.mjs.
import { tokenGoogle } from "./google-token.ts";

const PROYECTO = Deno.env.get("FIREBASE_PROJECT_ID") ?? "san-francisco-conecta-tp5";
export const RAIZ = `projects/${PROYECTO}/databases/(default)/documents`;
const BASE = `https://firestore.googleapis.com/v1/${RAIZ}`;

// Marcador → updateTransforms REQUEST_TIME (equivale a serverTimestamp()).
export const HORA_SERVIDOR: unique symbol = Symbol("HORA_SERVIDOR");

export type Value = Record<string, unknown>;
export type Doc = { ruta: string; id: string; datos: Record<string, unknown>; actualizado: string };
export type StructuredQuery = Record<string, unknown>;
export type Escritura =
  | { tipo: "set"; ruta: string; datos: Record<string, unknown>; soloSiNoExiste?: boolean }
  | { tipo: "update"; ruta: string; datos: Record<string, unknown>; campos?: string[]; siActualizado?: string }
  | { tipo: "borrar"; ruta: string };
export type ResultadoEscritura = "ok" | "ya-existia" | "error";

export class ErrorFirestore extends Error {
  constructor(public http: number, public estado: string, mensaje: string) {
    super(`Firestore ${http} ${estado}: ${mensaje}`);
    this.name = "ErrorFirestore";
  }
}

export function esPrecondicion(e: unknown): boolean {
  return e instanceof ErrorFirestore && (e.estado === "FAILED_PRECONDITION" || e.estado === "ALREADY_EXISTS");
}

// ───────────── Códec de valores ─────────────

export function aValor(v: unknown): Value {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("Número no finito");
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === "bigint") return { integerValue: v.toString() };
  if (typeof v === "string") return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(aValor) } };
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const claves = Object.keys(o);
    if (claves.length === 1 && claves[0] === "ms" && typeof o.ms === "number") {
      return { timestampValue: new Date(o.ms).toISOString() };
    }
    return { mapValue: { fields: aCampos(o) } };
  }
  throw new Error(`Valor no admitido en Firestore: ${typeof v}`);
}

function aCampos(o: Record<string, unknown>): Record<string, Value> {
  const campos: Record<string, Value> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) campos[k] = aValor(v);
  return campos;
}

export function desdeValor(v: Value): unknown {
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue as boolean;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("timestampValue" in v) return Date.parse(v.timestampValue as string);
  if ("stringValue" in v) return v.stringValue as string;
  if ("bytesValue" in v) return v.bytesValue as string;
  if ("referenceValue" in v) return v.referenceValue as string;
  if ("geoPointValue" in v) {
    const g = v.geoPointValue as { latitude?: number; longitude?: number };
    return { lat: g.latitude ?? 0, lng: g.longitude ?? 0 };
  }
  if ("arrayValue" in v) {
    return (((v.arrayValue as { values?: Value[] }).values) ?? []).map(desdeValor);
  }
  if ("mapValue" in v) return desdeCampos(((v.mapValue as { fields?: Record<string, Value> }).fields) ?? {});
  return null;
}

function desdeCampos(campos: Record<string, Value>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(campos)) o[k] = desdeValor(v);
  return o;
}

// Campos que el modelo de datos (sección 2) guarda como Timestamp. El dominio compartido
// trabaja en ms; antes de escribir, conFechas() envuelve esos números como { ms }.
const CAMPOS_FECHA = new Set([
  "vence", "pagadoEn", "creadoEn", "actualizadoEn", "leidaEn", "leidoEn", "inicio", "fin", "altaEn",
  "activadaEn", "vigenteHasta", "procesadoEn", "ultimaSimulacion", "privacidadAceptadaEn", "alta",
]);

export function conFechas<T>(valor: T, esFecha = false): T {
  if (typeof valor === "number" && esFecha) return { ms: valor } as T;
  if (Array.isArray(valor)) return valor.map((x) => conFechas(x)) as T;
  if (valor && typeof valor === "object" && !(valor instanceof Date)) {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      if (k === "cronologia" && v && typeof v === "object") {
        o[k] = Object.fromEntries(Object.entries(v as Record<string, unknown>)
          .map(([e, t]) => [e, typeof t === "number" ? { ms: t } : t]));
      } else {
        o[k] = conFechas(v, CAMPOS_FECHA.has(k));
      }
    }
    return o as T;
  }
  return valor;
}

// ───────────── Documentos ─────────────

function codificar(ruta: string): string {
  return ruta.split("/").map(encodeURIComponent).join("/");
}

export function nombreDoc(ruta: string): string {
  return `${RAIZ}/${ruta}`;
}

function docDesdeRest(d: { name: string; fields?: Record<string, Value>; updateTime: string }): Doc {
  const ruta = d.name.slice(RAIZ.length + 1);
  return { ruta, id: ruta.split("/").pop()!, datos: desdeCampos(d.fields ?? {}), actualizado: d.updateTime };
}

// uid del dueño en documentos de grupos de colecciones: usuarios/{uid}/<col>/{id}.
export function uidDe(ruta: string): string | null {
  const partes = ruta.split("/");
  return partes[0] === "usuarios" && partes.length >= 2 ? partes[1] : null;
}

async function pedir(url: string, metodo: string, cuerpo?: unknown): Promise<unknown> {
  const r = await fetch(url, {
    method: metodo,
    headers: { authorization: `Bearer ${await tokenGoogle()}`, "content-type": "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  type ErrorRest = { error?: { status?: string; message?: string } };
  const j = await r.json().catch(() => null) as ErrorRest | ErrorRest[] | null;
  if (!r.ok) {
    // :runQuery informa el error dentro de una lista; el resto de los métodos, en un objeto.
    const e = (Array.isArray(j) ? j.find((x) => x?.error) : j)?.error;
    throw new ErrorFirestore(r.status, e?.status ?? String(r.status), (e?.message ?? "").slice(0, 300));
  }
  return j;
}

export async function obtener(ruta: string): Promise<Doc | null> {
  try {
    const d = await pedir(`${BASE}/${codificar(ruta)}`, "GET");
    return docDesdeRest(d as never);
  } catch (e) {
    if (e instanceof ErrorFirestore && e.http === 404) return null;
    throw e;
  }
}

// batchGet: devuelve un mapa ruta → Doc o null, en una sola solicitud.
export async function obtenerVarios(rutas: string[]): Promise<Map<string, Doc | null>> {
  const resultado = new Map<string, Doc | null>();
  for (let i = 0; i < rutas.length; i += 100) {
    const parte = rutas.slice(i, i + 100);
    const r = await pedir(`${BASE}:batchGet`, "POST", { documents: parte.map(nombreDoc) }) as Array<
      { found?: { name: string; fields?: Record<string, Value>; updateTime: string }; missing?: string }
    >;
    for (const x of r) {
      if (x.found) {
        const d = docDesdeRest(x.found);
        resultado.set(d.ruta, d);
      } else if (x.missing) resultado.set(x.missing.slice(RAIZ.length + 1), null);
    }
  }
  return resultado;
}

// :runQuery sobre `padre` (vacío = raíz). Para grupos de colecciones, allDescendants en `from`.
export async function consultar(q: StructuredQuery, padre = ""): Promise<Doc[]> {
  const url = `${BASE}${padre ? "/" + codificar(padre) : ""}:runQuery`;
  const r = await pedir(url, "POST", { structuredQuery: q }) as Array<{ document?: never }>;
  return r.filter((x) => x.document).map((x) => docDesdeRest(x.document!));
}

// Recorre una consulta de igualdad en páginas ordenadas por __name__ (índice automático).
export async function consultarPaginado(
  q: StructuredQuery,
  alPagina: (docs: Doc[]) => Promise<void>,
  tamano = 300,
  padre = "",
): Promise<number> {
  let ultimo: string | null = null;
  let total = 0;
  for (;;) {
    const pagina: StructuredQuery = {
      ...q,
      orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
      limit: tamano,
      ...(ultimo ? { startAt: { values: [{ referenceValue: ultimo }], before: false } } : {}),
    };
    const docs = await consultar(pagina, padre);
    if (docs.length) await alPagina(docs);
    total += docs.length;
    if (docs.length < tamano) return total;
    ultimo = nombreDoc(docs[docs.length - 1].ruta);
  }
}

// Lista una colección completa con pageToken.
export async function listar(rutaColeccion: string, tamano = 300): Promise<Doc[]> {
  const docs: Doc[] = [];
  let token = "";
  do {
    const url = `${BASE}/${codificar(rutaColeccion)}?pageSize=${tamano}${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`;
    const r = await pedir(url, "GET") as { documents?: never[]; nextPageToken?: string };
    for (const d of r.documents ?? []) docs.push(docDesdeRest(d));
    token = r.nextPageToken ?? "";
  } while (token);
  return docs;
}

// Ayudantes para armar StructuredQuery sin repetir la sintaxis del REST.
export const q = {
  desde(coleccion: string, grupo = false) {
    return { from: [{ collectionId: coleccion, allDescendants: grupo }] };
  },
  campo(op: string, campo: string, valor: unknown) {
    return { fieldFilter: { field: { fieldPath: campo }, op, value: aValor(valor) } };
  },
  esNulo(campo: string) {
    return { unaryFilter: { field: { fieldPath: campo }, op: "IS_NULL" } };
  },
  y(...filtros: unknown[]) {
    return filtros.length === 1 ? filtros[0] : { compositeFilter: { op: "AND", filters: filtros } };
  },
  orden(campo: string, direccion: "ASCENDING" | "DESCENDING" = "ASCENDING") {
    return { field: { fieldPath: campo }, direction: direccion };
  },
};

// ───────────── Escrituras ─────────────

function segmentoCampo(s: string): string {
  return /^[A-Za-z_][A-Za-z_0-9]*$/.test(s) ? s : "`" + s.replace(/[`\\]/g, (c) => "\\" + c) + "`";
}

function rutaCampo(segmentos: string[]): string {
  return segmentos.map(segmentoCampo).join(".");
}

// Convierte claves con punto ('cronologia.en_proceso') en mapas anidados.
function expandir(datos: Record<string, unknown>): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(datos)) {
    const partes = clave.split(".");
    let nodo = salida;
    for (const p of partes.slice(0, -1)) {
      if (!nodo[p] || typeof nodo[p] !== "object") nodo[p] = {};
      nodo = nodo[p] as Record<string, unknown>;
    }
    nodo[partes[partes.length - 1]] = valor;
  }
  return salida;
}

// Quita los HORA_SERVIDOR (que pasan a updateTransforms) y devuelve sus rutas de campo.
function separar(o: Record<string, unknown>, prefijo: string[] = []): {
  campos: Record<string, unknown>;
  transformaciones: string[];
} {
  const campos: Record<string, unknown> = {};
  const transformaciones: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    const ruta = [...prefijo, k];
    if (v === HORA_SERVIDOR) {
      transformaciones.push(rutaCampo(ruta));
    } else if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) &&
      !(Object.keys(v).length === 1 && "ms" in (v as object))) {
      const interno = separar(v as Record<string, unknown>, ruta);
      transformaciones.push(...interno.transformaciones);
      // Un mapa que solo tenía marcadores no se escribe vacío (no pisaría nada, pero sobra).
      if (Object.keys(interno.campos).length || !interno.transformaciones.length) campos[k] = interno.campos;
    } else {
      campos[k] = v;
    }
  }
  return { campos, transformaciones };
}

function aEscritura(e: Escritura): Record<string, unknown> {
  if (e.tipo === "borrar") return { delete: nombreDoc(e.ruta) };
  const { campos, transformaciones } = separar(expandir(e.datos));
  const w: Record<string, unknown> = { update: { name: nombreDoc(e.ruta), fields: aCampos(campos) } };
  if (transformaciones.length) {
    w.updateTransforms = transformaciones.map((fieldPath) => ({ fieldPath, setToServerValue: "REQUEST_TIME" }));
  }
  if (e.tipo === "set") {
    if (e.soloSiNoExiste) w.currentDocument = { exists: false };
  } else {
    const claves = e.campos ?? Object.keys(e.datos);
    const mascara = claves
      .filter((c) => e.datos[c] !== HORA_SERVIDOR)
      .map((c) => rutaCampo(c.split(".")))
      .filter((c) => !transformaciones.includes(c));
    w.updateMask = { fieldPaths: mascara };
    w.currentDocument = e.siActualizado ? { updateTime: e.siActualizado } : { exists: true };
  }
  return w;
}

// Atómico: POST …/documents:commit. SOLO para reclamar un evento con la precondición updateTime
// (y para aplicar un avance del simulador junto con su evento).
export async function confirmar(escrituras: Escritura[]): Promise<void> {
  if (!escrituras.length) return;
  await pedir(`${BASE}:commit`, "POST", { writes: escrituras.map(aEscritura) });
}

// No atómico: POST …/documents:batchWrite (máx. 500 por solicitud). ALREADY_EXISTS o
// FAILED_PRECONDITION de una escritura con soloSiNoExiste cuenta como "ya-existia".
export async function escribirLote(escrituras: Escritura[]): Promise<ResultadoEscritura[]> {
  const resultados: ResultadoEscritura[] = [];
  for (let i = 0; i < escrituras.length; i += 500) {
    const parte = escrituras.slice(i, i + 500);
    const r = await pedir(`${BASE}:batchWrite`, "POST", { writes: parte.map(aEscritura) }) as {
      status?: Array<{ code?: number; message?: string }>;
    };
    parte.forEach((e, j) => {
      const codigo = r.status?.[j]?.code ?? 0;
      if (codigo === 0) resultados.push("ok");
      else if (e.tipo === "set" && e.soloSiNoExiste && (codigo === 6 || codigo === 9)) resultados.push("ya-existia");
      else {
        if (!(e.tipo === "update" && e.siActualizado && codigo === 9)) {
          console.warn("batchWrite", e.tipo, e.ruta, codigo, r.status?.[j]?.message);
        }
        resultados.push("error");
      }
    });
  }
  return resultados;
}
