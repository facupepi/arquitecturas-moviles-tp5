// Integración: el almacén (src/datos/almacen.js) y la orquestación de sesión contra el
// emulador. Comprueba listo, derivados, alertas deduplicadas por claveEntrega, cercanía sin
// coordenadas, E3 y paginación. React no se dibuja: se usa el núcleo crearAlmacen().
import { register } from 'node:module';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { crearEntorno, vecino, google, sembrar, ts, PREFERENCIAS, MIN } from './_entorno.mjs';

register('./_cargador.mjs', import.meta.url);

const { fijarDb } = await import('./_dobles/firestore.mjs');
const { fijarUsuario, llamadas: llamadasAuth } = await import('./_dobles/auth.mjs');
const funciones = await import('./_dobles/funciones.mjs');
const red = await import('./_dobles/red.mjs');
const rendimiento = await import('./_dobles/rendimiento.mjs');
const ubicacion = await import('./_dobles/ubicacion.mjs');
const locales = await import('./_dobles/notificacionesLocales.mjs');
const mensajeria = await import('./_dobles/mensajeria.mjs');
const { crearAlmacen } = await import('../../src/datos/almacen.js');
const repo = await import('../../src/datos/repositorio.js');
const sesion = await import('../../src/datos/sesion.js');
const { catalogo } = await import('../../shared/catalogo.mjs');

let entorno;
let almacen;
const base = catalogo(Date.now());

function como(uid, proveedor = 'anonymous') {
  fijarDb(proveedor === 'google.com' ? google(entorno, uid) : vecino(entorno, uid));
  fijarUsuario(uid);
}

function esperar(predicado, ms = 10_000) {
  return new Promise((resolver, rechazar) => {
    const revisar = () => {
      const e = almacen.obtener();
      if (predicado(e)) { cancelar(); clearTimeout(t); resolver(e); }
    };
    const cancelar = almacen.suscribir(revisar);
    const t = setTimeout(() => { cancelar(); rechazar(new Error('El almacén no llegó al estado esperado a tiempo.')); }, ms);
    revisar();
  });
}

async function leer(ruta) {
  let datos;
  await sembrar(entorno, async (db) => { const s = await getDoc(doc(db, ruta)); datos = s.exists() ? s.data() : null; });
  return datos;
}

const sinId = ({ id, ...resto }) => resto;

before(async () => {
  entorno = await crearEntorno();
  await sembrar(entorno, async (db) => {
    await setDoc(doc(db, 'municipal/info'), { ...base.info });
    await setDoc(doc(db, 'municipal/config'), { ...base.config, ultimaSimulacion: null, actualizadoEn: ts(Date.now()) });
    for (const e of base.estaciones) await setDoc(doc(db, 'estaciones', e.id), { ...sinId(e), actualizadoEn: ts(Date.now()) });
    for (const a of base.alarmas) {
      await setDoc(doc(db, 'alarmas', a.id), { ...sinId(a), activa: false, activadaEn: null, activacionId: null, actualizadoEn: ts(Date.now()) });
    }
    for (const z of base.zonasEstacionamiento) {
      await setDoc(doc(db, 'zonasEstacionamiento', z.id), { ...sinId(z), horario: { dias: [1, 2, 3, 4, 5, 6, 7], desde: 0, hasta: 24 } });
    }
    await setDoc(doc(db, 'administradores/admin-google'), { nombre: 'Admin', alta: ts(Date.now()) });
    await setDoc(doc(db, 'usuarios/ana'), {
      nombre: 'Ana', anonimo: true, creadoEn: ts(Date.now()), actualizadoEn: ts(Date.now()), altaEn: ts(Date.now()),
      preferencias: PREFERENCIAS, cercania: null, privacidadAceptadaEn: null,
    });
    const dia = 24 * 60 * MIN;
    await setDoc(doc(db, 'usuarios/ana/tributos/T-1001'), {
      concepto: 'Tasa', periodo: '10/2026', cuenta: 'C', importe: 18500, vence: ts(Date.now() + 2 * dia), pagadoEn: null, comprobante: null, pagoId: null,
    });
    await setDoc(doc(db, 'usuarios/ana/tributos/T-0999'), {
      concepto: 'Tasa', periodo: '08/2026', cuenta: 'C', importe: 18500, vence: ts(Date.now() - 40 * dia), pagadoEn: null, comprobante: null, pagoId: null,
    });
    for (let i = 0; i < 25; i += 1) {
      await setDoc(doc(db, `usuarios/ana/pagos/semilla-pago-${String(i).padStart(2, '0')}`), {
        tipo: 'tributo', refId: 'T-1000', importe: 100, comprobante: 'REC-00001000', proveedor: 'pasarela-simulada', creadoEn: ts(Date.now() - i * MIN),
      });
    }
    await setDoc(doc(db, 'usuarios/ana/notificaciones/bienvenida'), {
      titulo: 'Bienvenida', cuerpo: 'Te damos la bienvenida.', tipo: 'servicios', zona: null, destino: null, enlace: null,
      creadoEn: ts(Date.now()), leida: false, leidaEn: null, origen: 'servidor',
    });
  });
  como('ana');
  funciones.fijarRespuesta(async () => ({ creado: false }));
  almacen = crearAlmacen({ uid: 'ana', anonimo: true, nombre: 'Ana', email: null, proveedor: 'anonymous' });
  almacen.iniciar();
});

