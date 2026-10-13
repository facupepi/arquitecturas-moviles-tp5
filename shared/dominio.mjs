// Reglas de negocio puras (de heredado:functions/lib/domain.mjs, traducidas y ampliadas).
// Las usan el cliente (validar antes de enviar), las pruebas y las Edge Functions de Supabase.
// Replican las condiciones de firestore.rules: si cambia una, cambia la otra.
// Sin Buffer, window, document ni Deno: los bytes llegan como Uint8Array y las fechas como ms.

import {
  CATEGORIAS_RECLAMO, FRECUENCIAS, LIMITES, MEDIOS_PAGO, PREFIJOS_COMPROBANTE, REDES_TARJETA, TIPOS_ARCHIVO,
  TIPOS_NOTIFICACION, ZONAS,
} from './constantes.mjs';

const MS_MINUTO = 60 * 1000;
const MS_HORA = 60 * MS_MINUTO;
const MS_DIA = 24 * MS_HORA;

export class ErrorDominio extends Error {
  constructor(mensaje, campo = null) {
    super(mensaje);
    this.name = 'ErrorDominio';
    this.campo = campo;
  }
}

// ---------- Validaciones genéricas ----------

export function requerido(valor, etiqueta, min = 1, max = 500, campo = null) {
  if (typeof valor !== 'string') throw new ErrorDominio(`${etiqueta}: este dato es obligatorio.`, campo);
  const limpio = valor.trim();
  if (limpio.length === 0 && min > 0) throw new ErrorDominio(`${etiqueta}: este dato es obligatorio.`, campo);
  if (limpio.length < min) throw new ErrorDominio(`${etiqueta}: escribí al menos ${min} caracteres.`, campo);
  if (limpio.length > max) throw new ErrorDominio(`${etiqueta}: usá como máximo ${max} caracteres.`, campo);
  return limpio;
}

export function miembro(valor, valores, etiqueta, campo = null) {
  if (!valores.includes(valor)) throw new ErrorDominio(`${etiqueta}: elegí una opción válida.`, campo);
  return valor;
}

// ---------- Estacionamiento medido ----------

export function minutosValidos(n) {
  if (!Number.isInteger(n) || n < LIMITES.bloqueMinutos || n > LIMITES.minutosMax || n % LIMITES.bloqueMinutos !== 0) {
    throw new ErrorDominio('Elegí entre 15 y 240 minutos, en bloques de 15.', 'minutos');
  }
  return n;
}

const PATRON_PATENTE = /^([A-Z]{3}[0-9]{3}|[A-Z]{2}[0-9]{3}[A-Z]{2})$/; // el mismo de firestore.rules

// Acepta minúsculas, espacios, guiones y puntos ("ab 123 cd", "ABC-123") y devuelve la forma canónica.
export function normalizarPatente(texto) {
  if (typeof texto !== 'string' || texto.trim() === '') {
    throw new ErrorDominio('Ingresá la patente del vehículo.', 'patente');
  }
  const patente = texto.toUpperCase().replace(/[\s.-]/g, '');
  if (!PATRON_PATENTE.test(patente)) {
    throw new ErrorDominio('Usá una patente como ABC123 o AB123CD.', 'patente');
  }
  return patente;
}

export function costoEstacionamiento(tarifaHora, minutos) {
  if (!Number.isInteger(tarifaHora) || tarifaHora < 0) throw new ErrorDominio('La tarifa de la zona no es válida.');
  return Math.round((tarifaHora * minutosValidos(minutos)) / 60);
}

export function finSesion(inicioMs, minutos) {
  return inicioMs + minutos * MS_MINUTO;
}

// Hora de Córdoba (UTC−3 todo el año, como ahoraLocal() de las reglas). dia: 1 = lunes … 7 = domingo.
export function partesCordoba(ms) {
  const d = new Date(ms + LIMITES.desfaseCordobaHoras * MS_HORA);
  return {
    anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, diaMes: d.getUTCDate(),
    dia: d.getUTCDay() === 0 ? 7 : d.getUTCDay(), hora: d.getUTCHours(),
  };
}

