// Tarjetas guardadas (medios de pago): solo el dueño, claves exactas, nunca el número completo ni el
// código de seguridad, hasta 5 tarjetas (lugares fijos tarjeta-1 … tarjeta-5) y sin update.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { crearEntorno, vecino, anonimo, sinSesion, sembrar, ts, assertSucceeds, assertFails, MIN } from './_entorno.mjs';

let entorno;

function tarjeta(cambios = {}) {
  return {
    tipo: 'credito', red: 'Visa', ultimos4: '4242', titular: 'Ana Pérez', vence: '08/30', creadoEn: serverTimestamp(), ...cambios,
  };
}

before(async () => {
  entorno = await crearEntorno();
  await sembrar(entorno, async (db) => {
    await setDoc(doc(db, 'usuarios/u2/tarjetas/tarjeta-1'), { ...tarjeta(), creadoEn: ts(Date.now()) });
    await setDoc(doc(db, 'administradores/admin-1'), { nombre: 'Admin', alta: ts(Date.now()) });
  });
});

after(async () => { await entorno?.cleanup(); });

describe('usuarios/{uid}/tarjetas', () => {
  it('una tarjeta válida se acepta, el dueño la lee y la lista', async () => {
    const db = vecino(entorno, 'u1');
    await assertSucceeds(setDoc(doc(db, 'usuarios/u1/tarjetas/tarjeta-1'), tarjeta()));
    await assertSucceeds(setDoc(doc(db, 'usuarios/u1/tarjetas/tarjeta-2'), tarjeta({ tipo: 'debito', red: 'Mastercard', ultimos4: '8210', vence: '12/29' })));
    await assertSucceeds(setDoc(doc(db, 'usuarios/u1/tarjetas/tarjeta-3'), tarjeta({ red: 'American Express', ultimos4: '0005', titular: 'Jo' })));
    await assertSucceeds(setDoc(doc(db, 'usuarios/u1/tarjetas/tarjeta-4'), tarjeta({ red: 'Tarjeta', ultimos4: '1117', titular: 'x'.repeat(60) })));
    const leida = (await getDoc(doc(db, 'usuarios/u1/tarjetas/tarjeta-1'))).data();
    assert.deepEqual(Object.keys(leida).sort(), ['creadoEn', 'red', 'tipo', 'titular', 'ultimos4', 'vence']);
    assert.equal((await getDocs(collection(db, 'usuarios/u1/tarjetas'))).size, 4);
  });

  it('con el número completo, el código de seguridad o cualquier campo de más se rechaza', async () => {
    const db = vecino(entorno, 'u3');
    const ruta = 'usuarios/u3/tarjetas/tarjeta-1';
    await assertFails(setDoc(doc(db, ruta), tarjeta({ numero: '4242424242424242' })));
    await assertFails(setDoc(doc(db, ruta), tarjeta({ cvv: '123' })));
    await assertFails(setDoc(doc(db, ruta), tarjeta({ codigoSeguridad: '123' })));
    await assertFails(setDoc(doc(db, ruta), tarjeta({ alias: 'La de siempre' })));
    const { titular, ...sinTitular } = tarjeta();
    await assertFails(setDoc(doc(db, ruta), sinTitular));
    await assertSucceeds(setDoc(doc(db, ruta), tarjeta()));
  });

  it('ultimos4 tiene que ser un texto de 4 dígitos', async () => {
    const db = vecino(entorno, 'u4');
    const ruta = 'usuarios/u4/tarjetas/tarjeta-1';
    for (const ultimos4 of ['4242424242424242', '424', '42424', 'abcd', 4242, null]) {
      await assertFails(setDoc(doc(db, ruta), tarjeta({ ultimos4 })));
    }
  });

  it('tipo, red, vencimiento, titular y creadoEn se controlan', async () => {
    const db = vecino(entorno, 'u5');
    const ruta = 'usuarios/u5/tarjetas/tarjeta-1';
    for (const tipo of ['billetera', 'transferencia', 'Credito', null]) await assertFails(setDoc(doc(db, ruta), tarjeta({ tipo })));
    for (const red of ['Diners', 'visa', '', null]) await assertFails(setDoc(doc(db, ruta), tarjeta({ red })));
    for (const vence of ['8/30', '13/30', '00/30', '08/2030', '0830', '08-30', null]) await assertFails(setDoc(doc(db, ruta), tarjeta({ vence })));
    for (const titular of ['A', 'x'.repeat(61), 'Ana 4242 4242 4242 4242', 42]) await assertFails(setDoc(doc(db, ruta), tarjeta({ titular })));
    await assertFails(setDoc(doc(db, ruta), tarjeta({ creadoEn: ts(Date.now() - MIN) })));
  });

  it('solo en los cinco lugares fijos: el tope de 5 tarjetas sin leer la colección', async () => {
    const db = vecino(entorno, 'u6');
    for (const id of ['tarjeta-0', 'tarjeta-6', 'mi-tarjeta', '4242']) {
      await assertFails(setDoc(doc(db, `usuarios/u6/tarjetas/${id}`), tarjeta()));
    }
    for (let i = 1; i <= 5; i += 1) await assertSucceeds(setDoc(doc(db, `usuarios/u6/tarjetas/tarjeta-${i}`), tarjeta()));
  });

  it('no se modifica: solo se quita (y el dueño puede volver a cargarla)', async () => {
    const db = vecino(entorno, 'u1');
    await assertFails(updateDoc(doc(db, 'usuarios/u1/tarjetas/tarjeta-1'), { titular: 'Otra Persona' }));
    await assertFails(setDoc(doc(db, 'usuarios/u1/tarjetas/tarjeta-1'), tarjeta({ ultimos4: '1111' })));   // set sobre una existente = update
    await assertSucceeds(deleteDoc(doc(db, 'usuarios/u1/tarjetas/tarjeta-1')));
    await assertSucceeds(setDoc(doc(db, 'usuarios/u1/tarjetas/tarjeta-1'), tarjeta({ ultimos4: '1111' })));
  });

  it('las tarjetas de otro vecino no se leen, no se crean ni se quitan', async () => {
    const otro = vecino(entorno, 'u1');
    await assertFails(getDoc(doc(otro, 'usuarios/u2/tarjetas/tarjeta-1')));
    await assertFails(getDocs(collection(otro, 'usuarios/u2/tarjetas')));
    await assertFails(setDoc(doc(otro, 'usuarios/u2/tarjetas/tarjeta-2'), tarjeta()));
    await assertFails(deleteDoc(doc(otro, 'usuarios/u2/tarjetas/tarjeta-1')));
    await assertFails(getDoc(doc(sinSesion(entorno), 'usuarios/u2/tarjetas/tarjeta-1')));
    await assertFails(getDoc(doc(anonimo(entorno, 'u2'), 'usuarios/u2/tarjetas/tarjeta-1')));
    await assertFails(setDoc(doc(anonimo(entorno, 'u7'), 'usuarios/u7/tarjetas/tarjeta-1'), tarjeta()));
    // Ni el personal municipal: el panel no necesita las tarjetas de nadie.
    const admin = vecino(entorno, 'admin-1');
    await assertFails(getDoc(doc(admin, 'usuarios/u2/tarjetas/tarjeta-1')));
    await assertFails(getDocs(collectionGroup(admin, 'tarjetas')));
  });
});
