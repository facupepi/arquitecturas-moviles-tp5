// Catálogo público: lectura sin sesión y escritura solo del admin (con evento en el lote).
import { describe, it, before, after } from 'node:test';
import {
  doc, getDoc, getDocs, collection, setDoc, updateDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { crearEntorno, vecino, google, anonimo, sinSesion, sembrar, ts, assertSucceeds, assertFails, MIN } from './_entorno.mjs';

let entorno;

function evento(db, id, tipo, refId) {
  return [doc(db, 'eventos', id), {
    tipo, refId, uid: null, origen: 'panel', estado: 'pendiente', intentos: 0, creadoEn: serverTimestamp(),
  }];
}

function aviso(eventoId, cambios = {}) {
  return {
    titulo: 'Corte de tránsito', cuerpo: 'Corte por obras en Bv. 25 de Mayo.', detalle: 'Aviso de demostración.',
    tipo: 'obras', zona: 'centro', destino: null, enlace: null, creadoEn: serverTimestamp(),
    autor: 'municipalidad', eventoId, vigenteHasta: null, ...cambios,
  };
}

before(async () => {
  entorno = await crearEntorno();
  await sembrar(entorno, async (db) => {
    const ahora = ts(Date.now());
    await setDoc(doc(db, 'municipal/info'), { nombre: 'Municipalidad de San Francisco' });
    await setDoc(doc(db, 'municipal/config'), {
      simuladorActivo: false, simuladorCadaMin: 2, horarioEstricto: true, avisoEstacionamientoMin: 5,
      ultimaSimulacion: null, actualizadoEn: ahora,
    });
    await setDoc(doc(db, 'estaciones/b1'), {
      nombre: 'Estación Plaza General Paz', referencia: 'x', zona: 'centro', lat: -31.43, lng: -62.08,
      bicicletas: 8, capacidad: 14, estado: 'operativa', actualizadoEn: ahora,
    });
    for (const id of ['a1', 'a2', 'a3']) {
      await setDoc(doc(db, 'alarmas', id), {
        nombre: 'Alarma ' + id, referencia: 'x', zona: 'centro', lat: -31.43, lng: -62.08,
        activa: false, activadaEn: null, activacionId: null, actualizadoEn: ahora,
      });
    }
    await setDoc(doc(db, 'alarmas/a4'), {
      nombre: 'Alarma UTN', referencia: 'x', zona: 'norte', lat: -31.42, lng: -62.11,
      activa: true, activadaEn: ahora, activacionId: 'ev-viejo', actualizadoEn: ahora,
    });
    await setDoc(doc(db, 'zonasEstacionamiento/p1'), { nombre: 'Municipalidad', zona: 'centro', tarifaHora: 800 });
    await setDoc(doc(db, 'contactos/c01'), { nombre: 'Atención ciudadana', orden: 1 });
    await setDoc(doc(db, 'avisos/av-obras-centro'), { titulo: 'Obras', creadoEn: ahora });
    await setDoc(doc(db, 'administradores/admin-google'), { nombre: 'Admin', alta: ahora });
    await setDoc(doc(db, 'administradores/admin-anonimo'), { nombre: 'Admin invitado', alta: ahora });
  });
});

after(async () => { await entorno?.cleanup(); });

describe('catálogo público', () => {
  it('se lee sin sesión', async () => {
    const db = sinSesion(entorno);
    await assertSucceeds(getDoc(doc(db, 'municipal/info')));
    await assertSucceeds(getDoc(doc(db, 'municipal/config')));
    for (const c of ['estaciones', 'alarmas', 'zonasEstacionamiento', 'contactos', 'avisos']) {
      await assertSucceeds(getDocs(collection(db, c)));
    }
  });

  it('un vecino no escribe el catálogo', async () => {
    const db = vecino(entorno, 'vecino-1');
    await assertFails(updateDoc(doc(db, 'estaciones/b1'), { bicicletas: 9, actualizadoEn: serverTimestamp() }));
    await assertFails(setDoc(doc(db, 'municipal/info'), { nombre: 'Otra' }));
    await assertFails(setDoc(doc(db, 'contactos/c99'), { nombre: 'Falso' }));
    await assertFails(setDoc(doc(db, 'zonasEstacionamiento/p9'), { tarifaHora: 4 }));
    const g = google(entorno, 'vecino-google');
    await assertFails(updateDoc(doc(g, 'estaciones/b1'), { bicicletas: 9, actualizadoEn: serverTimestamp() }));
  });

  it('el admin cambia bicicletas dentro de la capacidad', async () => {
    const db = google(entorno, 'admin-google');
    await assertSucceeds(updateDoc(doc(db, 'estaciones/b1'), {
      bicicletas: 14, estado: 'operativa', actualizadoEn: serverTimestamp(),
    }));
    await assertSucceeds(updateDoc(doc(db, 'estaciones/b1'), {
      bicicletas: 0, estado: 'fuera_de_servicio', actualizadoEn: serverTimestamp(),
    }));
  });

  it('se rechazan bicicletas por encima de la capacidad o negativas', async () => {
    const db = google(entorno, 'admin-google');
    await assertFails(updateDoc(doc(db, 'estaciones/b1'), { bicicletas: 15, actualizadoEn: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'estaciones/b1'), { bicicletas: -1, actualizadoEn: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'estaciones/b1'), { bicicletas: 5, capacidad: 20, actualizadoEn: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'estaciones/b1'), { bicicletas: 5, estado: 'rota', actualizadoEn: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'estaciones/b1'), { bicicletas: 5, actualizadoEn: ts(Date.now() - MIN) }));
  });

  it('activar una alarma sin evento en el lote se rechaza', async () => {
    const db = google(entorno, 'admin-google');
    await assertFails(updateDoc(doc(db, 'alarmas/a1'), {
      activa: true, activadaEn: serverTimestamp(), activacionId: 'ev-sin-evento', actualizadoEn: serverTimestamp(),
    }));
  });

  it('activar una alarma con el evento en el lote pasa', async () => {
    const db = google(entorno, 'admin-google');
    const lote = writeBatch(db);
    lote.update(doc(db, 'alarmas/a1'), {
      activa: true, activadaEn: serverTimestamp(), activacionId: 'ev-alarma-0001', actualizadoEn: serverTimestamp(),
    });
    lote.set(...evento(db, 'ev-alarma-0001', 'alarma', 'a1'));
    await assertSucceeds(lote.commit());
  });

  it('el evento tiene que ser de esa alarma y de tipo alarma', async () => {
    const db = google(entorno, 'admin-google');
    const otraAlarma = writeBatch(db);
    otraAlarma.update(doc(db, 'alarmas/a2'), {
      activa: true, activadaEn: serverTimestamp(), activacionId: 'ev-alarma-0002', actualizadoEn: serverTimestamp(),
    });
    otraAlarma.set(...evento(db, 'ev-alarma-0002', 'alarma', 'a3'));
    await assertFails(otraAlarma.commit());
    const otroTipo = writeBatch(db);
    otroTipo.update(doc(db, 'alarmas/a2'), {
      activa: true, activadaEn: serverTimestamp(), activacionId: 'ev-alarma-0003', actualizadoEn: serverTimestamp(),
    });
    otroTipo.set(...evento(db, 'ev-alarma-0003', 'aviso', 'a2'));
    await assertFails(otroTipo.commit());
  });

  it('desactivar una alarma sin evento pasa', async () => {
    const db = google(entorno, 'admin-google');
    await assertSucceeds(updateDoc(doc(db, 'alarmas/a4'), { activa: false, actualizadoEn: serverTimestamp() }));
  });

  it('un aviso del admin con su evento pasa y sin evento no', async () => {
    const db = google(entorno, 'admin-google');
    const conEvento = writeBatch(db);
    conEvento.set(doc(db, 'avisos/aviso-0001'), aviso('ev-aviso-0001'));
    conEvento.set(...evento(db, 'ev-aviso-0001', 'aviso', 'aviso-0001'));
    await assertSucceeds(conEvento.commit());
    await assertFails(setDoc(doc(db, 'avisos/aviso-0002'), aviso('ev-aviso-0002')));
  });

  it('un aviso con destino interno, enlace https y vigencia pasa', async () => {
    const db = google(entorno, 'admin-google');
    const lote = writeBatch(db);
    lote.set(doc(db, 'avisos/aviso-0003'), aviso('ev-aviso-0003', {
      tipo: 'emergencias', zona: 'todas', destino: '#/alarmas/a2', enlace: 'https://www.sanfrancisco.gov.ar',
      vigenteHasta: ts(Date.now() + 60 * MIN),
    }));
    lote.set(...evento(db, 'ev-aviso-0003', 'aviso', 'aviso-0003'));
    await assertSucceeds(lote.commit());
  });

  it('se rechaza un aviso de tipo alarmas, con enlace http o con destino externo', async () => {
    const db = google(entorno, 'admin-google');
    const casos = [
      { tipo: 'alarmas' },
      { enlace: 'http://ejemplo.com/x' },
      { destino: 'https://ejemplo.com' },
      { autor: 'simulador' },
      { titulo: 'No' },
      { zona: 'oeste' },
    ];
    let n = 10;
    for (const cambio of casos) {
      const id = `aviso-00${n++}`;
      const lote = writeBatch(db);
      lote.set(doc(db, 'avisos', id), aviso('ev-' + id, cambio));
      lote.set(...evento(db, 'ev-' + id, 'aviso', id));
      await assertFails(lote.commit());
    }
  });

  it('un admin con cuenta anónima se rechaza', async () => {
    const db = anonimo(entorno, 'admin-anonimo');
    await assertFails(updateDoc(doc(db, 'estaciones/b1'), { bicicletas: 3, estado: 'operativa', actualizadoEn: serverTimestamp() }));
    const lote = writeBatch(db);
    lote.update(doc(db, 'alarmas/a3'), {
      activa: true, activadaEn: serverTimestamp(), activacionId: 'ev-anon-0001', actualizadoEn: serverTimestamp(),
    });
    lote.set(...evento(db, 'ev-anon-0001', 'alarma', 'a3'));
    await assertFails(lote.commit());
  });
});
