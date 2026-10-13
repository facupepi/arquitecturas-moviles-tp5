// Pago de tributos: el importe sale del tributo, idempotencia por requestId, solo el dueño.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { crearEntorno, vecino, sembrar, ts, assertSucceeds, assertFails, MIN } from './_entorno.mjs';

let entorno;
const DIA = 24 * 60 * MIN;

function tributo(importe, cambios = {}) {
  return {
    concepto: 'Tasa de servicios municipales', periodo: '10/2026', cuenta: 'CTA-1', importe,
    vence: ts(Date.now() + 2 * DIA), pagadoEn: null, comprobante: null, pagoId: null, ...cambios,
  };
}

// medio: el elegido en la pasarela; sinMedio: el pago no lo trae. medioTributo: el que se copia al
// tributo (por defecto, el mismo del pago); sinMedioTributo: el tributo no lo copia.
function lotePago(db, uid, { pagoId, tributoId, importe, comprobante = 'REC-' + pagoId.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase(), conTributo = true, conPago = true, notificacion = false, medio = 'credito', medioTributo = medio, sinMedio = false, sinMedioTributo = sinMedio }) {
  const lote = writeBatch(db);
  if (conPago) {
    const pago = { tipo: 'tributo', refId: tributoId, importe, comprobante, proveedor: 'pasarela-simulada', creadoEn: serverTimestamp() };
    if (!sinMedio) pago.medio = medio;
    lote.set(doc(db, `usuarios/${uid}/pagos/${pagoId}`), pago);
  }
  if (conTributo) {
    const cambios = { pagadoEn: serverTimestamp(), comprobante, pagoId };
    if (!sinMedioTributo) cambios.medio = medioTributo;
    lote.update(doc(db, `usuarios/${uid}/tributos/${tributoId}`), cambios);
  }
  if (notificacion) {
    lote.set(doc(db, `usuarios/${uid}/notificaciones/pago-${pagoId}`), {
      titulo: 'Pago registrado', cuerpo: `Comprobante ${comprobante}`, tipo: 'tributos', zona: null,
      destino: `#/tributos/${tributoId}`, enlace: null, creadoEn: serverTimestamp(), leida: false, leidaEn: null, origen: 'vecino',
    });
  }
  return lote;
}

before(async () => {
  entorno = await crearEntorno();
  await sembrar(entorno, async (db) => {
    await setDoc(doc(db, 'usuarios/u1/tributos/T-1001'), tributo(18500));
    await setDoc(doc(db, 'usuarios/u1/tributos/T-1002'), tributo(24750));
    await setDoc(doc(db, 'usuarios/u1/tributos/T-0999'), tributo(18500, { vence: ts(Date.now() - 40 * DIA) }));
    await setDoc(doc(db, 'usuarios/u1/tributos/T-1000'), tributo(18500, {
      pagadoEn: ts(Date.now() - 22 * DIA), comprobante: 'REC-00001000', pagoId: 'semilla-T-1000',
    }));
    await setDoc(doc(db, 'usuarios/u2/tributos/T-1001'), tributo(18500));
  });
});

after(async () => { await entorno?.cleanup(); });

