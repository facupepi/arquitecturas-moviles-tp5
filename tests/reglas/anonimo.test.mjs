// Sesión anónima: la app solo admite cuentas de Google. Una sesión anónima (de la versión anterior
// que tenía invitados, o creada a mano contra la API de Auth) no lee ni escribe datos de vecino ni
// administra, aunque sea "dueña" del uid o tenga documento en administradores. Cada caso prueba la
// misma operación con el mismo uid y una cuenta de Google, para mostrar que el rechazo es por la
// sesión anónima y no por los datos.
import { describe, it, before, after } from 'node:test';
import {
  doc, getDoc, getDocs, collection, collectionGroup, query, orderBy, limit,
  setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { crearEntorno, vecino, anonimo, sembrar, ts, assertSucceeds, assertFails, PREFERENCIAS } from './_entorno.mjs';

let entorno;
const ID_DISPOSITIVO = 'a'.repeat(32);

function perfil(cambios = {}) {
  return {
    nombre: 'Vecino', anonimo: false, creadoEn: serverTimestamp(), actualizadoEn: serverTimestamp(),
    preferencias: PREFERENCIAS, cercania: null, privacidadAceptadaEn: null, ...cambios,
  };
}

function reclamo() {
  return {
    codigo: 'R-ANON01', categoria: 'alumbrado', direccion: 'Bv. 9 de Julio 1187',
    descripcion: 'La luminaria de la esquina no enciende por la noche.', estacionId: null, adjuntos: [],
    estado: 'recibido', cronologia: { recibido: serverTimestamp() }, notaMunicipal: null,
    creadoEn: serverTimestamp(), actualizadoEn: serverTimestamp(), ultimoEventoId: null,
  };
}

function notificacion() {
  return {
    titulo: 'Recordatorio', cuerpo: 'Tu cedulón vence mañana.', tipo: 'tributos', zona: null, destino: '#/tributos',
    enlace: null, creadoEn: serverTimestamp(), leida: false, leidaEn: null, origen: 'vecino',
  };
}

before(async () => {
  entorno = await crearEntorno();
  const ahora = ts(Date.now());
  await sembrar(entorno, async (db) => {
    await setDoc(doc(db, 'estaciones/b1'), {
      nombre: 'Plaza', capacidad: 10, bicicletas: 4, estado: 'operativa', zona: 'centro', lat: -31.4, lng: -62.1, actualizadoEn: ahora,
    });
    await setDoc(doc(db, 'municipal/config'), {
      simuladorActivo: false, simuladorCadaMin: 5, horarioEstricto: false, avisoEstacionamientoMin: 5, actualizadoEn: ahora,
    });
    for (const uid of ['anon', 'anon-admin']) {
      await setDoc(doc(db, `usuarios/${uid}`), {
        nombre: 'Vecino', anonimo: true, creadoEn: ahora, actualizadoEn: ahora, altaEn: ahora,
        preferencias: PREFERENCIAS, cercania: null, privacidadAceptadaEn: null,
      });
      await setDoc(doc(db, `usuarios/${uid}/tributos/T-1001`), {
        concepto: 'Tasa', periodo: '10/2026', cuenta: 'C', importe: 18500, vence: ahora, pagadoEn: null, comprobante: null, pagoId: null,
      });
      await setDoc(doc(db, `usuarios/${uid}/reclamos/semilla-reclamo-1`), {
        codigo: 'R-SEM001', categoria: 'bacheo', direccion: 'Bv. 25 de Mayo 1500', descripcion: 'Bache grande en la esquina.',
        estacionId: null, adjuntos: [], estado: 'recibido', cronologia: { recibido: ahora }, notaMunicipal: null,
        creadoEn: ahora, actualizadoEn: ahora, ultimoEventoId: null,
      });
      await setDoc(doc(db, `usuarios/${uid}/notificaciones/semilla`), {
        titulo: 'Bienvenida', cuerpo: 'Te damos la bienvenida.', tipo: 'servicios', zona: null, destino: null, enlace: null,
        creadoEn: ahora, leida: false, leidaEn: null, origen: 'servidor',
      });
    }
    await setDoc(doc(db, 'administradores/anon-admin'), { nombre: 'Admin anónimo', alta: ahora });
    await setDoc(doc(db, 'bloqueosPatente/AB123CD'), { sesionId: 'sesion-anon-0001', fin: ahora });
  });
});

after(async () => { await entorno?.cleanup(); });

describe('sesión anónima: datos del vecino', () => {
  it('no lee su propio perfil ni sus colecciones (Google sí)', async () => {
    const lecturas = (db) => [
      getDoc(doc(db, 'usuarios/anon')),
      getDocs(collection(db, 'usuarios/anon/tributos')),
      getDocs(collection(db, 'usuarios/anon/pagos')),
      getDocs(collection(db, 'usuarios/anon/estacionamiento')),
      getDocs(collection(db, 'usuarios/anon/reclamos')),
      getDocs(collection(db, 'usuarios/anon/notificaciones')),
      getDocs(collection(db, 'usuarios/anon/avisosLeidos')),
      getDocs(collection(db, 'usuarios/anon/dispositivos')),
    ];
    for (const lectura of lecturas(anonimo(entorno, 'anon'))) await assertFails(lectura);
    for (const lectura of lecturas(vecino(entorno, 'anon'))) await assertSucceeds(lectura);
  });

  it('no crea ni actualiza su perfil', async () => {
    await assertFails(setDoc(doc(anonimo(entorno, 'anon-nuevo'), 'usuarios/anon-nuevo'), perfil()));
    await assertSucceeds(setDoc(doc(vecino(entorno, 'anon-nuevo'), 'usuarios/anon-nuevo'), perfil()));
    const cambio = { nombre: 'Otro nombre', actualizadoEn: serverTimestamp() };
    await assertFails(updateDoc(doc(anonimo(entorno, 'anon'), 'usuarios/anon'), cambio));
    await assertSucceeds(updateDoc(doc(vecino(entorno, 'anon'), 'usuarios/anon'), cambio));
  });

  it('no crea reclamos ni notificaciones, ni las marca o borra', async () => {
    await assertFails(setDoc(doc(anonimo(entorno, 'anon'), 'usuarios/anon/reclamos/reclamo-anon-0001'), reclamo()));
    await assertSucceeds(setDoc(doc(vecino(entorno, 'anon'), 'usuarios/anon/reclamos/reclamo-anon-0001'), reclamo()));

    await assertFails(setDoc(doc(anonimo(entorno, 'anon'), 'usuarios/anon/notificaciones/n-anon'), notificacion()));
    await assertSucceeds(setDoc(doc(vecino(entorno, 'anon'), 'usuarios/anon/notificaciones/n-anon'), notificacion()));
    const leida = { leida: true, leidaEn: serverTimestamp() };
    await assertFails(updateDoc(doc(anonimo(entorno, 'anon'), 'usuarios/anon/notificaciones/semilla'), leida));
    await assertFails(deleteDoc(doc(anonimo(entorno, 'anon'), 'usuarios/anon/notificaciones/n-anon')));
    await assertSucceeds(updateDoc(doc(vecino(entorno, 'anon'), 'usuarios/anon/notificaciones/semilla'), leida));
  });

  it('no marca avisos leídos ni registra dispositivos', async () => {
    const leido = { leidoEn: serverTimestamp() };
    await assertFails(setDoc(doc(anonimo(entorno, 'anon'), 'usuarios/anon/avisosLeidos/av-1'), leido));
    await assertSucceeds(setDoc(doc(vecino(entorno, 'anon'), 'usuarios/anon/avisosLeidos/av-1'), leido));
    const dispositivo = { token: 'token-fcm-'.padEnd(40, 'x'), plataforma: 'web', actualizadoEn: serverTimestamp() };
    await assertFails(setDoc(doc(anonimo(entorno, 'anon'), `usuarios/anon/dispositivos/${ID_DISPOSITIVO}`), dispositivo));
    await assertSucceeds(setDoc(doc(vecino(entorno, 'anon'), `usuarios/anon/dispositivos/${ID_DISPOSITIVO}`), dispositivo));
  });

  it('no paga un tributo ni lee el bloqueo de una patente', async () => {
    const db = anonimo(entorno, 'anon');
    const lote = writeBatch(db);
    const pago = {
      tipo: 'tributo', refId: 'T-1001', importe: 18500, comprobante: 'REC-ANON0001', medio: 'credito',
      proveedor: 'pasarela-simulada', creadoEn: serverTimestamp(),
    };
    lote.set(doc(db, 'usuarios/anon/pagos/pago-anon-0001'), pago);
    lote.update(doc(db, 'usuarios/anon/tributos/T-1001'), { pagadoEn: serverTimestamp(), comprobante: 'REC-ANON0001', pagoId: 'pago-anon-0001', medio: 'credito' });
    await assertFails(lote.commit());
    await assertFails(getDoc(doc(anonimo(entorno, 'anon'), 'bloqueosPatente/AB123CD')));
    await assertSucceeds(getDoc(doc(vecino(entorno, 'anon'), 'bloqueosPatente/AB123CD')));
  });

  it('el catálogo público se sigue leyendo (como sin sesión)', async () => {
    await assertSucceeds(getDoc(doc(anonimo(entorno, 'anon'), 'estaciones/b1')));
    await assertSucceeds(getDoc(doc(anonimo(entorno, 'anon'), 'municipal/config')));
  });
});

describe('sesión anónima: administración', () => {
  it('con documento de administrador no lo lee, no administra ni lista reclamos', async () => {
    const db = anonimo(entorno, 'anon-admin');
    await assertFails(getDoc(doc(db, 'administradores/anon-admin')));
    await assertFails(updateDoc(doc(db, 'estaciones/b1'), { bicicletas: 3, estado: 'operativa', actualizadoEn: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'municipal/config'), { simuladorActivo: true, actualizadoEn: serverTimestamp() }));
    await assertFails(getDocs(collection(db, 'eventos')));
    await assertFails(getDocs(query(collectionGroup(db, 'reclamos'), orderBy('creadoEn', 'desc'), limit(10))));
    await assertFails(getDoc(doc(db, 'usuarios/anon/reclamos/semilla-reclamo-1')));
  });

  it('la misma cuenta con Google sí administra', async () => {
    const db = vecino(entorno, 'anon-admin');
    await assertSucceeds(getDoc(doc(db, 'administradores/anon-admin')));
    await assertSucceeds(updateDoc(doc(db, 'estaciones/b1'), { bicicletas: 3, estado: 'operativa', actualizadoEn: serverTimestamp() }));
    await assertSucceeds(getDocs(query(collectionGroup(db, 'reclamos'), orderBy('creadoEn', 'desc'), limit(10))));
  });
});