after(async () => {
  almacen?.detener();
  await entorno?.cleanup();
});

describe('almacén', () => {
  it('queda listo con catálogo y perfil, marca data-listo y registra la traza', async () => {
    const e = await esperar((s) => s.listo && s.tributos.length === 2 && s.notificaciones.length > 0);
    assert.equal(e.estaciones.length, base.estaciones.length);
    assert.equal(e.config.avisoEstacionamientoMin, base.config.avisoEstacionamientoMin);
    assert.equal(e.info.nombre, base.info.nombre);
    assert.deepEqual(e.preferencias.zonas, ['centro', 'parque']);
    assert.equal(red.estado.listo, true);
    assert.ok(rendimiento.registros.some((r) => 'desdeCache' in r));
    const estados = Object.fromEntries(e.tributos.map((t) => [t.id, t.estado]));
    assert.deepEqual(estados, { 'T-0999': 'vencido', 'T-1001': 'por_vencer' });
    assert.ok(e.noLeidas >= 1);
    assert.equal(e.esAdmin, false);
    assert.equal(e.alerta, null, 'la primera carga no alerta');
    assert.equal(funciones.llamadas.length, 0, 'con altaEn no llama a vecino/alta');
  });

  it('hayMas y cargarMas suben el límite de la escucha', async () => {
    let e = await esperar((s) => s.pagos.length === 20);
    assert.equal(e.hayMas.pagos, true);
    almacen.cargarMas('pagos');
    e = await esperar((s) => s.pagos.length === 25);
    assert.equal(e.hayMas.pagos, false);
  });

  it('una alarma activada en una zona seguida alerta una sola vez aunque llegue también el aviso', async () => {
    const alarma = base.alarmas.find((a) => a.zona === 'centro');
    como('admin-google', 'google.com');
    const req = 'alarma-0001-abcdef';
    await repo.cambiarAlarma({ alarmaId: alarma.id, activa: true }, req);
    const e = await esperar((s) => s.alerta?.id === `ev-${req}`);
    assert.equal(e.alerta.destino, `#/alarmas/${alarma.id}`);
    assert.equal(e.alerta.tono, 'alerta');
    almacen.descartarAlerta();
    // Supabase crea avisos/alarma-ev-… con el mismo eventoId: no debe alertar de nuevo.
    await sembrar(entorno, (db) => setDoc(doc(db, `avisos/alarma-ev-${req}`), {
      titulo: `Alarma activada: ${alarma.nombre}`, cuerpo: 'Se activó la alarma comunitaria.', detalle: '', tipo: 'alarmas',
      zona: alarma.zona, destino: `#/alarmas/${alarma.id}`, enlace: null, creadoEn: ts(Date.now()), autor: 'municipalidad',
      eventoId: `ev-${req}`, vigenteHasta: null,
    }));
    await esperar((s) => s.avisos.some((a) => a.id === `alarma-ev-${req}`));
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(almacen.obtener().alerta, null);
    como('ana');
  });

  it('un aviso de una zona que no sigue no alerta, una emergencia de esa zona sí', async () => {
    const aviso = (id, tipo, zona) => sembrar(entorno, (db) => setDoc(doc(db, `avisos/${id}`), {
      titulo: 'Aviso de prueba', cuerpo: 'Texto del aviso de prueba.', detalle: '', tipo, zona, destino: null, enlace: null,
      creadoEn: ts(Date.now()), autor: 'municipalidad', eventoId: `ev-${id}`, vigenteHasta: null,
    }));
    await aviso('aviso-norte-1', 'obras', 'norte');
    await esperar((s) => s.avisos.some((a) => a.id === 'aviso-norte-1'));
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(almacen.obtener().alerta, null);
    await aviso('aviso-norte-2', 'emergencias', 'norte');
    const e = await esperar((s) => s.alerta?.id === 'ev-aviso-norte-2');
    assert.equal(e.alerta.tono, 'alerta');
    almacen.descartarAlerta();
  });

  it('una notificación personal del servidor alerta; con la pestaña oculta también va al sistema con tag = clave', async () => {
    red.estado.oculta = true;
    try {
      await sembrar(entorno, (db) => setDoc(doc(db, 'usuarios/ana/notificaciones/reclamo-ev-xyz12345'), {
        titulo: 'Tu reclamo R-ABC123 pasó a En proceso', cuerpo: 'Cuadrilla asignada.', tipo: 'reclamos', zona: null,
        destino: '#/reclamos/abc', enlace: null, creadoEn: ts(Date.now()), leida: false, leidaEn: null, origen: 'servidor',
      }));
      const e = await esperar((s) => s.alerta?.id === 'ev-xyz12345');
      assert.equal(e.alerta.destino, '#/reclamos/abc');
      assert.equal(locales.mostradas.at(-1).tag, 'ev-xyz12345');
    } finally {
      red.estado.oculta = false;
      almacen.descartarAlerta();
    }
  });

  it('una notificación creada por el propio vecino no alerta', async () => {
    const req = 'reclamo-propio-0001';
    await repo.crearReclamo({ categoria: 'alumbrado', direccion: 'Bv. 9 de Julio 1187', descripcion: 'La luminaria no enciende de noche.' }, req);
    await esperar((s) => s.notificaciones.some((n) => n.id === `recibido-${req}`) && s.reclamos.some((r) => r.id === req && !r.pendiente));
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(almacen.obtener().alerta, null);
  });

  it('cercanía: guarda ids de alarmas, nunca coordenadas, y se desactiva', async () => {
    const alarma = base.alarmas[0];
    const promesa = almacen.activarCercania();
    await esperar((s) => s.cercania.siguiendo);
    ubicacion.control.alCambiar({ lat: alarma.lat, lng: alarma.lng });
    assert.equal(await promesa, true);
    const e = await esperar((s) => s.cercania.activa);
    assert.ok(e.perfil.cercania.alarmas.includes(alarma.id));
    const guardado = await leer('usuarios/ana');
    assert.deepEqual(Object.keys(guardado.cercania).sort(), ['alarmas', 'vence']);
    await almacen.desactivarCercania();
    const apagado = await esperar((s) => !s.cercania.activa && !s.cercania.siguiendo);
    assert.equal(apagado.perfil.cercania, null);
    assert.ok(ubicacion.control.detenido >= 1);
  });

  it('cercanía con permiso denegado deja el error en el estado', async () => {
    const promesa = almacen.activarCercania();
    const { ErrorApp } = await import('../../src/datos/errores.js');
    ubicacion.control.alFallar(new ErrorApp('permiso', 'Permití el acceso a la ubicación.'));
    assert.equal(await promesa, false);
    const e = almacen.obtener();
    assert.equal(e.cercania.siguiendo, false);
    assert.equal(e.cercania.error.codigo, 'permiso');
  });

  it('E3: una sesión que entra en el umbral alerta una vez con la clave est-<id>-<fin>-por_vencer', async () => {
    await sembrar(entorno, (db) => setDoc(doc(db, 'municipal/config'), {
      ...base.config, avisoEstacionamientoMin: 14, ultimaSimulacion: null, actualizadoEn: ts(Date.now()),
    }));
    await esperar((s) => s.config.avisoEstacionamientoMin === 14);
    // Con la sesión mínima de 15 minutos el aviso llega al minuto; para no esperar se siembra
    // una sesión a la que le quedan 10 minutos (ya dentro del umbral de 14).
    const zona = base.zonasEstacionamiento[0];
    const sesionE3 = (actualizadoEn) => ({
      patente: 'ANA001', zonaId: zona.id, zonaNombre: zona.nombre, zona: zona.zona, minutos: 15, importe: 200,
      inicio: ts(Date.now() - 5 * MIN), fin: ts(finE3), extensiones: 0, ultimoPagoId: 'sesion-e3-000001',
      avisoPorVencer: false, avisoFinalizado: false, actualizadoEn: ts(actualizadoEn),
    });
    const finE3 = Date.now() + 10 * MIN;
    await sembrar(entorno, (db) => setDoc(doc(db, 'usuarios/ana/estacionamiento/sesion-e3-000001'), sesionE3(Date.now())));
    const e = await esperar((st) => st.alerta?.id === `est-sesion-e3-000001-${finE3}-por_vencer`);
    assert.equal(e.alerta.destino, '#/estacionamiento');
    assert.match(e.alerta.cuerpo, /quedan (9|10) minutos/);
    almacen.descartarAlerta();
    // Otro snapshot de la misma sesión no repite el aviso.
    await sembrar(entorno, (db) => setDoc(doc(db, 'usuarios/ana/estacionamiento/sesion-e3-000001'), sesionE3(Date.now() + 1)));
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(almacen.obtener().alerta, null);
  });

  it('cambiarUsuario con anonimo distinto vuelve a llamar vecino/alta (vínculo)', async () => {
    funciones.llamadas.length = 0;
    almacen.cambiarUsuario({ uid: 'ana', anonimo: false, nombre: 'Ana G', email: 'ana@ejemplo.com', proveedor: 'google.com' });
    await esperar(() => funciones.llamadas.some((l) => l.ruta === 'vecino/alta'));
    assert.equal(almacen.obtener().usuario.anonimo, false);
  });
});

