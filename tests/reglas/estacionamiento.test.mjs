// Estacionamiento medido: importe, horario, bloqueo de patente sin uid, extensión y finalización.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { doc, getDoc, getDocs, collection, setDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { crearEntorno, vecino, sinSesion, sembrar, ts, assertSucceeds, assertFails, MIN, ahoraCordoba } from './_entorno.mjs';

let entorno;
const TODOS_LOS_DIAS = { dias: [1, 2, 3, 4, 5, 6, 7], desde: 0, hasta: 24 };

const zonas = {
  p1: { nombre: 'Municipalidad, Bv. 9 de Julio', zona: 'centro', tarifaHora: 800, horario: TODOS_LOS_DIAS },
  cerrada: { nombre: 'Zona sin horario', zona: 'centro', tarifaHora: 800, horario: { dias: [], desde: 0, hasta: 24 } },
};

function comprobante(prefijo, id) {
  return `${prefijo}-${id.replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase().padStart(8, '0')}`;
}

// Arma el lote de inicio: sesión + bloqueo + pago, con la opción de romper cada parte.
function loteInicio(db, uid, {
  sesionId, patente, zonaId = 'p1', minutos = 60, importe, fin, zonaNombre, zona = 'centro',
  sinBloqueo = false, sinPago = false, bloqueoExtra = {}, finBloqueo,
}) {
  const z = zonas[zonaId] || zonas.p1;   // las zonas de la prueba de dayOfWeek copian p1
  const finTs = fin ?? ts(Date.now() + minutos * MIN);
  const lote = writeBatch(db);
  lote.set(doc(db, `usuarios/${uid}/estacionamiento/${sesionId}`), {
    patente, zonaId, zonaNombre: zonaNombre ?? z.nombre, zona, minutos,
    importe: importe ?? (z.tarifaHora * minutos) / 60,
    inicio: serverTimestamp(), fin: finTs, extensiones: 0, ultimoPagoId: sesionId,
    avisoPorVencer: false, avisoFinalizado: false, actualizadoEn: serverTimestamp(),
  });
  if (!sinBloqueo) {
    lote.set(doc(db, `bloqueosPatente/${patente}`), { sesionId, fin: finBloqueo ?? finTs, ...bloqueoExtra });
  }
  if (!sinPago) {
    lote.set(doc(db, `usuarios/${uid}/pagos/${sesionId}`), {
      tipo: 'estacionamiento', refId: sesionId, importe: importe ?? (z.tarifaHora * minutos) / 60,
      comprobante: comprobante('EST', sesionId), proveedor: 'pasarela-simulada', creadoEn: serverTimestamp(),
    });
  }
  return { lote, fin: finTs };
}

// Lote de extensión sobre una sesión conocida (minutos, importe y fin actuales).
function loteExtension(db, uid, { sesionId, patente, actual, extra = 15, pagoId, importeExtra, sinBloqueo = false, sinPago = false, tarifa = 800 }) {
  const minutos = actual.minutos + extra;
  const fin = ts(actual.fin.toMillis() + extra * MIN);
  const importeDelta = importeExtra ?? (tarifa * extra) / 60;
  const lote = writeBatch(db);
  lote.update(doc(db, `usuarios/${uid}/estacionamiento/${sesionId}`), {
    minutos, importe: actual.importe + importeDelta, fin, extensiones: actual.extensiones + 1,
    ultimoPagoId: pagoId, avisoPorVencer: false, actualizadoEn: serverTimestamp(),
  });
  if (!sinBloqueo) lote.set(doc(db, `bloqueosPatente/${patente}`), { sesionId, fin });
  if (!sinPago) {
    lote.set(doc(db, `usuarios/${uid}/pagos/${pagoId}`), {
      tipo: 'extension', refId: sesionId, importe: importeDelta, comprobante: comprobante('EXT', pagoId),
      proveedor: 'pasarela-simulada', creadoEn: serverTimestamp(),
    });
  }
  return { lote, nuevo: { minutos, fin, importe: actual.importe + importeDelta, extensiones: actual.extensiones + 1 } };
}

