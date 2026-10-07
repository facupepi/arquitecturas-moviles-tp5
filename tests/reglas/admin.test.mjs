// Administración: administradores solo desde la consola, bandeja de eventos y config de la demo.
import { describe, it, before, after } from 'node:test';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { crearEntorno, vecino, google, sembrar, ts, assertSucceeds, assertFails } from './_entorno.mjs';

let entorno;

function evento(cambios = {}) {
  return { tipo: 'aviso', refId: 'aviso-0001', uid: null, origen: 'panel', estado: 'pendiente', intentos: 0, creadoEn: serverTimestamp(), ...cambios };
}

before(async () => {
  entorno = await crearEntorno();
  await sembrar(entorno, async (db) => {
    await setDoc(doc(db, 'administradores/admin-google'), { nombre: 'Admin', alta: ts(Date.now()) });
    await setDoc(doc(db, 'municipal/config'), {
      simuladorActivo: false, simuladorCadaMin: 2, horarioEstricto: true, avisoEstacionamientoMin: 5,
      ultimaSimulacion: null, actualizadoEn: ts(Date.now()),
    });
    await setDoc(doc(db, 'eventos/ev-existente'), {
      tipo: 'aviso', refId: 'aviso-x', uid: null, origen: 'panel', estado: 'pendiente', intentos: 0, creadoEn: ts(Date.now()),
    });
  });
});

after(async () => { await entorno?.cleanup(); });

describe('administradores', () => {
  it('no se escribe desde el cliente, ni siquiera un admin', async () => {
    await assertFails(setDoc(doc(google(entorno, 'u1'), 'administradores/u1'), { nombre: 'Yo', alta: serverTimestamp() }));
    await assertFails(setDoc(doc(google(entorno, 'admin-google'), 'administradores/otro'), { nombre: 'Otro', alta: serverTimestamp() }));
    await assertFails(updateDoc(doc(google(entorno, 'admin-google'), 'administradores/admin-google'), { nombre: 'Cambio' }));
    await assertFails(deleteDoc(doc(google(entorno, 'admin-google'), 'administradores/admin-google')));
  });

  it('el dueño lee el suyo; nadie lee el ajeno ni lista', async () => {
    await assertSucceeds(getDoc(doc(google(entorno, 'admin-google'), 'administradores/admin-google')));
    await assertSucceeds(getDoc(doc(vecino(entorno, 'u1'), 'administradores/u1')));
    await assertFails(getDoc(doc(vecino(entorno, 'u1'), 'administradores/admin-google')));
    await assertFails(getDocs(collection(google(entorno, 'admin-google'), 'administradores')));
  });
});

describe('eventos (bandeja de salida)', () => {
  it('el admin crea un evento pendiente y lo lee; un vecino no', async () => {
    const adm = google(entorno, 'admin-google');
    await assertSucceeds(setDoc(doc(adm, 'eventos/ev-nuevo-0001'), evento()));
    await assertSucceeds(getDoc(doc(adm, 'eventos/ev-nuevo-0001')));
    await assertFails(setDoc(doc(vecino(entorno, 'u1'), 'eventos/ev-nuevo-0002'), evento()));
    await assertFails(getDoc(doc(vecino(entorno, 'u1'), 'eventos/ev-nuevo-0001')));
  });

  it('se rechaza un evento con estado, origen, intentos o tipo inválidos, o de reclamo sin uid', async () => {
    const adm = google(entorno, 'admin-google');
    await assertFails(setDoc(doc(adm, 'eventos/ev-mal-0001'), evento({ estado: 'enviado' })));
    await assertFails(setDoc(doc(adm, 'eventos/ev-mal-0002'), evento({ origen: 'simulador' })));
    await assertFails(setDoc(doc(adm, 'eventos/ev-mal-0003'), evento({ intentos: 1 })));
    await assertFails(setDoc(doc(adm, 'eventos/ev-mal-0004'), evento({ tipo: 'bicicletas' })));
    await assertFails(setDoc(doc(adm, 'eventos/ev-mal-0005'), evento({ tipo: 'reclamo', uid: null })));
  });

  it('no se actualiza ni se borra desde el cliente', async () => {
    const adm = google(entorno, 'admin-google');
    await assertFails(updateDoc(doc(adm, 'eventos/ev-existente'), { estado: 'enviado' }));
    await assertFails(deleteDoc(doc(adm, 'eventos/ev-existente')));
  });
});

describe('municipal/config', () => {
  it('el admin cambia solo los campos permitidos', async () => {
    const adm = google(entorno, 'admin-google');
    await assertSucceeds(updateDoc(doc(adm, 'municipal/config'), {
      simuladorActivo: true, simuladorCadaMin: 5, horarioEstricto: false, avisoEstacionamientoMin: 14, actualizadoEn: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(adm, 'municipal/config'), { ultimaSimulacion: serverTimestamp(), actualizadoEn: serverTimestamp() }));
    await assertFails(updateDoc(doc(adm, 'municipal/config'), { otro: 1, actualizadoEn: serverTimestamp() }));
    await assertFails(updateDoc(doc(adm, 'municipal/config'), { simuladorCadaMin: 31, actualizadoEn: serverTimestamp() }));
    await assertFails(updateDoc(doc(adm, 'municipal/config'), { simuladorActivo: false }));
  });

  it('avisoEstacionamientoMin fuera de 1..14 se rechaza', async () => {
    const adm = google(entorno, 'admin-google');
    await assertFails(updateDoc(doc(adm, 'municipal/config'), { avisoEstacionamientoMin: 15, actualizadoEn: serverTimestamp() }));
    await assertFails(updateDoc(doc(adm, 'municipal/config'), { avisoEstacionamientoMin: 0, actualizadoEn: serverTimestamp() }));
    await assertFails(updateDoc(doc(adm, 'municipal/config'), { avisoEstacionamientoMin: 5.5, actualizadoEn: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(adm, 'municipal/config'), { avisoEstacionamientoMin: 1, actualizadoEn: serverTimestamp() }));
  });

  it('un vecino o un admin anónimo no cambian la config', async () => {
    await assertFails(updateDoc(doc(vecino(entorno, 'u1'), 'municipal/config'), { simuladorActivo: true, actualizadoEn: serverTimestamp() }));
    await sembrar(entorno, (db) => setDoc(doc(db, 'administradores/admin-anonimo'), { nombre: 'x', alta: ts(Date.now()) }));
    await assertFails(updateDoc(doc(vecino(entorno, 'admin-anonimo'), 'municipal/config'), { simuladorActivo: true, actualizadoEn: serverTimestamp() }));
  });
});
