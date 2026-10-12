// Reclamos: alta del vecino con adjuntos propios, transiciones solo del admin con evento.
import { describe, it, before, after } from 'node:test';
import {
  doc, getDoc, getDocs, collection, collectionGroup, query, orderBy, limit,
  setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { crearEntorno, vecino, google, anonimo, sembrar, ts, assertSucceeds, assertFails } from './_entorno.mjs';

let entorno;

function adjunto(uid, reclamoId, i = 0, cambios = {}) {
  return { ruta: `${uid}/${reclamoId}/${i}-0123456789ab.jpg`, nombre: `foto-${i}.jpg`, tipo: 'image/jpeg', tamano: 120_000, ...cambios };
}

function reclamo(cambios = {}) {
  return {
    codigo: 'R-ABC123', categoria: 'alumbrado', direccion: 'Bv. 9 de Julio 1187',
    descripcion: 'La luminaria de la esquina no enciende por la noche.', estacionId: null, adjuntos: [],
    estado: 'recibido', cronologia: { recibido: serverTimestamp() }, notaMunicipal: null,
    creadoEn: serverTimestamp(), actualizadoEn: serverTimestamp(), ultimoEventoId: null, ...cambios,
  };
}

function loteAvance(db, { uid = 'u1', reclamoId, estado, eventoId, conEvento = true, eventoUid = uid, eventoRef = reclamoId, nota = null }) {
  const lote = writeBatch(db);
  lote.update(doc(db, `usuarios/${uid}/reclamos/${reclamoId}`), {
    estado, [`cronologia.${estado}`]: serverTimestamp(), notaMunicipal: nota, actualizadoEn: serverTimestamp(), ultimoEventoId: eventoId,
  });
  if (conEvento) {
    lote.set(doc(db, `eventos/${eventoId}`), {
      tipo: 'reclamo', refId: eventoRef, uid: eventoUid, origen: 'panel', estado: 'pendiente', intentos: 0, creadoEn: serverTimestamp(),
    });
  }
  return lote;
}

before(async () => {
  entorno = await crearEntorno();
  await sembrar(entorno, async (db) => {
    await setDoc(doc(db, 'administradores/admin-google'), { nombre: 'Admin', alta: ts(Date.now()) });
    await setDoc(doc(db, 'administradores/admin-anonimo'), { nombre: 'Admin invitado', alta: ts(Date.now()) });
    await setDoc(doc(db, 'usuarios/u1/reclamos/semilla-reclamo-1'), {
      codigo: 'R-000001', categoria: 'alumbrado', direccion: 'Bv. 9 de Julio 1187', descripcion: 'Luminaria apagada en la esquina.',
      estacionId: null, adjuntos: [], estado: 'recibido', cronologia: { recibido: ts(Date.now() - 1000) }, notaMunicipal: null,
      creadoEn: ts(Date.now() - 1000), actualizadoEn: ts(Date.now() - 1000), ultimoEventoId: null,
    });
  });
});

after(async () => { await entorno?.cleanup(); });

describe('alta del vecino', () => {
  it('crear un reclamo válido, con adjunto y la notificación "recibido", pasa', async () => {
    const db = vecino(entorno, 'u1');
    const id = 'reclamo-valido-0001';
    const lote = writeBatch(db);
    lote.set(doc(db, `usuarios/u1/reclamos/${id}`), reclamo({ adjuntos: [adjunto('u1', id, 0), adjunto('u1', id, 1, { ruta: `u1/${id}/1-abcdefabcdef.pdf`, tipo: 'application/pdf' })] }));
    lote.set(doc(db, `usuarios/u1/notificaciones/recibido-${id}`), {
      titulo: 'Reclamo recibido', cuerpo: 'Tu reclamo R-ABC123 fue recibido.', tipo: 'reclamos', zona: null,
      destino: `#/reclamos/${id}`, enlace: null, creadoEn: serverTimestamp(), leida: false, leidaEn: null, origen: 'vecino',
    });
    await assertSucceeds(lote.commit());
    await assertSucceeds(getDoc(doc(db, `usuarios/u1/reclamos/${id}`)));
  });

  it('un estado inicial distinto de recibido se rechaza', async () => {
    const db = vecino(entorno, 'u1');
    await assertFails(setDoc(doc(db, 'usuarios/u1/reclamos/reclamo-mal-0001'), reclamo({ estado: 'en_proceso' })));
    await assertFails(setDoc(doc(db, 'usuarios/u1/reclamos/reclamo-mal-0002'), reclamo({
      cronologia: { recibido: serverTimestamp(), resuelto: serverTimestamp() },
    })));
    await assertFails(setDoc(doc(db, 'usuarios/u1/reclamos/reclamo-mal-0003'), reclamo({ notaMunicipal: 'Hola' })));
  });

  it('un adjunto con la ruta de otro uid o de otro reclamo se rechaza', async () => {
    const db = vecino(entorno, 'u1');
    const id = 'reclamo-mal-0004';
    await assertFails(setDoc(doc(db, `usuarios/u1/reclamos/${id}`), reclamo({ adjuntos: [adjunto('u2', id)] })));
    await assertFails(setDoc(doc(db, `usuarios/u1/reclamos/${id}`), reclamo({ adjuntos: [adjunto('u1', 'otro-reclamo-01')] })));
    await assertFails(setDoc(doc(db, `usuarios/u1/reclamos/${id}`), reclamo({ adjuntos: [adjunto('u1', id, 0, { tipo: 'text/html' })] })));
    await assertFails(setDoc(doc(db, `usuarios/u1/reclamos/${id}`), reclamo({ adjuntos: [adjunto('u1', id, 0, { tamano: 2097153 })] })));
  });

  it('cuatro adjuntos se rechazan y tres pasan', async () => {
    const db = vecino(entorno, 'u1');
    const id = 'reclamo-adj-0001';
    const cuatro = [0, 1, 2, 2].map((i) => adjunto('u1', id, i));
    await assertFails(setDoc(doc(db, `usuarios/u1/reclamos/${id}`), reclamo({ adjuntos: cuatro })));
    await assertSucceeds(setDoc(doc(db, `usuarios/u1/reclamos/${id}`), reclamo({ adjuntos: cuatro.slice(0, 3) })));
  });

  it('un nombre de adjunto de 101 caracteres se rechaza y de 100 pasa', async () => {
    const db = vecino(entorno, 'u1');
    const id = 'reclamo-adj-0002';
    await assertFails(setDoc(doc(db, `usuarios/u1/reclamos/${id}`), reclamo({ adjuntos: [adjunto('u1', id, 0, { nombre: 'n'.repeat(101) })] })));
    await assertSucceeds(setDoc(doc(db, `usuarios/u1/reclamos/${id}`), reclamo({ adjuntos: [adjunto('u1', id, 0, { nombre: 'n'.repeat(100) })] })));
  });

  it('categoría, descripción corta o un id corto se rechazan', async () => {
    const db = vecino(entorno, 'u1');
    await assertFails(setDoc(doc(db, 'usuarios/u1/reclamos/reclamo-mal-0005'), reclamo({ categoria: 'ruidos' })));
    await assertFails(setDoc(doc(db, 'usuarios/u1/reclamos/reclamo-mal-0006'), reclamo({ descripcion: 'corta' })));
    await assertFails(setDoc(doc(db, 'usuarios/u1/reclamos/r1'), reclamo()));
    await assertFails(setDoc(doc(vecino(entorno, 'u2'), 'usuarios/u1/reclamos/reclamo-mal-0007'), reclamo()));
  });

  it('el vecino no cambia el estado ni borra su reclamo', async () => {
    const db = vecino(entorno, 'u1');
    await assertFails(updateDoc(doc(db, 'usuarios/u1/reclamos/semilla-reclamo-1'), {
      estado: 'en_proceso', 'cronologia.en_proceso': serverTimestamp(), actualizadoEn: serverTimestamp(),
    }));
    await assertFails(loteAvance(db, { reclamoId: 'semilla-reclamo-1', estado: 'en_proceso', eventoId: 'ev-vecino-0001' }).commit());
    await assertFails(deleteDoc(doc(db, 'usuarios/u1/reclamos/semilla-reclamo-1')));
  });
});

describe('avance del admin', () => {
  it('saltar de recibido a resuelto se rechaza', async () => {
    const db = google(entorno, 'admin-google');
    await assertFails(loteAvance(db, { reclamoId: 'semilla-reclamo-1', estado: 'resuelto', eventoId: 'ev-reclamo-0001' }).commit());
  });

  it('avanzar sin evento, o con un evento de otro reclamo, se rechaza', async () => {
    const db = google(entorno, 'admin-google');
    await assertFails(loteAvance(db, { reclamoId: 'semilla-reclamo-1', estado: 'en_proceso', eventoId: 'ev-reclamo-0002', conEvento: false }).commit());
    await assertFails(loteAvance(db, { reclamoId: 'semilla-reclamo-1', estado: 'en_proceso', eventoId: 'ev-reclamo-0003', eventoRef: 'otro' }).commit());
    await assertFails(loteAvance(db, { reclamoId: 'semilla-reclamo-1', estado: 'en_proceso', eventoId: 'ev-reclamo-0004', eventoUid: 'u2' }).commit());
  });

  it('un admin con cuenta anónima no avanza el reclamo', async () => {
    const db = anonimo(entorno, 'admin-anonimo');
    await assertFails(loteAvance(db, { reclamoId: 'semilla-reclamo-1', estado: 'en_proceso', eventoId: 'ev-reclamo-0005' }).commit());
  });

  it('el admin pasa recibido → en_proceso con evento y después a resuelto', async () => {
    const db = google(entorno, 'admin-google');
    await assertSucceeds(loteAvance(db, { reclamoId: 'semilla-reclamo-1', estado: 'en_proceso', eventoId: 'ev-reclamo-0006', nota: 'Cuadrilla asignada.' }).commit());
    await assertFails(loteAvance(db, { reclamoId: 'semilla-reclamo-1', estado: 'en_proceso', eventoId: 'ev-reclamo-0007' }).commit());
    await assertSucceeds(loteAvance(db, { reclamoId: 'semilla-reclamo-1', estado: 'resuelto', eventoId: 'ev-reclamo-0008' }).commit());
    await assertFails(loteAvance(db, { reclamoId: 'semilla-reclamo-1', estado: 'recibido', eventoId: 'ev-reclamo-0009' }).commit());
  });

  it('el admin lista el grupo reclamos y el vecino no', async () => {
    const consulta = (db) => getDocs(query(collectionGroup(db, 'reclamos'), orderBy('creadoEn', 'desc'), limit(50)));
    await assertSucceeds(consulta(google(entorno, 'admin-google')));
    await assertFails(consulta(vecino(entorno, 'u1')));
    await assertFails(consulta(anonimo(entorno, 'admin-anonimo')));
    await assertSucceeds(getDocs(collection(vecino(entorno, 'u1'), 'usuarios/u1/reclamos')));
    await assertFails(getDocs(collection(vecino(entorno, 'u2'), 'usuarios/u1/reclamos')));
  });
});
