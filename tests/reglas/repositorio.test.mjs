// Integración: los comandos y suscripciones de src/datos/repositorio.js contra el emulador
// con las reglas reales. Comprueba que lo que escribe el cliente es exactamente lo que las
// reglas aceptan. Los módulos de WP4/WP6 se reemplazan por dobles (tests/reglas/_dobles).
import { register } from 'node:module';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { crearEntorno, vecino, sembrar, ts, PREFERENCIAS, MIN } from './_entorno.mjs';

register('./_cargador.mjs', import.meta.url);

const { fijarDb } = await import('./_dobles/firestore.mjs');
const { fijarUsuario } = await import('./_dobles/auth.mjs');
const funciones = await import('./_dobles/funciones.mjs');
const red = await import('./_dobles/red.mjs');
const repo = await import('../../src/datos/repositorio.js');
const { catalogo } = await import('../../shared/catalogo.mjs');

let entorno;
const contextos = new Map();
const TODOS_LOS_DIAS = { dias: [1, 2, 3, 4, 5, 6, 7], desde: 0, hasta: 24 };
const SIN_HORARIO = { dias: [], desde: 0, hasta: 24 };

// Cambia el usuario de turno: Firestore autenticado con su token y auth.currentUser.
function como(uid) {
  const clave = uid;
  if (!contextos.has(clave)) contextos.set(clave, vecino(entorno, uid));
  fijarDb(contextos.get(clave));
  fijarUsuario(uid);
}

function perfil(nombre) {
  return {
    nombre, anonimo: false, creadoEn: ts(Date.now()), actualizadoEn: ts(Date.now()), altaEn: ts(Date.now()),
    preferencias: PREFERENCIAS, cercania: null, privacidadAceptadaEn: null,
  };
}

const id = (n) => `req-${String(n).padStart(4, '0')}-${Math.random().toString(36).slice(2, 10)}`;

async function leer(ruta) {
  let datos;
  await sembrar(entorno, async (db) => { const s = await getDoc(doc(db, ruta)); datos = s.exists() ? s.data() : null; });
  return datos;
}

async function esperarError(promesa, codigo) {
  await assert.rejects(promesa, (e) => {
    assert.equal(e.name, 'ErrorApp', `se esperaba ErrorApp y llegó ${e.name}: ${e.message}`);
    assert.equal(e.codigo, codigo, e.message);
    return true;
  });
}

before(async () => {
  entorno = await crearEntorno();
  const base = catalogo(Date.now());
  await sembrar(entorno, async (db) => {
    for (const e of base.estaciones) {
      const { id: eid, ...resto } = e;
      await setDoc(doc(db, 'estaciones', eid), { ...resto, actualizadoEn: ts(Date.now()) });
    }
    for (const a of base.alarmas) {
      const { id: aid, ...resto } = a;
      await setDoc(doc(db, 'alarmas', aid), { ...resto, activa: false, activadaEn: null, activacionId: null, actualizadoEn: ts(Date.now()) });
    }
    await setDoc(doc(db, 'municipal/config'), {
      simuladorActivo: false, simuladorCadaMin: 2, horarioEstricto: true, avisoEstacionamientoMin: 5,
      ultimaSimulacion: null, actualizadoEn: ts(Date.now()),
    });
    await setDoc(doc(db, 'zonasEstacionamiento/p1'), { nombre: 'Municipalidad, Bv. 9 de Julio', zona: 'centro', tarifaHora: 800, horario: TODOS_LOS_DIAS });
    await setDoc(doc(db, 'zonasEstacionamiento/cerrada'), { nombre: 'Cerrada', zona: 'centro', tarifaHora: 600, horario: SIN_HORARIO });
    await setDoc(doc(db, 'administradores/admin-google'), { nombre: 'Admin', alta: ts(Date.now()) });
    for (const uid of ['ana', 'beto', 'caro']) {
      await setDoc(doc(db, 'usuarios', uid), perfil(uid));
      await setDoc(doc(db, `usuarios/${uid}/tributos/T-1001`), {
        concepto: 'Tasa de servicios municipales', periodo: '10/2026', cuenta: 'CTA-1', importe: 18500,
        vence: ts(Date.now() + 2 * 24 * 60 * MIN), pagadoEn: null, comprobante: null, pagoId: null,
      });
    }
    await setDoc(doc(db, 'usuarios/ana/notificaciones/bienvenida'), {
      titulo: 'Bienvenida', cuerpo: 'Te damos la bienvenida.', tipo: 'servicios', zona: null, destino: null, enlace: null,
      creadoEn: ts(Date.now()), leida: false, leidaEn: null, origen: 'servidor',
    });
  });
});