describe('sesión y push', () => {
  it('activarPush registra el dispositivo y prende preferencias.push; desactivarPush lo apaga', async () => {
    como('ana');
    await sesion.activarPush();
    assert.equal(mensajeria.local.activo, true);
    assert.equal((await leer('usuarios/ana')).preferencias.push, true);
    await sesion.desactivarPush();
    assert.equal(mensajeria.local.activo, false);
    assert.equal((await leer('usuarios/ana')).preferencias.push, false);
  });

  it('refrescarPush registra el token nuevo si cambió', async () => {
    await sesion.activarPush();
    mensajeria.fijarSiguienteToken('token-fcm-nuevo-'.padEnd(40, 'b'));
    await sesion.refrescarPush();
    assert.equal(mensajeria.local.token, 'token-fcm-nuevo-'.padEnd(40, 'b'));
    assert.equal((await leer('usuarios/ana')).preferencias.push, true);
  });

  it('borrarCuentaYSalir no cierra la sesión si vecino/baja falla', async () => {
    llamadasAuth.length = 0;
    funciones.fijarRespuesta(async (ruta) => { if (ruta === 'vecino/baja') throw Object.assign(new Error('x'), { codigo: 'servidor' }); return {}; });
    await assert.rejects(sesion.borrarCuentaYSalir(), (e) => e.codigo === 'servidor');
    assert.ok(!llamadasAuth.includes('salir'));
    funciones.fijarRespuesta(async () => ({ borrados: 1 }));
    await sesion.borrarCuentaYSalir();
    assert.ok(llamadasAuth.includes('salir'));
  });

  it('vincular pide un token nuevo después de vincular', async () => {
    llamadasAuth.length = 0;
    await sesion.vincular();
    assert.deepEqual(llamadasAuth, ['vincular', 'token:true']);
  });
});

describe('React: ProveedorMunicipal y useMunicipal', () => {
  it('useMunicipal lee el estado con un selector dentro del proveedor y falla fuera de él', async () => {
    const { createElement } = await import('react');
    const { renderToString } = await import('react-dom/server');
    const { ProveedorMunicipal, useMunicipal } = await import('../../src/datos/almacen.js');
    function Lector() {
      const { listo, zonas } = useMunicipal((s) => ({ listo: s.listo, zonas: s.preferencias.zonas }));
      return createElement('span', null, `${listo}|${zonas.join(',')}`);
    }
    const html = renderToString(createElement(ProveedorMunicipal, { usuario: { uid: 'ana', anonimo: true } }, createElement(Lector)));
    assert.match(html, /false\|centro,parque/);
    assert.throws(() => renderToString(createElement(Lector)), /fuera de <ProveedorMunicipal>/);
  });
});
