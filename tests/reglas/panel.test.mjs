// Panel municipal: el administrador lee pagos, cedulones y sesiones de cualquier vecino y finaliza una
// sesión de estacionamiento (solo fin y actualizadoEn, con el bloqueo de la patente en el mismo lote).
import { describe, it, before, after } from 'node:test';
import {
  doc, getDoc, getDocs, collectionGroup, query, where, orderBy, limit, setDoc, updateDoc, writeBatch, serverTimestamp,
  getAggregateFromServer, sum, count,
} from 'firebase/firestore';
import { crearEntorno, vecino, google, anonimo, sembrar, ts, assertSucceeds, assertFails, MIN } from './_entorno.mjs';

let entorno;
const ADMIN = 'admin-google';

function sesion(patente, finMs, cambios = {}) {
  return {
    patente, zonaId: 'p1', zonaNombre: 'Municipalidad, Bv. 9 de Julio', zona: 'centro', minutos: 60, importe: 800,
    inicio: ts(Date.now() - 10 * MIN), fin: ts(finMs), extensiones: 0, ultimoPagoId: 'x',
    avisoPorVencer: false, avisoFinalizado: false, actualizadoEn: ts(Date.now() - 10 * MIN), ...cambios,
  };
}

// Lote de "Finalizar sesión" del panel: sesión + bloqueo a la hora del servidor.
function loteFinalizar(db, uid, sesionId, patente, { sesionExtra = {}, bloqueo = {}, sinBloqueo = false } = {}) {
  const lote = writeBatch(db);
  lote.update(doc(db, `usuarios/${uid}/estacionamiento/${sesionId}`), { fin: serverTimestamp(), actualizadoEn: serverTimestamp(), ...sesionExtra });
  if (!sinBloqueo) lote.set(doc(db, `bloqueosPatente/${patente}`), { sesionId, fin: serverTimestamp(), ...bloqueo });
  return lote;
}

before(async () => {
  entorno = await crearEntorno();
  await sembrar(entorno, async (db) => {
    await setDoc(doc(db, `administradores/${ADMIN}`), { nombre: 'Admin', alta: ts(Date.now()) });
    await setDoc(doc(db, 'administradores/admin-anonimo'), { nombre: 'x', alta: ts(Date.now()) });
    for (const uid of ['u1', 'u2']) {
      await setDoc(doc(db, `usuarios/${uid}/pagos/pago-${uid}-0001`), {
        tipo: 'tributo', refId: 'T-1000', importe: 18500, comprobante: 'REC-00001000', proveedor: 'pasarela-simulada',
        creadoEn: ts(Date.now() - MIN), medio: 'credito',
      });
      await setDoc(doc(db, `usuarios/${uid}/tributos/T-0999`), {
        concepto: 'Tasa de servicios municipales', periodo: '08/2026', importe: 18500,
        vence: ts(Date.now() - 40 * 24 * 60 * MIN), pagadoEn: null, comprobante: null, pagoId: null,
      });
    }
    const fin = Date.now() + 60 * MIN;
    for (const [uid, id, patente] of [['u1', 'sesion-u1-0001', 'ABC123'], ['u2', 'sesion-u2-0001', 'DEF456'], ['u2', 'sesion-u2-0002', 'GHI789'], ['u2', 'sesion-u2-0003', 'JKL012']]) {
      await setDoc(doc(db, `usuarios/${uid}/estacionamiento/${id}`), sesion(patente, fin));
      await setDoc(doc(db, `bloqueosPatente/${patente}`), { sesionId: id, fin: ts(fin) });
    }
    // Sesión ya vencida (con su bloqueo vencido): no se "finaliza" de nuevo.
    await setDoc(doc(db, 'usuarios/u2/estacionamiento/sesion-vieja-001'), sesion('VVV999', Date.now() - 5 * MIN));
    await setDoc(doc(db, 'bloqueosPatente/VVV999'), { sesionId: 'sesion-vieja-001', fin: ts(Date.now() - 5 * MIN) });
  });
});

after(async () => { await entorno?.cleanup(); });