after(async () => { await entorno?.cleanup(); });

describe('tributos', () => {
  it('pagarTributo crea el pago, marca el tributo y deja la notificación', async () => {
    como('ana');
    const req = id(1);
    const pago = await repo.pagarTributo('T-1001', req);
    assert.equal(pago.importe, 18500);
    assert.match(pago.comprobante, /^REC-[A-Z0-9]{8}$/);
    const tributo = await leer('usuarios/ana/tributos/T-1001');
    assert.equal(tributo.pagoId, req);
    assert.ok(tributo.pagadoEn);
    assert.ok(await leer(`usuarios/ana/notificaciones/pago-${req}`));
    // Reintento con el mismo requestId: devuelve el mismo pago sin duplicar.
    const otra = await repo.pagarTributo('T-1001', req);
    assert.equal(otra.id, req);
    await esperarError(repo.pagarTributo('T-1001', id(2)), 'ya-pagado');
    await esperarError(repo.pagarTributo('T-9999', id(3)), 'no-encontrado');
  });

  it('sin sesión o sin red no intenta pagar', async () => {
    fijarUsuario(null);
    await esperarError(repo.pagarTributo('T-1001', id(4)), 'sin-sesion');
    como('beto');
    red.estado.enLinea = false;
    try {
      await esperarError(repo.pagarTributo('T-1001', id(5)), 'sin-conexion');
    } finally {
      red.estado.enLinea = true;
    }
  });
});