// 'AAAA-MM-DD' del día de Córdoba en que cae ms (lo usan las claves deterministas de los recordatorios).
export function diaCordoba(ms) {
  const p = partesCordoba(ms);
  return `${p.anio}-${String(p.mes).padStart(2, '0')}-${String(p.diaMes).padStart(2, '0')}`;
}

// Medianoche de Córdoba del día en que cae ms, en ms UTC (corte de "hoy" para la recaudación del panel).
export function inicioDiaCordoba(ms) {
  const p = partesCordoba(ms);
  return Date.UTC(p.anio, p.mes - 1, p.diaMes) - LIMITES.desfaseCordobaHoras * MS_HORA;
}

// Primer día del mes de Córdoba en que cae ms, a la medianoche, en ms UTC.
export function inicioMesCordoba(ms) {
  const p = partesCordoba(ms);
  return Date.UTC(p.anio, p.mes - 1, 1) - LIMITES.desfaseCordobaHoras * MS_HORA;
}

// Misma condición que enHorarioZona de las reglas: día incluido y desde <= hora < hasta.
export function enHorario(horario, ms) {
  if (!horario || !Array.isArray(horario.dias) || !Number.isFinite(ms)) return false;
  const { dia, hora } = partesCordoba(ms);
  return horario.dias.includes(dia) && hora >= horario.desde && hora < horario.hasta;
}

// ---------- Geografía ----------