function loteFinalizar(db, uid, { sesionId, patente, fin = serverTimestamp(), finBloqueo = serverTimestamp(), sinBloqueo = false }) {
  const lote = writeBatch(db);
  lote.update(doc(db, `usuarios/${uid}/estacionamiento/${sesionId}`), { fin, actualizadoEn: serverTimestamp() });
  if (!sinBloqueo) lote.set(doc(db, `bloqueosPatente/${patente}`), { sesionId, fin: finBloqueo });
  return lote;
}

async function fijarHorarioEstricto(valor) {
  await sembrar(entorno, (db) => setDoc(doc(db, 'municipal/config'), {
    simuladorActivo: false, simuladorCadaMin: 2, horarioEstricto: valor, avisoEstacionamientoMin: 5,
    ultimaSimulacion: null, actualizadoEn: ts(Date.now()),
  }));
}

before(async () => {
  entorno = await crearEntorno();
  await fijarHorarioEstricto(true);
  await sembrar(entorno, async (db) => {
    for (const [id, z] of Object.entries(zonas)) await setDoc(doc(db, 'zonasEstacionamiento', id), z);
    // Patente ocupada por otra cuenta hasta dentro de una hora, y una vencida hace un minuto.
    await setDoc(doc(db, 'bloqueosPatente/AAA111'), { sesionId: 'sesion-ajena-0001', fin: ts(Date.now() + 60 * MIN) });
    await setDoc(doc(db, 'usuarios/u1/estacionamiento/sesion-ajena-0001'), {
      patente: 'AAA111', zonaId: 'p1', zonaNombre: zonas.p1.nombre, zona: 'centro', minutos: 60, importe: 800,
      inicio: ts(Date.now()), fin: ts(Date.now() + 60 * MIN), extensiones: 0, ultimoPagoId: 'sesion-ajena-0001',
      avisoPorVencer: false, avisoFinalizado: false, actualizadoEn: ts(Date.now()),
    });
    await setDoc(doc(db, 'bloqueosPatente/BBB222'), { sesionId: 'sesion-vieja-0001', fin: ts(Date.now() - MIN) });
    // Sesión vencida del vecino u2 para probar extender y finalizar fuera de tiempo.
    await setDoc(doc(db, 'usuarios/u2/estacionamiento/sesion-vencida-01'), {
      patente: 'VVV999', zonaId: 'p1', zonaNombre: zonas.p1.nombre, zona: 'centro', minutos: 15, importe: 200,
      inicio: ts(Date.now() - 20 * MIN), fin: ts(Date.now() - 5 * MIN), extensiones: 0, ultimoPagoId: 'sesion-vencida-01',
      avisoPorVencer: true, avisoFinalizado: true, actualizadoEn: ts(Date.now() - 5 * MIN),
    });
    await setDoc(doc(db, 'bloqueosPatente/VVV999'), { sesionId: 'sesion-vencida-01', fin: ts(Date.now() - 5 * MIN) });
  });
});

after(async () => { await entorno?.cleanup(); });