describe('estacionamiento', () => {
  let sesionAna;

  it('iniciarEstacionamiento escribe sesión, bloqueo y pago aceptados por las reglas', async () => {
    como('ana');
    const req = id(10);
    sesionAna = await repo.iniciarEstacionamiento({ zonaId: 'p1', patente: 'ab 123 cd', minutos: 30 }, req);
    assert.equal(sesionAna.patente, 'AB123CD');
    assert.equal(sesionAna.importe, 400);
    assert.ok(Math.abs(sesionAna.fin - (Date.now() + 30 * MIN)) < 5000);
    const bloqueo = await leer('bloqueosPatente/AB123CD');
    assert.deepEqual(Object.keys(bloqueo).sort(), ['fin', 'sesionId']);
    assert.equal(bloqueo.sesionId, req);
    const repetida = await repo.iniciarEstacionamiento({ zonaId: 'p1', patente: 'AB123CD', minutos: 30 }, req);
    assert.equal(repetida.id, req, 'el reintento devuelve la misma sesión');
  });

  it('otro vecino con la misma patente recibe patente-ocupada con la hora de fin', async () => {
    como('beto');
    await assert.rejects(repo.iniciarEstacionamiento({ zonaId: 'p1', patente: 'AB123CD', minutos: 15 }, id(11)), (e) => {
      assert.equal(e.codigo, 'patente-ocupada');
      assert.equal(e.datos.fin, sesionAna.fin);
      assert.match(e.message, /hasta las \d\d:\d\d\./);
      return true;
    });
  });

  it('valida patente, minutos y horario antes de escribir', async () => {
    como('beto');
    await assert.rejects(repo.iniciarEstacionamiento({ zonaId: 'p1', patente: 'X1', minutos: 15 }, id(12)), (e) => e.codigo === 'validacion' && e.campo === 'patente');
    await assert.rejects(repo.iniciarEstacionamiento({ zonaId: 'p1', patente: 'XYZ123', minutos: 20 }, id(13)), (e) => e.codigo === 'validacion' && e.campo === 'minutos');
    await esperarError(repo.iniciarEstacionamiento({ zonaId: 'cerrada', patente: 'XYZ123', minutos: 15 }, id(14)), 'fuera-de-horario');
    await esperarError(repo.iniciarEstacionamiento({ zonaId: 'p1', patente: 'XYZ123', minutos: 15 }, 'corto'), 'validacion');
  });

  it('extenderEstacionamiento suma el tiempo y controla el máximo', async () => {
    como('ana');
    const extendida = await repo.extenderEstacionamiento(sesionAna.id, 15, id(15));
    assert.equal(extendida.minutos, 45);
    assert.equal(extendida.importe, 600);
    assert.equal(extendida.fin, sesionAna.fin + 15 * MIN);
    assert.equal(extendida.extensiones, 1);
    const bloqueo = await leer('bloqueosPatente/AB123CD');
    assert.equal(bloqueo.fin.toMillis(), extendida.fin);
    await esperarError(repo.extenderEstacionamiento(sesionAna.id, 210, id(16)), 'maximo-alcanzado');
  });

  it('finalizarEstacionamiento libera la patente para otro vecino', async () => {
    como('ana');
    await repo.finalizarEstacionamiento(sesionAna.id);
    await esperarError(repo.extenderEstacionamiento(sesionAna.id, 15, id(17)), 'sesion-vencida');
    await esperarError(repo.finalizarEstacionamiento(sesionAna.id), 'sesion-vencida');
    como('beto');
    const deBeto = await repo.iniciarEstacionamiento({ zonaId: 'p1', patente: 'AB123CD', minutos: 15 }, id(18));
    assert.equal(deBeto.importe, 200);
  });

  it('sin horario estricto se puede estacionar en una zona cerrada', async () => {
    await sembrar(entorno, (db) => setDoc(doc(db, 'municipal/config'), {
      simuladorActivo: false, simuladorCadaMin: 2, horarioEstricto: false, avisoEstacionamientoMin: 5, ultimaSimulacion: null, actualizadoEn: ts(Date.now()),
    }));
    como('caro');
    const sesion = await repo.iniciarEstacionamiento({ zonaId: 'cerrada', patente: 'CAR001', minutos: 60 }, id(19));
    assert.equal(sesion.importe, 600);
  });
});