describe('lectura administrativa por grupo de colecciones', () => {
  it('el admin lista pagos, cedulones vencidos y sesiones activas de todos los vecinos', async () => {
    const adm = google(entorno, ADMIN);
    const pagos = await assertSucceeds(getDocs(query(collectionGroup(adm, 'pagos'), orderBy('creadoEn', 'desc'), limit(100))));
    if (pagos.size < 2) throw new Error(`se esperaban pagos de dos vecinos y llegaron ${pagos.size}`);
    await assertSucceeds(getDocs(query(collectionGroup(adm, 'tributos'), where('pagadoEn', '==', null), where('vence', '<', ts(Date.now())))));
    await assertSucceeds(getDocs(query(collectionGroup(adm, 'estacionamiento'), where('fin', '>', ts(Date.now())), orderBy('fin'))));
    await assertSucceeds(getDoc(doc(adm, 'usuarios/u2/estacionamiento/sesion-u2-0001')));
    await assertSucceeds(getAggregateFromServer(
      query(collectionGroup(adm, 'pagos'), where('tipo', '==', 'tributo'), where('creadoEn', '>=', ts(Date.now() - 60 * MIN))),
      { total: sum('importe'), cantidad: count() },
    ));
  });

  it('un vecino común no lista los grupos ni lee datos de otro vecino', async () => {
    const db = vecino(entorno, 'u1');
    await assertFails(getDocs(query(collectionGroup(db, 'pagos'), orderBy('creadoEn', 'desc'), limit(100))));
    await assertFails(getDocs(collectionGroup(db, 'tributos')));
    await assertFails(getDocs(query(collectionGroup(db, 'estacionamiento'), where('fin', '>', ts(Date.now())))));
    await assertFails(getDoc(doc(db, 'usuarios/u2/pagos/pago-u2-0001')));
    await assertFails(getDoc(doc(db, 'usuarios/u2/estacionamiento/sesion-u2-0001')));
  });

  it('una cuenta anónima con documento de administrador no lee los grupos', async () => {
    const db = anonimo(entorno, 'admin-anonimo');
    await assertFails(getDocs(query(collectionGroup(db, 'pagos'), orderBy('creadoEn', 'desc'), limit(10))));
    await assertFails(getDocs(collectionGroup(db, 'estacionamiento')));
  });
});

describe('finalizar sesión desde el panel', () => {
  it('un vecino común no finaliza la sesión de otro', async () => {
    await assertFails(loteFinalizar(vecino(entorno, 'u1'), 'u2', 'sesion-u2-0001', 'DEF456').commit());
  });

  it('el admin no cambia otros campos, no deja el bloqueo afuera ni lo desvía a otra sesión', async () => {
    const adm = google(entorno, ADMIN);
    await assertFails(loteFinalizar(adm, 'u2', 'sesion-u2-0001', 'DEF456', { sesionExtra: { importe: 0 } }).commit());
    await assertFails(loteFinalizar(adm, 'u2', 'sesion-u2-0001', 'DEF456', { sesionExtra: { patente: 'ZZZ999' } }).commit());
    await assertFails(loteFinalizar(adm, 'u2', 'sesion-u2-0001', 'DEF456', { sinBloqueo: true }).commit());
    await assertFails(loteFinalizar(adm, 'u2', 'sesion-u2-0001', 'DEF456', { bloqueo: { sesionId: 'otra-sesion-0001' } }).commit());
    await assertFails(loteFinalizar(adm, 'u2', 'sesion-u2-0001', 'DEF456', { bloqueo: { uid: 'u2' } }).commit());
    // fin distinto de la hora del servidor (extender o "finalizar" en el futuro).
    await assertFails(updateDoc(doc(adm, 'usuarios/u2/estacionamiento/sesion-u2-0001'), { fin: ts(Date.now() + 120 * MIN), actualizadoEn: serverTimestamp() }));
  });

  it('el admin no extiende ni crea bloqueos, ni libera uno a otra hora', async () => {
    const adm = google(entorno, ADMIN);
    await assertFails(setDoc(doc(adm, 'bloqueosPatente/GHI789'), { sesionId: 'sesion-u2-0002', fin: ts(Date.now() + 300 * MIN) }));
    await assertFails(setDoc(doc(adm, 'bloqueosPatente/NUE001'), { sesionId: 'sesion-nueva-0001', fin: serverTimestamp() }));
    await assertFails(setDoc(doc(adm, 'bloqueosPatente/GHI789'), { sesionId: 'sesion-u2-0002', fin: ts(Date.now() + 5 * MIN) }));
  });

  it('el admin finaliza una sesión activa y libera la patente a la hora del servidor', async () => {
    const adm = google(entorno, ADMIN);
    await assertSucceeds(loteFinalizar(adm, 'u2', 'sesion-u2-0001', 'DEF456').commit());
    let s; let b;
    await sembrar(entorno, async (db) => {
      s = (await getDoc(doc(db, 'usuarios/u2/estacionamiento/sesion-u2-0001'))).data();
      b = (await getDoc(doc(db, 'bloqueosPatente/DEF456'))).data();
    });
    if (s.fin.toMillis() > Date.now() + 5000 || s.importe !== 800) throw new Error('la sesión no quedó finalizada como se esperaba');
    if (b.sesionId !== 'sesion-u2-0001' || b.fin.toMillis() !== s.fin.toMillis()) throw new Error('el bloqueo no quedó liberado a la misma hora');
    // Ya terminada: no se vuelve a finalizar.
    await assertFails(loteFinalizar(adm, 'u2', 'sesion-u2-0001', 'DEF456').commit());
    await assertFails(loteFinalizar(adm, 'u2', 'sesion-vieja-001', 'VVV999').commit());
  });

  it('una cuenta anónima con documento de administrador no finaliza sesiones', async () => {
    await assertFails(loteFinalizar(anonimo(entorno, 'admin-anonimo'), 'u2', 'sesion-u2-0003', 'JKL012').commit());
  });
});