describe('inicio de sesión', () => {
  it('con importe = tarifa × minutos / 60 pasa', async () => {
    const db = vecino(entorno, 'u2');
    const { lote } = loteInicio(db, 'u2', { sesionId: 'sesion-ok-000001', patente: 'ABC123', minutos: 60 });
    await assertSucceeds(lote.commit());
    const { lote: otro } = loteInicio(db, 'u2', { sesionId: 'sesion-ok-000002', patente: 'AB123CD', minutos: 15 });
    await assertSucceeds(otro.commit());
  });

  it('importe distinto, minutos fuera de bloque o más de 240 se rechazan', async () => {
    const db = vecino(entorno, 'u2');
    await assertFails(loteInicio(db, 'u2', { sesionId: 'sesion-mal-00001', patente: 'CCC001', minutos: 60, importe: 799 }).lote.commit());
    await assertFails(loteInicio(db, 'u2', { sesionId: 'sesion-mal-00002', patente: 'CCC002', minutos: 20, importe: 800 * 20 / 60 }).lote.commit());
    await assertFails(loteInicio(db, 'u2', { sesionId: 'sesion-mal-00003', patente: 'CCC003', minutos: 255 }).lote.commit());
    await assertFails(loteInicio(db, 'u2', { sesionId: 'sesion-mal-00004', patente: 'CCC004', minutos: 300 }).lote.commit());
    await assertFails(loteInicio(db, 'u2', { sesionId: 'sesion-mal-00005', patente: 'CCC005', minutos: 0, importe: 0 }).lote.commit());
  });

  it('se rechaza un fin lejos de inicio + minutos, una patente inválida o datos de zona falsos', async () => {
    const db = vecino(entorno, 'u2');
    await assertFails(loteInicio(db, 'u2', { sesionId: 'sesion-mal-00006', patente: 'DDD001', minutos: 15, fin: ts(Date.now() + 60 * MIN) }).lote.commit());
    await assertFails(loteInicio(db, 'u2', { sesionId: 'sesion-mal-00007', patente: 'abc123', minutos: 15 }).lote.commit());
    await assertFails(loteInicio(db, 'u2', { sesionId: 'sesion-mal-00008', patente: 'DDD002', minutos: 15, zonaNombre: 'Otra' }).lote.commit());
    await assertFails(loteInicio(db, 'u2', { sesionId: 'sesion-mal-00009', patente: 'DDD003', minutos: 15, zona: 'norte' }).lote.commit());
    await assertFails(loteInicio(db, 'u2', { sesionId: 'corto', patente: 'DDD004', minutos: 15 }).lote.commit());
  });

  it('con horarioEstricto fuera de horario se rechaza y sin él pasa', async () => {
    const db = vecino(entorno, 'u2');
    await assertFails(loteInicio(db, 'u2', { sesionId: 'sesion-hor-00001', patente: 'EEE001', zonaId: 'cerrada', minutos: 15 }).lote.commit());
    await fijarHorarioEstricto(false);
    try {
      await assertSucceeds(loteInicio(db, 'u2', { sesionId: 'sesion-hor-00002', patente: 'EEE002', zonaId: 'cerrada', minutos: 15 }).lote.commit());
    } finally {
      await fijarHorarioEstricto(true);
    }
  });

  it('dayOfWeek() usa 1 = lunes y la hora de Córdoba (UTC-3)', async () => {
    // Se siembran zonas abiertas solo hoy (día ISO calculado en Córdoba) y solo otro día.
    const { dia, hora } = ahoraCordoba();
    assert.equal(ahoraCordoba(Date.UTC(2026, 9, 5, 15)).dia, 1, 'el lunes 5/10/2026 es el día 1');
    assert.equal(ahoraCordoba(Date.UTC(2026, 9, 4, 15)).dia, 7, 'el domingo 4/10/2026 es el día 7');
    const otroDia = (dia % 7) + 1;
    await sembrar(entorno, async (sdb) => {
      await setDoc(doc(sdb, 'zonasEstacionamiento/hoy'), { ...zonas.p1, horario: { dias: [dia], desde: 0, hasta: 24 } });
      await setDoc(doc(sdb, 'zonasEstacionamiento/otro-dia'), { ...zonas.p1, horario: { dias: [otroDia], desde: 0, hasta: 24 } });
      await setDoc(doc(sdb, 'zonasEstacionamiento/esta-hora'), { ...zonas.p1, horario: { dias: [dia], desde: hora, hasta: hora + 1 } });
      await setDoc(doc(sdb, 'zonasEstacionamiento/otra-hora'), {
        ...zonas.p1, horario: { dias: [dia], desde: (hora + 2) % 24, hasta: ((hora + 2) % 24) + 1 },
      });
    });
    const db = vecino(entorno, 'u2');
    await assertSucceeds(loteInicio(db, 'u2', { sesionId: 'sesion-dia-00001', patente: 'FFF001', zonaId: 'hoy', minutos: 15 }).lote.commit());
    await assertFails(loteInicio(db, 'u2', { sesionId: 'sesion-dia-00002', patente: 'FFF002', zonaId: 'otro-dia', minutos: 15 }).lote.commit());
    await assertSucceeds(loteInicio(db, 'u2', { sesionId: 'sesion-dia-00003', patente: 'FFF003', zonaId: 'esta-hora', minutos: 15 }).lote.commit());
    await assertFails(loteInicio(db, 'u2', { sesionId: 'sesion-dia-00004', patente: 'FFF004', zonaId: 'otra-hora', minutos: 15 }).lote.commit());
  });
});