describe('reclamos', () => {
  it('crearReclamo sin adjuntos confirma y un reintento devuelve el mismo', async () => {
    como('ana');
    const req = id(20);
    const r = await repo.crearReclamo({ categoria: 'alumbrado', direccion: 'Bv. 9 de Julio 1187', descripcion: 'La luminaria no enciende por la noche.' }, req);
    assert.equal(r.id, req);
    assert.match(r.codigo, /^R-[A-Z0-9]{6}$/);
    assert.equal(r.enCola, false);
    const guardado = await leer(`usuarios/ana/reclamos/${req}`);
    assert.equal(guardado.estado, 'recibido');
    assert.ok(await leer(`usuarios/ana/notificaciones/recibido-${req}`));
    const otra = await repo.crearReclamo({ categoria: 'alumbrado', direccion: 'Bv. 9 de Julio 1187', descripcion: 'La luminaria no enciende por la noche.' }, req);
    assert.equal(otra.codigo, r.codigo);
  });

  it('con adjuntos sube un archivo por llamada y guarda las rutas que devuelve el servidor', async () => {
    como('ana');
    const req = id(21);
    funciones.llamadas.length = 0;
    funciones.fijarRespuesta(async (ruta, { formulario }) => {
      const indice = formulario.get('indice');
      return { adjunto: { ruta: `ana/${formulario.get('reclamoId')}/${indice}-0123456789ab.png`, nombre: `foto-${indice}.png`, tipo: 'image/png', tamano: 1234 } };
    });
    const progreso = [];
    const archivos = [0, 1].map((i) => ({ nombre: `foto-${i}.png`, tipo: 'image/png', tamano: 4, blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }) }));
    const r = await repo.crearReclamo(
      { categoria: 'bicicletas', direccion: 'Estación Terminal', descripcion: 'La bicicleta tiene la cadena rota.', estacionId: 'b4', archivos },
      req, { alProgreso: (i, total) => progreso.push(`${i}/${total}`) },
    );
    assert.equal(r.enCola, false);
    assert.deepEqual(progreso, ['1/2', '2/2']);
    assert.deepEqual(funciones.llamadas.map((l) => l.ruta), ['adjuntos/subir', 'adjuntos/subir']);
    assert.equal(funciones.llamadas[0].opciones.esperaMs, 60_000);
    const guardado = await leer(`usuarios/ana/reclamos/${req}`);
    assert.equal(guardado.adjuntos.length, 2);
    assert.equal(guardado.estacionId, 'b4');
    funciones.fijarRespuesta(async () => ({}));
  });

  it('con adjuntos y sin red lanza sin-conexion; sin adjuntos y sin red queda en cola', async () => {
    como('beto');
    red.estado.enLinea = false;
    try {
      const archivos = [{ nombre: 'a.png', tipo: 'image/png', tamano: 4, blob: new Blob([new Uint8Array(4)]) }];
      await esperarError(repo.crearReclamo({ categoria: 'bacheo', direccion: 'Bv. 25 de Mayo 1500', descripcion: 'Pozo grande en la calzada.', archivos }, id(22)), 'sin-conexion');
      const enCola = await repo.crearReclamo({ categoria: 'bacheo', direccion: 'Bv. 25 de Mayo 1500', descripcion: 'Pozo grande en la calzada.' }, id(23));
      assert.equal(enCola.enCola, true);
    } finally {
      red.estado.enLinea = true;
    }
  });

  it('valida los campos con el dominio compartido', async () => {
    como('ana');
    await assert.rejects(repo.crearReclamo({ categoria: 'alumbrado', direccion: '', descripcion: 'La luminaria no enciende.' }, id(24)), (e) => e.codigo === 'validacion' && e.campo === 'direccion');
    await assert.rejects(repo.crearReclamo({ categoria: 'ruidos', direccion: 'Bv. 9 de Julio', descripcion: 'La luminaria no enciende.' }, id(25)), (e) => e.codigo === 'validacion' && e.campo === 'categoria');
  });
});