export function distanciaKm(a, b) {
  const rad = (n) => (n * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  return 6371 * 2 * Math.asin(Math.sqrt(
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2,
  ));
}

function tieneCoordenadas(p) {
  return Boolean(p) && Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

// Devuelve copias con distanciaKm. Sin posición conserva el orden (distanciaKm: null).
// Los elementos sin coordenadas quedan al final, en su orden original.
export function ordenarPorCercania(items, posicion) {
  const lista = (items ?? []).map((item) => ({
    ...item,
    distanciaKm: tieneCoordenadas(posicion) && tieneCoordenadas(item) ? distanciaKm(posicion, item) : null,
  }));
  if (!tieneCoordenadas(posicion)) return lista;
  return lista
    .map((item, indice) => ({ item, indice }))
    .sort((a, b) => {
      const da = a.item.distanciaKm ?? Infinity;
      const db = b.item.distanciaKm ?? Infinity;
      return da === db ? a.indice - b.indice : da - db;
    })
    .map(({ item }) => item);
}

// ---------- Tributos ----------

export function estadoTributo(tributo, ahoraMs, dias = LIMITES.diasAvisoVencimiento) {
  if (tributo.pagadoEn != null) return 'pagado';
  const falta = tributo.vence - ahoraMs;
  if (falta <= 0) return 'vencido';
  if (falta <= dias * MS_DIA) return 'por_vencer';
  return 'pendiente';
}

export function digitoLuhn(digitos) {
  let suma = 0;
  let doble = true; // el dígito más a la derecha de la base se duplica, porque se agrega el verificador
  for (let i = digitos.length - 1; i >= 0; i -= 1) {
    let n = digitos.charCodeAt(i) - 48;
    if (doble) { n *= 2; if (n > 9) n -= 9; }
    suma += n;
    doble = !doble;
  }
  return String((10 - (suma % 10)) % 10);
}

export function luhnValido(codigo) {
  return typeof codigo === 'string' && /^[0-9]{2,}$/.test(codigo)
    && digitoLuhn(codigo.slice(0, -1)) === codigo.slice(-1);
}

// Código de pago del cedulón: número del tributo (6) + importe (9) + vencimiento AAAAMMDD de Córdoba (8)
// + dígito verificador Luhn. 24 dígitos.
export function codigoPagoTributo(tributo) {
  const numero = String(tributo.id ?? '').replace(/[^0-9]/g, '').slice(-6).padStart(6, '0');
  const importe = String(Math.max(0, Math.trunc(Number(tributo.importe) || 0))).slice(-9).padStart(9, '0');
  const vence = Number.isFinite(tributo.vence) ? diaCordoba(tributo.vence).replace(/-/g, '') : '00000000';
  const base = numero + importe + vence;
  return base + digitoLuhn(base);
}

// ---------- Tarjetas guardadas (medios de pago) ----------
// El número completo solo pasa por estas funciones para validarlo y sacar la red y los últimos 4:
// lo que devuelven nunca lo incluye. No se pide ni se acepta el código de seguridad.

export const PATRON_VENCE = /^(0[1-9]|1[0-2])\/[0-9]{2}$/;   // el mismo de firestore.rules
const PATRON_ULTIMOS4 = /^[0-9]{4}$/;

/** true si la tarjeta ya venció: vale hasta el último día de su mes (en Córdoba). */
export function tarjetaVencida(vence, ahoraMs = Date.now()) {
  if (typeof vence !== 'string' || !PATRON_VENCE.test(vence)) return true;
  const [mes, anio] = vence.split('/').map(Number);
  const hoy = partesCordoba(ahoraMs);
  return 2000 + anio < hoy.anio || (2000 + anio === hoy.anio && mes < hoy.mes);
}

/**
 * Lo que un pago registra de la tarjeta guardada elegida en la pasarela:
 *   { medio: 'credito' | 'debito', tarjeta: { red, ultimos4 } }
 * Lanza ErrorDominio (campo 'medio') si falta la tarjeta, no es válida o está vencida.
 */
export function pagoConTarjeta(tarjeta, ahoraMs = Date.now()) {
  const t = tarjeta && typeof tarjeta === 'object' ? tarjeta : null;
  if (!t || !MEDIOS_PAGO.includes(t.tipo) || !REDES_TARJETA.includes(t.red)
    || typeof t.ultimos4 !== 'string' || !PATRON_ULTIMOS4.test(t.ultimos4)) {
    throw new ErrorDominio('Elegí una tarjeta para pagar.', 'medio');
  }
  if (t.vence != null && tarjetaVencida(t.vence, ahoraMs)) {
    throw new ErrorDominio('Esa tarjeta está vencida. Elegí otra o agregá una nueva.', 'medio');
  }
  return { medio: t.tipo, tarjeta: { red: t.red, ultimos4: t.ultimos4 } };
}

// ---------- Reclamos ----------

export function siguienteEstadoReclamo(estado) {
  if (estado === 'recibido') return 'en_proceso';
  if (estado === 'en_proceso') return 'resuelto';
  return null;
}

export function validarReclamo({ categoria, direccion, descripcion, estacionId = null } = {}) {
  if (!CATEGORIAS_RECLAMO.includes(categoria)) throw new ErrorDominio('Elegí una categoría.', 'categoria');
  const estacion = estacionId == null || estacionId === '' ? null : estacionId;
  if (estacion !== null && (typeof estacion !== 'string' || estacion.length > 40)) {
    throw new ErrorDominio('La estación indicada no es válida.', 'estacionId');
  }
  return {
    categoria,
    direccion: requerido(direccion, 'Ubicación', 5, 160, 'direccion'),
    descripcion: requerido(descripcion, 'Descripción', 10, 1500, 'descripcion'),
    estacionId: estacion,
  };
}

// Valida tipo y peso de un archivo antes de subirlo. Devuelve { nombre recortado, tipo, tamano }.
export function validarArchivo({ nombre, tipo, tamano } = {}) {
  if (!TIPOS_ARCHIVO.includes(tipo)) {
    throw new ErrorDominio('Adjuntá imágenes JPG o PNG, o documentos PDF.', 'adjuntos');
  }
  if (!Number.isInteger(tamano) || tamano < 1) throw new ErrorDominio('El archivo está vacío.', 'adjuntos');
  if (tamano > LIMITES.bytesAdjunto) throw new ErrorDominio('Cada archivo puede pesar hasta 2 MB.', 'adjuntos');
  return { nombre: recortarNombreArchivo(nombre), tipo, tamano };
}

// Caracteres de control C0 y C1, más los separadores de línea y de párrafo de Unicode.
function esControl(n) {
  return n <= 0x1f || (n >= 0x7f && n <= 0x9f) || n === 0x2028 || n === 0x2029;
}

// Sin rutas ni caracteres de control, como máximo 100 caracteres conservando la extensión.
export function recortarNombreArchivo(nombre) {
  const max = LIMITES.largoNombreAdjunto;
  let limpio = typeof nombre === 'string' ? nombre.normalize('NFC') : '';
  limpio = limpio.split(/[\\/]/).pop();
  limpio = Array.from(limpio).filter((c) => !esControl(c.codePointAt(0))).join('').trim();
  if (limpio === '' || limpio === '.' || limpio === '..') limpio = 'archivo';
  if (limpio.length <= max) return limpio;
  const punto = limpio.lastIndexOf('.');
  const extension = punto > 0 && limpio.length - punto <= 10 ? limpio.slice(punto) : '';
  const base = extension ? limpio.slice(0, punto) : limpio;
  let recortada = '';
  for (const caracter of base) { // por punto de código: no parte un emoji a la mitad
    if (recortada.length + caracter.length + extension.length > max) break;
    recortada += caracter;
  }
  return recortada.trimEnd() + extension;
}

// Tipo real del archivo por sus primeros bytes. Acepta Uint8Array (o ArrayBuffer).
export function tipoPorFirma(bytes) {
  const b = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  if (!(b instanceof Uint8Array)) return null;
  const empieza = (firma) => b.length >= firma.length && firma.every((v, i) => b[i] === v);
  if (empieza([0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf'; // %PDF-
  if (empieza([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (empieza([0xff, 0xd8, 0xff])) return 'image/jpeg';
  return null;
}

// ---------- Preferencias ----------

// Normaliza sin duplicados y en el orden de las constantes. push es obligatorio a propósito:
// lo maneja registrarDispositivo y no debe pisarse con un valor por defecto.
export function validarPreferencias(p) {
  if (!p || typeof p !== 'object') throw new ErrorDominio('Las preferencias no son válidas.', 'preferencias');
  const { tipos, zonas, frecuencia, push } = p;
  if (!Array.isArray(tipos) || tipos.some((t) => !TIPOS_NOTIFICACION.includes(t))) {
    throw new ErrorDominio('Elegí tipos de aviso válidos.', 'tipos');
  }
  if (!Array.isArray(zonas) || zonas.some((z) => !ZONAS.includes(z))) {
    throw new ErrorDominio('Elegí zonas válidas.', 'zonas');
  }
  if (!FRECUENCIAS.includes(frecuencia)) throw new ErrorDominio('Elegí una frecuencia válida.', 'frecuencia');
  if (typeof push !== 'boolean') throw new ErrorDominio('Las preferencias no son válidas.', 'push');
  return {
    tipos: TIPOS_NOTIFICACION.filter((t) => tipos.includes(t)),
    zonas: ZONAS.filter((z) => zonas.includes(z)),
    frecuencia,
    push,
  };
}

// ---------- Identificadores ----------

function alfanumerico(requestId) {
  if (typeof requestId !== 'string') throw new ErrorDominio('Identificador de solicitud inválido.');
  return requestId.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

// 'R-XXXXXX': 6 caracteres del requestId sin guiones, en mayúscula (cumple ^R-[A-Z0-9]{6}$).
export function codigoReclamo(requestId) {
  return `R-${alfanumerico(requestId).slice(0, 6).padEnd(6, '0')}`;
}

// 'REC-XXXXXXXX' (o EST, EXT): cumple ^(REC|EST|EXT)-[A-Z0-9]{8}$ de las reglas.
export function comprobante(prefijo, requestId) {
  if (!PREFIJOS_COMPROBANTE.includes(prefijo)) throw new ErrorDominio('Prefijo de comprobante inválido.');
  return `${prefijo}-${alfanumerico(requestId).slice(0, 8).padEnd(8, '0')}`;
}

// UUID v4. randomUUID solo existe en contextos seguros (HTTPS o localhost): por eso el respaldo (COD-16).
export function nuevoIdSolicitud() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i += 1) b[i] = Math.floor(Math.random() * 256); // último recurso
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
