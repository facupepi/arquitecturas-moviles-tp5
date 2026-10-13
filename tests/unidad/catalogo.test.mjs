import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { catalogo, datosInicialesVecino } from '../../shared/catalogo.mjs';
import {
  ZONAS, CATEGORIAS_RECLAMO, TIPOS_AVISO, TIPOS_NOTIFICACION, FRECUENCIAS, TIPOS_ARCHIVO,
  CATEGORIAS_CONTACTO, ESTADOS_ESTACION, PREFERENCIAS_POR_DEFECTO, ETIQUETAS, LIMITES, MEDIOS_PAGO,
} from '../../shared/constantes.mjs';
import { estadoTributo, validarPreferencias, luhnValido, codigoPagoTributo } from '../../shared/dominio.mjs';
import { destinoValido } from '../../shared/rutas.mjs';

const ahora = Date.parse('2026-10-07T12:00:00-03:00');
const c = catalogo(ahora);
const v = datosInicialesVecino(ahora);

const dentroDeSanFrancisco = (p) => p.lat >= -31.47 && p.lat <= -31.39 && p.lng >= -62.14 && p.lng <= -62.04;
const unicos = (lista) => new Set(lista.map((x) => x.id)).size === lista.length;
const texto = (s, min, max) => typeof s === 'string' && s.length >= min && s.length <= max;