describe('perfil, notificaciones y dispositivos', () => {
  it('guardarPreferencias, actualizarCercania y aceptarPrivacidad pasan las reglas', async () => {
    como('ana');
    await repo.guardarPreferencias({ tipos: ['obras', 'alarmas'], zonas: ['norte'], frecuencia: 'resumen_diario', push: true });
    let p = await leer('usuarios/ana');
    assert.deepEqual(p.preferencias.zonas, ['norte']);
    assert.equal(p.preferencias.push, false, 'guardarPreferencias no toca push');
    await repo.actualizarCercania(['a1', 'a2'], 90);
    p = await leer('usuarios/ana');
    assert.deepEqual(p.cercania.alarmas, ['a1', 'a2']);
    assert.ok(p.cercania.vence.toMillis() <= Date.now() + 60 * MIN + 1000, 'como máximo 60 minutos');
    await repo.actualizarCercania(null);
    assert.equal((await leer('usuarios/ana')).cercania, null);
    await repo.aceptarPrivacidad();
    assert.ok((await leer('usuarios/ana')).privacidadAceptadaEn);
    await assert.rejects(repo.guardarPreferencias({ tipos: ['spam'], zonas: [], frecuencia: 'inmediata' }), (e) => e.codigo === 'validacion');
  });

  it('marcarLeida y marcarTodasLeidas con avisos y personales', async () => {
    como('ana');
    await repo.marcarLeida({ id: 'bienvenida', fuente: 'personal', leida: false });
    assert.equal((await leer('usuarios/ana/notificaciones/bienvenida')).leida, true);
    await repo.marcarLeida({ id: 'av-obras-centro', fuente: 'aviso', leida: false });
    assert.ok(await leer('usuarios/ana/avisosLeidos/av-obras-centro'));
    await repo.marcarTodasLeidas([
      { id: 'av-obras-centro', fuente: 'aviso', leida: false },
      { id: 'av-corte-sur', fuente: 'aviso', leida: false },
      { id: 'bienvenida', fuente: 'personal', leida: true },
    ]);
    assert.ok(await leer('usuarios/ana/avisosLeidos/av-corte-sur'));
  });

  it('registrarDispositivo y eliminarDispositivo mantienen preferencias.push', async () => {
    como('beto');
    const token = 't'.repeat(30) + '-uno';
    await repo.registrarDispositivo(token);
    assert.equal((await leer('usuarios/beto')).preferencias.push, true);
    const nuevo = 't'.repeat(30) + '-dos';
    await repo.registrarDispositivo(nuevo, token);
    await repo.registrarDispositivo('otro-dispositivo-con-token-largo');
    await repo.eliminarDispositivo(nuevo);
    assert.equal((await leer('usuarios/beto')).preferencias.push, true, 'queda otro dispositivo');
    await repo.eliminarDispositivo('otro-dispositivo-con-token-largo');
    assert.equal((await leer('usuarios/beto')).preferencias.push, false);
  });

  it('asegurarAlta crea el perfil si vecino/alta falla y el perfil no existe', async () => {
    como('nuevo');
    funciones.fijarRespuesta(async () => { throw Object.assign(new Error('Failed to fetch'), { name: 'TypeError' }); });
    const r = await repo.asegurarAlta({ uid: 'nuevo', nombre: '' }, null);
    assert.equal(r.creado, true);
    assert.equal(await repo.altaLista('nuevo'), await repo.asegurarAlta({ uid: 'nuevo' }, null));
    const p = await leer('usuarios/nuevo');
    assert.deepEqual(p.preferencias.zonas, ['centro', 'parque']);
    assert.equal(p.anonimo, false, 'el perfil de respaldo nunca es anónimo');
    funciones.fijarRespuesta(async () => ({ creado: true }));
    funciones.llamadas.length = 0;
    // Con altaEn no se llama a la función.
    await repo.asegurarAlta({ uid: 'ana' }, { altaEn: Date.now(), anonimo: false });
    assert.equal(funciones.llamadas.length, 0);
    // Un perfil que quedó marcado anónimo (versión con invitados) sí la llama, para corregirlo.
    await repo.asegurarAlta({ uid: 'beto' }, { altaEn: Date.now(), anonimo: true });
    assert.deepEqual(funciones.llamadas.map((l) => l.ruta), ['vecino/alta']);
    funciones.fijarRespuesta(async () => ({}));
  });

  it('las suscripciones entregan datos mapeados', async () => {
    como('ana');
    const tributos = await new Promise((resolver, rechazar) => {
      const cancelar = repo.suscribirTributos('ana', (items, meta) => {
        if (meta.desdeCache) return;
        cancelar(); resolver(items);
      }, rechazar);
    });
    assert.equal(tributos[0].id, 'T-1001');
    assert.equal(typeof tributos[0].vence, 'number');
    const municipal = await new Promise((resolver, rechazar) => {
      const cancelar = repo.suscribirMunicipal((datos) => { cancelar(); resolver(datos); }, rechazar);
    });
    assert.equal(municipal.info, null);
    assert.equal(typeof municipal.config.avisoEstacionamientoMin, 'number');
  });
});

