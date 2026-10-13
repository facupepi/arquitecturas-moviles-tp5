// Tarjetas guardadas (medios de pago): alta y baja. Va en un módulo aparte, que solo se descarga
// con Mi cuenta o la pasarela, para no pesar en la carga inicial.
import { deleteDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { ErrorApp } from './errores';
import {
  altaLista, coleccionDe, conErrores, errorCampo, escribirSinBloquear, exigirConexion, refDe, uidActual, validar,
} from './repositorio';
import { validarTarjeta } from '../../shared/tarjetas.mjs';
import { COLECCIONES as C, IDS_TARJETA, LIMITES } from '../../shared/constantes.mjs';

const igualTarjeta = (a, b) => a.tipo === b.tipo && a.red === b.red && a.ultimos4 === b.ultimos4 && a.vence === b.vence;

/**
 * Guarda una tarjeta de crédito o de débito: { tipo, numero, titular, vence }. El número completo
 * se usa solo para validarlo (Luhn) y sacar la red y los últimos 4: lo que se escribe es
 * { tipo, red, ultimos4, titular, vence, creadoEn }. No se pide código de seguridad.
 * Ocupa el primer lugar libre de IDS_TARJETA (hasta 5 tarjetas).
 */
export async function guardarTarjeta(datos) {
  const uid = uidActual();
  const tarjeta = validar(() => validarTarjeta(datos ?? {}, Date.now()));
  exigirConexion('Para guardar la tarjeta necesitás conexión. Revisá tu red e intentá de nuevo.');
  await altaLista(uid);
  return conErrores(async () => {
    const guardadas = (await getDocs(coleccionDe(uid, C.tarjetas))).docs.map((d) => ({ id: d.id, ...d.data() }));
    if (guardadas.some((t) => igualTarjeta(t, tarjeta))) throw errorCampo('numero', 'Esa tarjeta ya está guardada.');
    const id = IDS_TARJETA.find((x) => !guardadas.some((t) => t.id === x));
    if (!id) {
      throw new ErrorApp('validacion', `Podés guardar hasta ${LIMITES.tarjetas} tarjetas. Quitá una para agregar otra.`, { campo: 'tarjetas' });
    }
    await setDoc(refDe(uid, C.tarjetas, id), { ...tarjeta, creadoEn: serverTimestamp() });
    return { id, ...tarjeta, creadoEn: Date.now(), pendiente: false };
  });
}

export async function quitarTarjeta(id) {
  const uid = uidActual();
  if (!IDS_TARJETA.includes(id)) throw new ErrorApp('no-encontrado', 'No encontramos esa tarjeta.');
  await conErrores(() => escribirSinBloquear(deleteDoc(refDe(uid, C.tarjetas, id)), 'quitar la tarjeta'));
}