describe('tributos y pagos', () => {
  it('el dueño lee sus tributos y otro vecino no', async () => {
    await assertSucceeds(getDoc(doc(vecino(entorno, 'u1'), 'usuarios/u1/tributos/T-1001')));
    await assertFails(getDoc(doc(vecino(entorno, 'u2'), 'usuarios/u1/tributos/T-1001')));
  });

  it('el pago correcto en lote (pago, tributo y notificación) pasa', async () => {
    const db = vecino(entorno, 'u1');
    await assertSucceeds(lotePago(db, 'u1', { pagoId: 'pago-aaaa-0001', tributoId: 'T-1001', importe: 18500, notificacion: true }).commit());
    await assertSucceeds(getDoc(doc(db, 'usuarios/u1/pagos/pago-aaaa-0001')));
  });

  it('el pago guarda el medio elegido, en el pago y en el tributo', async () => {
    const db = vecino(entorno, 'u1');
    const pago = (await getDoc(doc(db, 'usuarios/u1/pagos/pago-aaaa-0001'))).data();
    assert.equal(pago.medio, 'credito');
    assert.equal((await getDoc(doc(db, 'usuarios/u1/tributos/T-1001'))).data().medio, 'credito');
  });

  it('sin medio, con un medio inválido o con otro medio en el tributo se rechaza', async () => {
    const db = vecino(entorno, 'u1');
    // El pago no trae medio (pagos nuevos: es obligatorio).
    await assertFails(lotePago(db, 'u1', { pagoId: 'pago-medio-0001', tributoId: 'T-1002', importe: 24750, sinMedio: true }).commit());
    await assertFails(lotePago(db, 'u1', { pagoId: 'pago-medio-0002', tributoId: 'T-1002', importe: 24750, medio: null }).commit());
    // Medios fuera de la lista (marcas, mayúsculas, datos de tarjeta).
    for (const [i, medio] of ['efectivo', 'Credito', 'visa', '4111111111111111', 1].entries()) {
      await assertFails(lotePago(db, 'u1', { pagoId: `pago-medio-01${i}0`, tributoId: 'T-1002', importe: 24750, medio }).commit());
    }
    // El tributo dice otro medio, o no lo copia.
    await assertFails(lotePago(db, 'u1', { pagoId: 'pago-medio-0003', tributoId: 'T-1002', importe: 24750, medio: 'debito', medioTributo: 'billetera' }).commit());
    await assertFails(lotePago(db, 'u1', { pagoId: 'pago-medio-0004', tributoId: 'T-1002', importe: 24750, medio: 'debito', sinMedioTributo: true }).commit());
    // Campos de más en el pago (por ejemplo, un número de tarjeta) también.
    const lote = writeBatch(db);
    lote.set(doc(db, 'usuarios/u1/pagos/pago-medio-0005'), {
      tipo: 'tributo', refId: 'T-1002', importe: 24750, comprobante: 'REC-PAGOMED5', medio: 'credito', tarjeta: '4111111111111111',
      proveedor: 'pasarela-simulada', creadoEn: serverTimestamp(),
    });
    lote.update(doc(db, 'usuarios/u1/tributos/T-1002'), { pagadoEn: serverTimestamp(), comprobante: 'REC-PAGOMED5', pagoId: 'pago-medio-0005', medio: 'credito' });
    await assertFails(lote.commit());
  });

  it('cada medio de la lista pasa', async () => {
    const db = vecino(entorno, 'u1');
    for (const [i, medio] of ['debito', 'billetera', 'transferencia'].entries()) {
      await sembrar(entorno, (adm) => setDoc(doc(adm, `usuarios/u1/tributos/T-M${i}`), tributo(1000)));
      await assertSucceeds(lotePago(db, 'u1', { pagoId: `pago-lista-000${i}`, tributoId: `T-M${i}`, importe: 1000, medio }).commit());
    }
  });

  it('pagar un tributo vencido también pasa', async () => {
    const db = vecino(entorno, 'u1');
    await assertSucceeds(lotePago(db, 'u1', { pagoId: 'pago-vencido-01', tributoId: 'T-0999', importe: 18500 }).commit());
  });

  it('un importe distinto se rechaza', async () => {
    const db = vecino(entorno, 'u1');
    await assertFails(lotePago(db, 'u1', { pagoId: 'pago-bbbb-0001', tributoId: 'T-1002', importe: 1 }).commit());
    await assertFails(lotePago(db, 'u1', { pagoId: 'pago-bbbb-0002', tributoId: 'T-1002', importe: 24751 }).commit());
  });

  it('un comprobante que no cumple el formato se rechaza', async () => {
    const db = vecino(entorno, 'u1');
    await assertFails(lotePago(db, 'u1', { pagoId: 'pago-cccc-0001', tributoId: 'T-1002', importe: 24750, comprobante: 'EST-AAAAAAAA' }).commit());
    await assertFails(lotePago(db, 'u1', { pagoId: 'pago-cccc-0002', tributoId: 'T-1002', importe: 24750, comprobante: 'REC-abc' }).commit());
  });

  it('pagar un tributo ya pagado se rechaza', async () => {
    const db = vecino(entorno, 'u1');
    await assertFails(lotePago(db, 'u1', { pagoId: 'pago-dddd-0001', tributoId: 'T-1000', importe: 18500 }).commit());
    await assertFails(lotePago(db, 'u1', { pagoId: 'pago-dddd-0002', tributoId: 'T-1001', importe: 18500 }).commit());
  });

  it('repetir el mismo requestId se rechaza (idempotencia)', async () => {
    const db = vecino(entorno, 'u1');
    await assertFails(lotePago(db, 'u1', { pagoId: 'pago-aaaa-0001', tributoId: 'T-1002', importe: 24750 }).commit());
    await assertFails(setDoc(doc(db, 'usuarios/u1/pagos/pago-aaaa-0001'), {
      tipo: 'tributo', refId: 'T-1001', importe: 18500, comprobante: 'REC-PAGOAAAA', medio: 'credito', proveedor: 'pasarela-simulada', creadoEn: serverTimestamp(),
    }));
    await assertFails(deleteDoc(doc(db, 'usuarios/u1/pagos/pago-aaaa-0001')));
  });

  it('pagar el tributo de otro vecino se rechaza', async () => {
    const db = vecino(entorno, 'u1');
    await assertFails(lotePago(db, 'u2', { pagoId: 'pago-eeee-0001', tributoId: 'T-1001', importe: 18500 }).commit());
  });

  it('actualizar el tributo sin el pago en el lote se rechaza', async () => {
    const db = vecino(entorno, 'u1');
    await assertFails(lotePago(db, 'u1', { pagoId: 'pago-ffff-0001', tributoId: 'T-1002', importe: 24750, conPago: false }).commit());
    await assertFails(updateDoc(doc(db, 'usuarios/u1/tributos/T-1002'), { importe: 1 }));
  });

  it('el pago sin actualizar el tributo en el lote se rechaza', async () => {
    const db = vecino(entorno, 'u1');
    await assertFails(lotePago(db, 'u1', { pagoId: 'pago-gggg-0001', tributoId: 'T-1002', importe: 24750, conTributo: false }).commit());
  });

  it('el vecino no crea tributos', async () => {
    const db = vecino(entorno, 'u1');
    await assertFails(setDoc(doc(db, 'usuarios/u1/tributos/T-9999'), tributo(1)));
  });
});