describe('panel municipal', () => {
  it('avanzarReclamo, cambiarAlarma y publicarAviso escriben su evento y despachan', async () => {
    como('ana');
    const reclamoId = id(30);
    await repo.crearReclamo({ categoria: 'limpieza', direccion: 'Plaza General Paz', descripcion: 'Contenedor desbordado hace días.' }, reclamoId);
    como('admin-google');
    funciones.llamadas.length = 0;
    const req = id(31);
    await repo.avanzarReclamo({ uid: 'ana', reclamoId, estadoActual: 'recibido', nota: 'Cuadrilla asignada.' }, req);
    const r = await leer(`usuarios/ana/reclamos/${reclamoId}`);
    assert.equal(r.estado, 'en_proceso');
    assert.equal(r.ultimoEventoId, `ev-${req}`);
    assert.ok(r.cronologia.en_proceso);
    assert.equal((await leer(`eventos/ev-${req}`)).tipo, 'reclamo');

    const reqAlarma = id(32);
    await repo.cambiarAlarma({ alarmaId: 'a2', activa: true }, reqAlarma);
    assert.equal((await leer('alarmas/a2')).activacionId, `ev-${reqAlarma}`);
    await repo.cambiarAlarma({ alarmaId: 'a2', activa: false });
    assert.equal((await leer('alarmas/a2')).activa, false);

    const reqAviso = id(33);
    const { id: avisoId } = await repo.publicarAviso({
      titulo: 'Corte de agua', cuerpo: 'Corte programado de 8 a 12 en barrio Sur.', detalle: 'Aviso de demostración.',
      tipo: 'cortes', zona: 'sur', destino: '#/notificaciones', enlace: 'https://www.sanfrancisco.gov.ar', vigenteHoras: 4,
    }, reqAviso);
    assert.equal((await leer(`avisos/${avisoId}`)).eventoId, `ev-${reqAviso}`);
    await new Promise((r2) => setTimeout(r2, 20));
    assert.deepEqual(funciones.llamadas.map((l) => [l.ruta, l.opciones.cuerpo.eventoId]), [
      ['despachar', `ev-${req}`], ['despachar', `ev-${reqAlarma}`], ['despachar', `ev-${reqAviso}`],
    ]);
    await assert.rejects(repo.publicarAviso({ titulo: 'Hola', cuerpo: 'corto', tipo: 'obras', zona: 'centro' }, id(34)), (e) => e.campo === 'cuerpo');
    await assert.rejects(repo.publicarAviso({ titulo: 'Hola', cuerpo: 'Texto suficientemente largo.', tipo: 'alarmas', zona: 'centro' }, id(35)), (e) => e.campo === 'tipo');
  });

  it('cambiarBicicletas, configurarDemo y restablecerDemo', async () => {
    como('admin-google');
    await repo.cambiarBicicletas({ estacionId: 'b1', bicicletas: 1, estado: 'operativa' });
    assert.equal((await leer('estaciones/b1')).bicicletas, 1);
    await assert.rejects(repo.cambiarBicicletas({ estacionId: 'b1', bicicletas: 999 }), (e) => e.campo === 'bicicletas');
    await repo.configurarDemo({ avisoEstacionamientoMin: 14, horarioEstricto: false });
    assert.equal((await leer('municipal/config')).avisoEstacionamientoMin, 14);
    await assert.rejects(repo.configurarDemo({ avisoEstacionamientoMin: 15 }), (e) => e.campo === 'avisoEstacionamientoMin');
    await repo.restablecerDemo();
    const base = catalogo(Date.now());
    assert.equal((await leer('estaciones/b1')).bicicletas, base.estaciones.find((e) => e.id === 'b1').bicicletas);
    assert.equal((await leer('municipal/config')).avisoEstacionamientoMin, base.config.avisoEstacionamientoMin);
  });

  it('un vecino no puede usar los comandos del panel', async () => {
    como('ana');
    await esperarError(repo.cambiarBicicletas({ estacionId: 'b1', bicicletas: 2 }), 'permiso');
    await esperarError(repo.cambiarAlarma({ alarmaId: 'a1', activa: true }, id(40)), 'permiso');
  });
});
