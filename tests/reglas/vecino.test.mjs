// Perfil del vecino: dueño, campos acotados, sin correo, cercanía sin coordenadas.
import { describe, it, before, after } from 'node:test';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { crearEntorno, vecino, sinSesion, sembrar, ts, assertSucceeds, assertFails, PREFERENCIAS, MIN } from './_entorno.mjs';

let entorno;

function perfil(cambios = {}) {
  return {
    nombre: 'Vecino', anonimo: false, creadoEn: serverTimestamp(), actualizadoEn: serverTimestamp(),
    preferencias: PREFERENCIAS, cercania: null, privacidadAceptadaEn: null, ...cambios,
  };
}

before(async () => {
  entorno = await crearEntorno();
  await sembrar(entorno, async (db) => {
    await setDoc(doc(db, 'usuarios/con-alta'), {
      nombre: 'Vecina', anonimo: true, creadoEn: ts(Date.now()), actualizadoEn: ts(Date.now()), altaEn: ts(Date.now()),
      preferencias: PREFERENCIAS, cercania: null, privacidadAceptadaEn: null,
    });
  });
});

after(async () => { await entorno?.cleanup(); });

describe('usuarios/{uid}', () => {
  it('el dueño crea y lee su perfil', async () => {
    const db = vecino(entorno, 'u1');
    await assertSucceeds(setDoc(doc(db, 'usuarios/u1'), perfil()));
    await assertSucceeds(getDoc(doc(db, 'usuarios/u1')));
  });

  it('otro vecino no lo lee ni lo escribe, y sin sesión tampoco', async () => {
    const otro = vecino(entorno, 'u2');
    await assertFails(getDoc(doc(otro, 'usuarios/u1')));
    await assertFails(updateDoc(doc(otro, 'usuarios/u1'), { nombre: 'Intruso', actualizadoEn: serverTimestamp() }));
    await assertFails(setDoc(doc(otro, 'usuarios/u3'), perfil()));
    await assertFails(getDoc(doc(sinSesion(entorno), 'usuarios/u1')));
  });

  it('se rechazan campos extra: email y altaEn', async () => {
    const db = vecino(entorno, 'u4');
    await assertFails(setDoc(doc(db, 'usuarios/u4'), perfil({ email: 'vecino@ejemplo.com' })));
    await assertFails(setDoc(doc(db, 'usuarios/u4'), perfil({ altaEn: serverTimestamp() })));
    await assertFails(setDoc(doc(db, 'usuarios/u4'), perfil({ creadoEn: ts(Date.now() - MIN) })));
    const conAlta = vecino(entorno, 'con-alta');
    await assertFails(updateDoc(doc(conAlta, 'usuarios/con-alta'), { altaEn: serverTimestamp(), actualizadoEn: serverTimestamp() }));
    await assertFails(updateDoc(doc(conAlta, 'usuarios/con-alta'), { email: 'x@ejemplo.com', actualizadoEn: serverTimestamp() }));
  });

  it('se rechazan preferencias con zona, tipo o frecuencia inválidos', async () => {
    const db = vecino(entorno, 'u5');
    await assertFails(setDoc(doc(db, 'usuarios/u5'), perfil({ preferencias: { ...PREFERENCIAS, zonas: ['oeste'] } })));
    await assertFails(setDoc(doc(db, 'usuarios/u5'), perfil({ preferencias: { ...PREFERENCIAS, tipos: ['spam'] } })));
    await assertFails(setDoc(doc(db, 'usuarios/u5'), perfil({ preferencias: { ...PREFERENCIAS, frecuencia: 'semanal' } })));
    await assertFails(setDoc(doc(db, 'usuarios/u5'), perfil({ preferencias: { ...PREFERENCIAS, extra: true } })));
    await assertFails(setDoc(doc(db, 'usuarios/u5'), perfil({ nombre: 'x'.repeat(81) })));
  });

  it('el dueño actualiza preferencias y privacidad', async () => {
    const db = vecino(entorno, 'con-alta');
    await assertSucceeds(updateDoc(doc(db, 'usuarios/con-alta'), {
      preferencias: { ...PREFERENCIAS, frecuencia: 'resumen_diario', zonas: ['norte'] }, actualizadoEn: serverTimestamp(),
    }));
    await assertSucceeds(updateDoc(doc(db, 'usuarios/con-alta'), {
      'preferencias.push': true, actualizadoEn: serverTimestamp(),
    }));
    await assertSucceeds(updateDoc(doc(db, 'usuarios/con-alta'), {
      privacidadAceptadaEn: serverTimestamp(), actualizadoEn: serverTimestamp(),
    }));
    // Sin pausa, el emulador puede atender este pedido en el mismo milisegundo que el anterior: el
    // actualizadoEn que quedó guardado coincide con request.time y la regla lo acepta.
    await new Promise((listo) => setTimeout(listo, 20));
    await assertFails(updateDoc(doc(db, 'usuarios/con-alta'), { nombre: 'Sin fecha' }));
  });

  it('cercanía: hasta 61 minutos pasa, más se rechaza, y nunca coordenadas', async () => {
    const db = vecino(entorno, 'con-alta');
    await assertSucceeds(updateDoc(doc(db, 'usuarios/con-alta'), {
      cercania: { alarmas: ['a1', 'a2'], vence: ts(Date.now() + 60 * MIN) }, actualizadoEn: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(db, 'usuarios/con-alta'), {
      cercania: { alarmas: ['a1'], vence: ts(Date.now() + 62 * MIN) }, actualizadoEn: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(db, 'usuarios/con-alta'), {
      cercania: { alarmas: ['a1'], vence: ts(Date.now() + 30 * MIN), lat: -31.4, lng: -62.08 }, actualizadoEn: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(db, 'usuarios/con-alta'), {
      cercania: { alarmas: Array.from({ length: 21 }, (_, i) => 'a' + i), vence: ts(Date.now() + 30 * MIN) },
      actualizadoEn: serverTimestamp(),
    }));
    await assertSucceeds(updateDoc(doc(db, 'usuarios/con-alta'), { cercania: null, actualizadoEn: serverTimestamp() }));
  });

  it('nadie hace list de usuarios ni borra un perfil', async () => {
    await assertFails(getDocs(collection(vecino(entorno, 'u1'), 'usuarios')));
    await assertFails(getDocs(collection(sinSesion(entorno), 'usuarios')));
    await assertFails(deleteDoc(doc(vecino(entorno, 'u1'), 'usuarios/u1')));
  });
});
