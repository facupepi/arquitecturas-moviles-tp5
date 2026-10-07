// Notificaciones personales, avisos leídos y dispositivos: solo el dueño.
import { describe, it, before, after } from 'node:test';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { crearEntorno, vecino, sembrar, ts, assertSucceeds, assertFails } from './_entorno.mjs';

let entorno;
const ID_DISPOSITIVO = '0123456789abcdef0123456789abcdef';

function notificacion(cambios = {}) {
  return {
    titulo: 'Pago registrado', cuerpo: 'Comprobante REC-ABCDEFGH', tipo: 'tributos', zona: null,
    destino: '#/tributos/T-1001', enlace: null, creadoEn: serverTimestamp(), leida: false, leidaEn: null,
    origen: 'vecino', ...cambios,
  };
}

before(async () => {
  entorno = await crearEntorno();
  await sembrar(entorno, async (db) => {
    await setDoc(doc(db, 'usuarios/u1/notificaciones/bienvenida'), {
      titulo: 'Bienvenida', cuerpo: 'Te damos la bienvenida a Conecta.', tipo: 'servicios', zona: null, destino: '#/inicio',
      enlace: null, creadoEn: ts(Date.now()), leida: false, leidaEn: null, origen: 'servidor',
    });
  });
});

after(async () => { await entorno?.cleanup(); });

describe('notificaciones personales', () => {
  it('crear una personal de tipo tributos pasa y de tipo obras no', async () => {
    const db = vecino(entorno, 'u1');
    await assertSucceeds(setDoc(doc(db, 'usuarios/u1/notificaciones/pago-req-00000001'), notificacion()));
    await assertFails(setDoc(doc(db, 'usuarios/u1/notificaciones/obras-00000001'), notificacion({ tipo: 'obras' })));
  });

  it('se rechaza la que dice venir del servidor, con zona, enlace o ya leída', async () => {
    const db = vecino(entorno, 'u1');
    await assertFails(setDoc(doc(db, 'usuarios/u1/notificaciones/n-0001'), notificacion({ origen: 'servidor' })));
    await assertFails(setDoc(doc(db, 'usuarios/u1/notificaciones/n-0002'), notificacion({ zona: 'centro' })));
    await assertFails(setDoc(doc(db, 'usuarios/u1/notificaciones/n-0003'), notificacion({ enlace: 'https://ejemplo.com' })));
    await assertFails(setDoc(doc(db, 'usuarios/u1/notificaciones/n-0004'), notificacion({ leida: true })));
    await assertFails(setDoc(doc(db, 'usuarios/u1/notificaciones/n-0005'), notificacion({ destino: 'https://ejemplo.com' })));
    await assertFails(setDoc(doc(vecino(entorno, 'u2'), 'usuarios/u1/notificaciones/n-0006'), notificacion()));
  });

  it('marcar leída pasa y cambiar el título no', async () => {
    const db = vecino(entorno, 'u1');
    await assertSucceeds(updateDoc(doc(db, 'usuarios/u1/notificaciones/bienvenida'), { leida: true, leidaEn: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'usuarios/u1/notificaciones/bienvenida'), { titulo: 'Otro título' }));
    await assertFails(updateDoc(doc(db, 'usuarios/u1/notificaciones/bienvenida'), { leida: false, leidaEn: null }));
    await assertFails(updateDoc(doc(vecino(entorno, 'u2'), 'usuarios/u1/notificaciones/bienvenida'), { leida: true, leidaEn: serverTimestamp() }));
  });

  it('solo el dueño lee y borra sus notificaciones', async () => {
    await assertSucceeds(getDocs(collection(vecino(entorno, 'u1'), 'usuarios/u1/notificaciones')));
    await assertFails(getDocs(collection(vecino(entorno, 'u2'), 'usuarios/u1/notificaciones')));
    await assertFails(deleteDoc(doc(vecino(entorno, 'u2'), 'usuarios/u1/notificaciones/pago-req-00000001')));
    await assertSucceeds(deleteDoc(doc(vecino(entorno, 'u1'), 'usuarios/u1/notificaciones/pago-req-00000001')));
  });
});

describe('avisos leídos', () => {
  it('marcar dos veces el mismo aviso pasa (idempotente)', async () => {
    const db = vecino(entorno, 'u1');
    await assertSucceeds(setDoc(doc(db, 'usuarios/u1/avisosLeidos/av-obras-centro'), { leidoEn: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(db, 'usuarios/u1/avisosLeidos/av-obras-centro'), { leidoEn: serverTimestamp() }));
  });

  it('se rechaza otra fecha, campos extra o el aviso leído de otro', async () => {
    const db = vecino(entorno, 'u1');
    await assertFails(setDoc(doc(db, 'usuarios/u1/avisosLeidos/av-corte-sur'), { leidoEn: ts(Date.now() - 60_000) }));
    await assertFails(setDoc(doc(db, 'usuarios/u1/avisosLeidos/av-corte-sur'), { leidoEn: serverTimestamp(), extra: 1 }));
    await assertFails(setDoc(doc(vecino(entorno, 'u2'), 'usuarios/u1/avisosLeidos/av-corte-sur'), { leidoEn: serverTimestamp() }));
    await assertFails(getDoc(doc(vecino(entorno, 'u2'), 'usuarios/u1/avisosLeidos/av-obras-centro')));
  });
});

describe('dispositivos', () => {
  const datos = () => ({ token: 'token-fcm-'.padEnd(40, 'x'), plataforma: 'web', actualizadoEn: serverTimestamp() });

  it('el dueño registra un dispositivo con id de 32 hex, lo actualiza, lo lista y lo borra', async () => {
    const db = vecino(entorno, 'u1');
    await assertSucceeds(setDoc(doc(db, `usuarios/u1/dispositivos/${ID_DISPOSITIVO}`), datos()));
    await assertSucceeds(setDoc(doc(db, `usuarios/u1/dispositivos/${ID_DISPOSITIVO}`), datos()));
    await assertSucceeds(getDocs(collection(db, 'usuarios/u1/dispositivos')));
    await assertSucceeds(deleteDoc(doc(db, `usuarios/u1/dispositivos/${ID_DISPOSITIVO}`)));
  });

  it('se rechaza un id que no es de 32 hex, un token corto o campos extra', async () => {
    const db = vecino(entorno, 'u1');
    await assertFails(setDoc(doc(db, 'usuarios/u1/dispositivos/dispositivo-1'), datos()));
    await assertFails(setDoc(doc(db, `usuarios/u1/dispositivos/${ID_DISPOSITIVO.toUpperCase()}`), datos()));
    await assertFails(setDoc(doc(db, `usuarios/u1/dispositivos/${ID_DISPOSITIVO}`), { ...datos(), token: 'corto' }));
    await assertFails(setDoc(doc(db, `usuarios/u1/dispositivos/${ID_DISPOSITIVO}`), { ...datos(), lat: -31.4 }));
  });

  it('otro vecino no lee ni escribe los dispositivos ajenos', async () => {
    const otro = vecino(entorno, 'u2');
    await assertFails(setDoc(doc(otro, `usuarios/u1/dispositivos/${ID_DISPOSITIVO}`), datos()));
    await assertFails(getDocs(collection(otro, 'usuarios/u1/dispositivos')));
  });
});
