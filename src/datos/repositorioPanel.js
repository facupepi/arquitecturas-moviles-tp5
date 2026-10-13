// Control municipal del panel: pagos y estacionamiento de todos los vecinos. Va en un módulo aparte
// para que solo lo descargue el administrador al abrir el panel, y no pese en la carga inicial.
import {
  collectionGroup, count, doc, getAggregateFromServer, limit, orderBy, query, runTransaction, serverTimestamp, sum,
  Timestamp, where,
} from 'firebase/firestore';
import { db } from '../firebase/firestore';
import { ErrorApp } from './errores';
import { pagoDeGrupoDesdeDoc, sesionDeGrupoDesdeDoc, tributoDeGrupoDesdeDoc } from './mapeadores';
import { conErrores, escucharColeccion, exigirConexion, refDe, uidActual } from './repositorio';
import { inicioDiaCordoba, inicioMesCordoba } from '../../shared/dominio.mjs';
import { COLECCIONES as C } from '../../shared/constantes.mjs';

// ===================== Control municipal: pagos y estacionamiento (panel) =====================
// Lecturas por grupo de colecciones permitidas solo al administrador (match /{ruta=**}/pagos,
// /estacionamiento y /tributos de firestore.rules). El vecino se identifica por el uid de la ruta:
// estas consultas no traen nombre ni correo.

export function suscribirPagosAdmin(limite = 100, alCambiar, alFallar) {
  if (typeof limite === 'function') return suscribirPagosAdmin(100, limite, alCambiar);
  return escucharColeccion(
    query(collectionGroup(db, C.pagos), orderBy('creadoEn', 'desc'), limit(limite)),
    pagoDeGrupoDesdeDoc, alCambiar, alFallar,
  );
}

// Sesiones con fin posterior al momento de suscribirse, de la más próxima a vencer a la más lejana.
// Las que vencen o se finalizan después siguen en la lista: la pantalla las filtra con useAhora.
export function suscribirSesionesActivasAdmin(limite = 200, alCambiar, alFallar) {
  if (typeof limite === 'function') return suscribirSesionesActivasAdmin(200, limite, alCambiar);
  return escucharColeccion(
    query(collectionGroup(db, C.estacionamiento), where('fin', '>', Timestamp.now()), orderBy('fin', 'asc'), limit(limite)),
    sesionDeGrupoDesdeDoc, alCambiar, alFallar,
  );
}

// Cedulones sin pagar, del más atrasado al más reciente (índice pagadoEn + vence). No se corta por
// vence < ahora en la consulta: ese ahora quedaría fijo al suscribirse y un cedulón que vence con el
// panel abierto no aparecería. La pantalla filtra con useAhora (vencidosAl) y, como van ordenados por
// vence, los vencidos son siempre los primeros de la lista.
export function suscribirTributosVencidosAdmin(limite = 50, alCambiar, alFallar) {
  if (typeof limite === 'function') return suscribirTributosVencidosAdmin(50, limite, alCambiar);
  return escucharColeccion(
    query(collectionGroup(db, C.tributos), where('pagadoEn', '==', null), orderBy('vence', 'asc'), limit(limite)),
    tributoDeGrupoDesdeDoc, alCambiar, alFallar,
  );
}

async function sumarImportes(consulta) {
  const snap = await getAggregateFromServer(consulta, { total: sum('importe'), cantidad: count() });
  const d = snap.data();
  return { total: Number(d.total) || 0, cantidad: Number(d.cantidad) || 0 };
}

/**
 * Totales calculados en el servidor (consultas de agregación: no se descargan los pagos).
 * { dia, mes, estacionamientoDia: { sesiones, extensiones, total }, vencidos: { total, cantidad } }.
 * "Hoy" y "este mes" se cortan a la medianoche de Córdoba.
 */
export async function resumenControlAdmin(ahora = Date.now()) {
  uidActual();
  const desdeDia = Timestamp.fromMillis(inicioDiaCordoba(ahora));
  const desdeMes = Timestamp.fromMillis(inicioMesCordoba(ahora));
  const pagos = (...filtros) => sumarImportes(query(collectionGroup(db, C.pagos), ...filtros));
  return conErrores(async () => {
    const [dia, mes, sesiones, extensiones, vencidos] = await Promise.all([
      pagos(where('creadoEn', '>=', desdeDia)),
      pagos(where('creadoEn', '>=', desdeMes)),
      pagos(where('tipo', '==', 'estacionamiento'), where('creadoEn', '>=', desdeDia)),
      pagos(where('tipo', '==', 'extension'), where('creadoEn', '>=', desdeDia)),
      sumarImportes(query(collectionGroup(db, C.tributos), where('pagadoEn', '==', null), where('vence', '<', Timestamp.fromMillis(ahora)))),
    ]);
    return {
      dia,
      mes,
      estacionamientoDia: { sesiones: sesiones.cantidad, extensiones: extensiones.cantidad, total: sesiones.total + extensiones.total },
      vencidos,
      calculadoEn: ahora,
    };
  });
}

/**
 * Control de estacionamiento: termina ahora una sesión activa de cualquier vecino (por ejemplo, el
 * vehículo ya se fue). Igual que "Terminar ahora" del vecino: fin = hora del servidor y el bloqueo
 * de la patente pasa a la misma hora en la misma transacción, así la patente queda libre.
 */
export async function finalizarSesionAdmin({ uid, sesionId } = {}) {
  uidActual();
  if (typeof uid !== 'string' || !uid || typeof sesionId !== 'string' || !sesionId) throw new ErrorApp('no-encontrado');
  exigirConexion('Para finalizar la sesión necesitás conexión. Revisá tu red e intentá de nuevo.');
  return conErrores(() => runTransaction(db, async (tx) => {
    const refSesion = refDe(uid, C.estacionamiento, sesionId);
    const snapSesion = await tx.get(refSesion);
    if (!snapSesion.exists()) throw new ErrorApp('no-encontrado', 'La sesión ya no existe.');
    const sesion = snapSesion.data();
    if (!sesion.fin || sesion.fin.toMillis() <= Date.now()) {
      throw new ErrorApp('sesion-vencida', `La sesión de ${sesion.patente ?? 'esa patente'} ya había terminado.`);
    }
    const refBloqueo = doc(db, C.bloqueos, sesion.patente);
    const snapBloqueo = await tx.get(refBloqueo);
    if (!snapBloqueo.exists() || snapBloqueo.get('sesionId') !== sesionId) {
      throw new ErrorApp('validacion', `La patente ${sesion.patente} ya no figura a nombre de esta sesión.`);
    }
    tx.update(refSesion, { fin: serverTimestamp(), actualizadoEn: serverTimestamp() });
    tx.set(refBloqueo, { sesionId, fin: serverTimestamp() });
    return { id: sesionId, uid, patente: sesion.patente };
  }));
}
