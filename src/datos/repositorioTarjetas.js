// Tarjetas guardadas (medios de pago): alta y baja. Va en un módulo aparte, que solo se descarga
// con Mi cuenta o la pasarela, para no pesar en la carga inicial.
import { deleteDoc, getDocsFromServer, serverTimestamp, setDoc } from 'firebase/firestore';
import { ErrorApp, desdeFirebase } from './errores';
import {
  altaLista, coleccionDe, conErrores, errorCampo, escribirSinBloquear, exigirConexion, refDe, uidActual, validar,
} from './repositorio';
import { validarTarjeta } from '../../shared/tarjetas.mjs';
import { COLECCIONES as C, IDS_TARJETA, LIMITES } from '../../shared/constantes.mjs';

const igualTarjeta = (a, b) => a.tipo === b.tipo && a.red === b.red && a.ultimos4 === b.ultimos4 && a.vence === b.vence;

const MENSAJE_SIN_CONEXION = 'Para guardar la tarjeta necesitás conexión. Revisá tu red e intentá de nuevo.';
const MENSAJE_SIN_RESPUESTA = 'El servicio no respondió a tiempo. Revisá tu conexión e intentá de nuevo.';

// Tope de "Guardando…": con la red conectada pero sin respuesta (navigator.onLine sigue en true),
// Firestore no contesta nunca y el diálogo quedaba trabado, sin poder cerrarse.
const TOPE_ALTA_MS = 15_000;
const VENCIDO = Symbol('vencido');

/** La promesa, o VENCIDO si no se resolvió antes de `limite` (ms, como Date.now()). No la cancela. */
function hasta(promesa, limite) {
  let temporizador;
  const tope = new Promise((resolver) => {
    temporizador = setTimeout(() => resolver(VENCIDO), Math.max(0, limite - Date.now()));
  });
  return Promise.race([promesa, tope]).finally(() => clearTimeout(temporizador));
}

/**
 * Guarda una tarjeta de crédito o de débito: { tipo, numero, titular, vence }. El número completo
 * se usa solo para validarlo (Luhn) y sacar la red y los últimos 4: lo que se escribe es
 * { tipo, red, ultimos4, titular, vence, creadoEn }. El código de seguridad no llega acá: el
 * formulario (useAltaTarjeta) lo valida y lo descarta antes de llamar.
 * Ocupa el primer lugar libre de IDS_TARJETA (hasta 5 tarjetas).
 * Tarda como máximo TOPE_ALTA_MS:
 * - si en ese tiempo no llegan las tarjetas guardadas, no escribe nada y lanza 'servidor';
 * - si la escritura salió pero el servidor no la confirmó, queda en la cola persistente del SDK (la
 *   lista ya la muestra) y se devuelve con pendiente: true; se guarda sola al volver la conexión.
 */
export async function guardarTarjeta(datos) {
  const uid = uidActual();
  const tarjeta = validar(() => validarTarjeta(datos ?? {}, Date.now()));
  exigirConexion(MENSAJE_SIN_CONEXION);
  const limite = Date.now() + TOPE_ALTA_MS;
  return conErrores(async () => {
    // Del servidor y no de la caché: sin conexión falla enseguida, en vez de encolar el alta con una
    // lista vieja (otro dispositivo pudo haber ocupado ese lugar).
    const lectura = await hasta(altaLista(uid).then(() => getDocsFromServer(coleccionDe(uid, C.tarjetas))), limite);
    if (lectura === VENCIDO) throw new ErrorApp('servidor', MENSAJE_SIN_RESPUESTA);
    const guardadas = lectura.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (guardadas.some((t) => igualTarjeta(t, tarjeta))) throw errorCampo('numero', 'Esa tarjeta ya está guardada.');
    const id = IDS_TARJETA.find((x) => !guardadas.some((t) => t.id === x));
    if (!id) {
      throw new ErrorApp('validacion', `Podés guardar hasta ${LIMITES.tarjetas} tarjetas. Quitá una para agregar otra.`, { campo: 'tarjetas' });
    }
    const escritura = setDoc(refDe(uid, C.tarjetas, id), { ...tarjeta, creadoEn: serverTimestamp() });
    const confirmada = await hasta(escritura.then(() => true), limite);
    if (confirmada === VENCIDO) escritura.catch((e) => console.warn('No se pudo guardar la tarjeta:', desdeFirebase(e).message));
    return { id, ...tarjeta, creadoEn: Date.now(), pendiente: confirmada === VENCIDO };
  }, (e) => (e.codigo === 'sin-conexion' ? new ErrorApp('sin-conexion', MENSAJE_SIN_CONEXION, { causa: e.causa }) : e));
}

export async function quitarTarjeta(id) {
  const uid = uidActual();
  if (!IDS_TARJETA.includes(id)) throw new ErrorApp('no-encontrado', 'No encontramos esa tarjeta.');
  await conErrores(() => escribirSinBloquear(deleteDoc(refDe(uid, C.tarjetas, id)), 'quitar la tarjeta'));
}