describe('bloqueo de patente', () => {
  it('una patente bloqueada por otro vecino se rechaza y una vencida pasa', async () => {
    const db = vecino(entorno, 'u2');
    await assertFails(loteInicio(db, 'u2', { sesionId: 'sesion-blq-00001', patente: 'AAA111', minutos: 15 }).lote.commit());
    await assertSucceeds(loteInicio(db, 'u2', { sesionId: 'sesion-blq-00002', patente: 'BBB222', minutos: 15 }).lote.commit());
  });

  it('otro vecino que crea una sesión con el mismo sesionId del bloqueo ajeno no lo toma', async () => {
    const db = vecino(entorno, 'u2');
    await assertFails(loteInicio(db, 'u2', { sesionId: 'sesion-ajena-0001', patente: 'AAA111', minutos: 15 }).lote.commit());
  });

  it('el bloqueo no tiene uid ni otros campos', async () => {
    const db = vecino(entorno, 'u2');
    await assertFails(loteInicio(db, 'u2', { sesionId: 'sesion-blq-00003', patente: 'GGG001', minutos: 15, bloqueoExtra: { uid: 'u2' } }).lote.commit());
    const leido = await assertSucceeds(getDoc(doc(db, 'bloqueosPatente/ABC123')));
    assert.deepEqual(Object.keys(leido.data()).sort(), ['fin', 'sesionId']);
  });

  it('cualquier usuario con sesión lee un bloqueo, pero nadie lista ni borra', async () => {
    await assertSucceeds(getDoc(doc(vecino(entorno, 'u3'), 'bloqueosPatente/AAA111')));
    await assertFails(getDoc(doc(sinSesion(entorno), 'bloqueosPatente/AAA111')));
    await assertFails(getDocs(collection(vecino(entorno, 'u3'), 'bloqueosPatente')));
    await assertFails(deleteDoc(doc(vecino(entorno, 'u1'), 'bloqueosPatente/AAA111')));
  });

  it('una sesión sin bloqueo o sin pago en el lote se rechaza', async () => {
    const db = vecino(entorno, 'u2');
    await assertFails(loteInicio(db, 'u2', { sesionId: 'sesion-blq-00004', patente: 'GGG002', minutos: 15, sinBloqueo: true }).lote.commit());
    await assertFails(loteInicio(db, 'u2', { sesionId: 'sesion-blq-00005', patente: 'GGG003', minutos: 15, sinPago: true }).lote.commit());
    await assertFails(loteInicio(db, 'u2', { sesionId: 'sesion-blq-00006', patente: 'GGG004', minutos: 15, finBloqueo: ts(Date.now() + 5 * MIN) }).lote.commit());
  });

  it('un bloqueo suelto, sin sesión en el lote, se rechaza', async () => {
    const db = vecino(entorno, 'u2');
    await assertFails(setDoc(doc(db, 'bloqueosPatente/HHH001'), { sesionId: 'sesion-suelta-001', fin: ts(Date.now() + 15 * MIN) }));
  });
});