test('ids únicos y los de la sección 2.4', () => {
  for (const [nombre, lista] of Object.entries({ ...c, ...v })) {
    if (Array.isArray(lista)) assert.ok(unicos(lista), `${nombre} tiene ids repetidos`);
  }
  assert.deepEqual(c.estaciones.map((e) => e.id), ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7']);
  assert.deepEqual(c.alarmas.map((a) => a.id), ['a1', 'a2', 'a3', 'a4', 'a5']);
  assert.deepEqual(c.zonasEstacionamiento.map((z) => z.id), ['p1', 'p2', 'p3']);
  assert.deepEqual(c.contactos.map((x) => x.id), ['c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07', 'c08', 'c09', 'c10']);
  assert.deepEqual(c.avisos.map((a) => a.id), ['av-obras-centro', 'av-corte-sur', 'av-evento-parque', 'av-servicios-todas']);
  assert.deepEqual(v.tributos.map((t) => t.id), ['T-1001', 'T-1002', 'T-0999', 'T-1000']);
});

test('coordenadas dentro de San Francisco', () => {
  const puntos = [
    c.info.centroMapa,
    ...c.estaciones, ...c.alarmas, ...c.zonasEstacionamiento,
    ...c.zonasEstacionamiento.flatMap((z) => z.tramo),
  ];
  for (const p of puntos) assert.ok(dentroDeSanFrancisco(p), JSON.stringify(p));
  for (const z of c.zonasEstacionamiento) assert.ok(z.tramo.length >= 2, `${z.id} sin tramo`);
});

test('cada zona tiene al menos una estación y una alarma (VERIFICAR 10: zona Sur)', () => {
  for (const zona of ZONAS) {
    assert.ok(c.estaciones.some((e) => e.zona === zona), `sin estación en ${zona}`);
    assert.ok(c.alarmas.some((a) => a.zona === zona), `sin alarma en ${zona}`);
  }
});

test('estaciones, alarmas y zonas válidas', () => {
  for (const e of c.estaciones) {
    assert.ok(ZONAS.includes(e.zona));
    assert.ok(ESTADOS_ESTACION.includes(e.estado));
    assert.ok(Number.isInteger(e.capacidad) && e.capacidad > 0);
    assert.ok(Number.isInteger(e.bicicletas) && e.bicicletas >= 0 && e.bicicletas <= e.capacidad, e.id);
    assert.equal(e.actualizadoEn, ahora);
  }
  assert.ok(c.estaciones.some((e) => e.bicicletas === 0), 'una estación sin bicicletas (b6)');
  for (const a of c.alarmas) {
    assert.ok(ZONAS.includes(a.zona));
    assert.deepEqual([a.activa, a.activadaEn, a.activacionId], [false, null, null]);
  }
  for (const z of c.zonasEstacionamiento) {
    assert.ok(ZONAS.includes(z.zona));
    assert.ok(Number.isInteger(z.tarifaHora) && z.tarifaHora % 4 === 0, `${z.id}: tarifa múltiplo de 4`);
    assert.ok(z.horario.dias.length > 0 && z.horario.dias.every((d) => Number.isInteger(d) && d >= 1 && d <= 7));
    assert.ok(z.horario.desde >= 0 && z.horario.desde < z.horario.hasta && z.horario.hasta <= 24);
    assert.ok(texto(z.horarioTexto, 1, 80));
  }
  assert.deepEqual(c.zonasEstacionamiento.map((z) => z.tarifaHora), [800, 500, 600]);
});

test('contactos con categorías válidas y algún medio de contacto', () => {
  for (const k of c.contactos) {
    assert.ok(CATEGORIAS_CONTACTO.includes(k.categoria), k.id);
    assert.ok(k.telefono || k.correo || k.whatsapp || k.sitio, `${k.id} sin medio de contacto`);
    for (const campo of ['area', 'nombre', 'descripcion', 'horario', 'direccion']) assert.ok(texto(k[campo], 1, 200));
    if (k.telefono) assert.match(k.telefono, /^\+?[0-9]{3,15}$/);
    if (k.whatsapp) assert.match(k.whatsapp, /^[0-9]{10,15}$/);
    if (k.sitio) assert.match(k.sitio, /^https:\/\//);
    if (k.correo) assert.match(k.correo, /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/);
  }
  assert.deepEqual(c.contactos.map((k) => k.orden), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const n of ['147', '107', '101', '100', '103']) assert.ok(c.contactos.some((k) => k.telefono === n), n);
});

test('avisos semilla cumplen la regla de creación de avisos', () => {
  for (const a of c.avisos) {
    assert.ok(texto(a.titulo, 3, 100) && texto(a.cuerpo, 10, 500) && texto(a.detalle, 0, 3000), a.id);
    assert.ok(TIPOS_AVISO.includes(a.tipo));
    assert.ok(ZONAS.includes(a.zona) || a.zona === 'todas');
    assert.ok(destinoValido(a.destino));
    assert.ok(a.enlace === null || /^https:\/\/.{4,300}$/.test(a.enlace));
    assert.equal(a.autor, 'municipalidad');
    assert.equal(typeof a.eventoId, 'string');
    assert.match(a.detalle, /147/);
    assert.ok(a.creadoEn <= ahora);
  }
});

test('info y config iniciales', () => {
  assert.equal(c.info.lineaVecino, '147');
  assert.equal(c.info.whatsapp, '5493564336062');
  assert.deepEqual(c.config, {
    simuladorActivo: false, simuladorCadaMin: 2, horarioEstricto: true, avisoEstacionamientoMin: 5,
    ultimaSimulacion: null, actualizadoEn: ahora,
  });
  assert.equal(c.config.avisoEstacionamientoMin, LIMITES.avisoEstacionamientoMinPorDefecto);
});

test('datos iniciales del vecino: estados, comprobantes y reclamo semilla', () => {
  const estados = Object.fromEntries(v.tributos.map((t) => [t.id, estadoTributo(t, ahora)]));
  assert.deepEqual(estados, { 'T-1001': 'por_vencer', 'T-1002': 'pendiente', 'T-0999': 'vencido', 'T-1000': 'pagado' });
  for (const t of v.tributos) {
    assert.ok(Number.isInteger(t.importe) && t.importe > 0);
    assert.ok(luhnValido(codigoPagoTributo(t)));
  }
  const pagado = v.tributos.find((t) => t.id === 'T-1000');
  assert.equal(pagado.comprobante, 'REC-00001000');
  assert.equal(pagado.pagoId, 'semilla-T-1000');
  assert.deepEqual(v.pagos[0], {
    id: 'semilla-T-1000', tipo: 'tributo', refId: 'T-1000', importe: 18500, comprobante: 'REC-00001000',
    medio: 'debito', proveedor: 'pasarela-simulada', creadoEn: ahora - 22 * 24 * 3600 * 1000,
  });
  assert.ok(MEDIOS_PAGO.includes(v.pagos[0].medio));
  assert.equal(pagado.medio, v.pagos[0].medio);
  for (const t of v.tributos.filter((x) => x.id !== 'T-1000')) assert.equal(t.medio, null);
  assert.match(v.pagos[0].comprobante, /^REC-[A-Z0-9]{8}$/);
  const r = v.reclamos[0];
  assert.equal(r.codigo, 'R-000001');
  assert.match(r.codigo, /^R-[A-Z0-9]{6}$/);
  assert.ok(CATEGORIAS_RECLAMO.includes(r.categoria));
  assert.equal(r.estado, 'en_proceso');
  assert.deepEqual(Object.keys(r.cronologia), ['recibido', 'en_proceso']);
  assert.ok(r.cronologia.recibido < r.cronologia.en_proceso);
  assert.ok(texto(r.direccion, 5, 160) && texto(r.descripcion, 10, 1500));
  const bienvenida = v.notificaciones[0];
  assert.equal(bienvenida.id, 'bienvenida');
  assert.ok(TIPOS_NOTIFICACION.includes(bienvenida.tipo));
  assert.ok(destinoValido(bienvenida.destino));
  assert.deepEqual(validarPreferencias(v.preferencias), v.preferencias);
  assert.deepEqual(v.preferencias, { tipos: [...TIPOS_NOTIFICACION], zonas: ['centro', 'parque'], frecuencia: 'inmediata', push: false });
});

test('cada llamada devuelve objetos nuevos y las constantes no se pueden modificar', () => {
  const a = datosInicialesVecino(ahora);
  a.preferencias.tipos.push('x');
  a.tributos[0].importe = 1;
  catalogo(ahora).estaciones[0].bicicletas = 99;
  assert.equal(datosInicialesVecino(ahora).preferencias.tipos.length, TIPOS_NOTIFICACION.length);
  assert.equal(datosInicialesVecino(ahora).tributos[0].importe, 18500);
  assert.equal(catalogo(ahora).estaciones[0].bicicletas, 8);
  assert.throws(() => { PREFERENCIAS_POR_DEFECTO.tipos.push('x'); }, TypeError);
  assert.throws(() => { ZONAS.push('oeste'); }, TypeError);
  assert.throws(() => { ETIQUETAS.zonas.centro = 'x'; }, TypeError);
});

test('etiquetas para todos los valores enumerados', () => {
  for (const z of [...ZONAS, 'todas']) assert.ok(ETIQUETAS.zonas[z], z);
  for (const k of CATEGORIAS_RECLAMO) assert.ok(ETIQUETAS.categorias[k], k);
  for (const t of TIPOS_NOTIFICACION) assert.ok(ETIQUETAS.tipos[t], t);
  for (const f of FRECUENCIAS) assert.ok(ETIQUETAS.frecuencias[f], f);
  for (const e of ['pagado', 'vencido', 'por_vencer', 'pendiente']) assert.ok(ETIQUETAS.estadosTributo[e], e);
  assert.deepEqual(Object.keys(ETIQUETAS.mediosPago).sort(), [...MEDIOS_PAGO].sort());
  assert.deepEqual([...TIPOS_NOTIFICACION], [...TIPOS_AVISO, 'alarmas', 'tributos', 'estacionamiento', 'reclamos']);
  assert.ok(!TIPOS_AVISO.includes('alarmas'), 'el panel no publica avisos de tipo alarmas');
});

// Las listas de firestore.rules deben coincidir con shared/constantes.mjs (sección 3).
const LISTAS_DE_LAS_REGLAS = {
  zonas: ZONAS, categorias: CATEGORIAS_RECLAMO, tiposAvisoPanel: TIPOS_AVISO,
  tiposNotificacion: TIPOS_NOTIFICACION, frecuencias: FRECUENCIAS, tiposArchivo: TIPOS_ARCHIVO,
  mediosPago: MEDIOS_PAGO,
};

function listaDeLasReglas(reglas, nombre) {
  const m = reglas.match(new RegExp(`function\\s+${nombre}\\s*\\(\\s*\\)\\s*\\{\\s*return\\s*\\[([\\s\\S]*?)\\]`));
  return m ? [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]) : null;
}

test('las listas de firestore.rules coinciden con las constantes', (t) => {
  const ruta = new URL('../../firestore.rules', import.meta.url);
  const reglas = existsSync(ruta) ? readFileSync(ruta, 'utf8') : '';
  const encontradas = Object.keys(LISTAS_DE_LAS_REGLAS).filter((n) => listaDeLasReglas(reglas, n) !== null);
  if (encontradas.length === 0) {
    t.skip('firestore.rules todavía no tiene las funciones de la sección 3 (las escribe WP3)');
    return;
  }
  for (const [nombre, constante] of Object.entries(LISTAS_DE_LAS_REGLAS)) {
    const lista = listaDeLasReglas(reglas, nombre);
    assert.ok(lista, `firestore.rules no define ${nombre}()`);
    assert.deepEqual([...lista].sort(), [...constante].sort(), `${nombre}() distinta de shared/constantes.mjs`);
  }
  // Topes de preferenciasValidas y adjuntos, si están escritos como en la sección 3
  const topeTipos = reglas.match(/p\.tipos\.size\(\)\s*<=\s*(\d+)/);
  if (topeTipos) assert.equal(Number(topeTipos[1]), TIPOS_NOTIFICACION.length);
  const topeZonas = reglas.match(/p\.zonas\.size\(\)\s*<=\s*(\d+)/);
  if (topeZonas) assert.equal(Number(topeZonas[1]), ZONAS.length);
  const topeBytes = reglas.match(/entero\(a\.tamano,\s*1,\s*(\d+)\)/);
  if (topeBytes) assert.equal(Number(topeBytes[1]), LIMITES.bytesAdjunto);
  const topeNombre = reglas.match(/texto\(a\.nombre,\s*1,\s*(\d+)\)/);
  if (topeNombre) assert.equal(Number(topeNombre[1]), LIMITES.largoNombreAdjunto);
});

test('las preferencias por defecto pasan la validación', () => {
  assert.deepEqual(validarPreferencias(PREFERENCIAS_POR_DEFECTO), {
    tipos: [...PREFERENCIAS_POR_DEFECTO.tipos], zonas: [...PREFERENCIAS_POR_DEFECTO.zonas], frecuencia: 'inmediata', push: false,
  });
});