describe('extensión', () => {
  const sesionId = 'sesion-ext-00001';
  const patente = 'JJJ001';
  let actual;

  before(async () => {
    const db = vecino(entorno, 'u4');
    const { lote, fin } = loteInicio(db, 'u4', { sesionId, patente, minutos: 30 });
    await lote.commit();
    actual = { minutos: 30, importe: 400, fin, extensiones: 0 };
  });

  it('una extensión válida pasa', async () => {
    const db = vecino(entorno, 'u4');
    const { lote, nuevo } = loteExtension(db, 'u4', { sesionId, patente, actual, extra: 15, pagoId: 'pago-ext-00001' });
    await assertSucceeds(lote.commit());
    actual = nuevo;
    const { lote: otra, nuevo: otroNuevo } = loteExtension(db, 'u4', { sesionId, patente, actual, extra: 30, pagoId: 'pago-ext-00002' });
    await assertSucceeds(otra.commit());
    actual = otroNuevo;
  });

  it('un importe mal calculado se rechaza', async () => {
    const db = vecino(entorno, 'u4');
    await assertFails(loteExtension(db, 'u4', { sesionId, patente, actual, extra: 15, pagoId: 'pago-ext-00003', importeExtra: 100 }).lote.commit());
  });

  it('superar 240 minutos se rechaza', async () => {
    const db = vecino(entorno, 'u4');
    await assertFails(loteExtension(db, 'u4', { sesionId, patente, actual, extra: 240 - actual.minutos + 15, pagoId: 'pago-ext-00004' }).lote.commit());
  });

  it('sin el pago o sin el bloqueo en el lote se rechaza, y el mismo pago no se reutiliza', async () => {
    const db = vecino(entorno, 'u4');
    await assertFails(loteExtension(db, 'u4', { sesionId, patente, actual, extra: 15, pagoId: 'pago-ext-00005', sinPago: true }).lote.commit());
    await assertFails(loteExtension(db, 'u4', { sesionId, patente, actual, extra: 15, pagoId: 'pago-ext-00006', sinBloqueo: true }).lote.commit());
    await assertFails(loteExtension(db, 'u4', { sesionId, patente, actual, extra: 15, pagoId: 'pago-ext-00002' }).lote.commit());
  });

  it('extender una sesión vencida se rechaza', async () => {
    const db = vecino(entorno, 'u2');
    const vencida = { minutos: 15, importe: 200, fin: ts(Date.now() - 5 * MIN), extensiones: 0 };
    await assertFails(loteExtension(db, 'u2', { sesionId: 'sesion-vencida-01', patente: 'VVV999', actual: vencida, extra: 15, pagoId: 'pago-ext-00007' }).lote.commit());
  });
});

describe('finalización', () => {
  const sesionId = 'sesion-fin-00001';
  const patente = 'KKK001';

  before(async () => {
    const db = vecino(entorno, 'u5');
    await loteInicio(db, 'u5', { sesionId, patente, minutos: 60 }).lote.commit();
  });

  it('finalizar sin el bloqueo en el lote o con otro fin se rechaza', async () => {
    const db = vecino(entorno, 'u5');
    await assertFails(loteFinalizar(db, 'u5', { sesionId, patente, sinBloqueo: true }).commit());
    await assertFails(loteFinalizar(db, 'u5', { sesionId, patente, fin: ts(Date.now() + MIN), finBloqueo: ts(Date.now() + MIN) }).commit());
    await assertFails(loteFinalizar(db, 'u5', { sesionId, patente, finBloqueo: ts(Date.now() + 30 * MIN) }).commit());
  });

  it('otro vecino no finaliza la sesión ajena', async () => {
    const db = vecino(entorno, 'u2');
    await assertFails(loteFinalizar(db, 'u5', { sesionId, patente }).commit());
  });

  it('finalizar con fin = serverTimestamp y el bloqueo en el mismo lote pasa', async () => {
    const db = vecino(entorno, 'u5');
    await assertSucceeds(loteFinalizar(db, 'u5', { sesionId, patente }).commit());
  });

  it('finalizar una sesión vencida se rechaza', async () => {
    const db = vecino(entorno, 'u5');
    await assertFails(loteFinalizar(db, 'u5', { sesionId, patente }).commit());
    await assertFails(loteFinalizar(vecino(entorno, 'u2'), 'u2', { sesionId: 'sesion-vencida-01', patente: 'VVV999' }).commit());
  });

  it('después de finalizar, otro vecino toma la patente', async () => {
    const db = vecino(entorno, 'u6');
    await assertSucceeds(loteInicio(db, 'u6', { sesionId: 'sesion-fin-00002', patente, minutos: 15 }).lote.commit());
  });

  it('nadie borra sesiones y otro vecino no las lee', async () => {
    await assertFails(deleteDoc(doc(vecino(entorno, 'u5'), `usuarios/u5/estacionamiento/${sesionId}`)));
    await assertFails(getDoc(doc(vecino(entorno, 'u6'), `usuarios/u5/estacionamiento/${sesionId}`)));
    await assertSucceeds(getDoc(doc(vecino(entorno, 'u5'), `usuarios/u5/estacionamiento/${sesionId}`)));
  });
});
