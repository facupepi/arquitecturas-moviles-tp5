// Alta de tarjetas guardadas (medios de pago): validación del formulario. Va aparte de dominio.mjs
// para que solo se descargue al abrir Mi cuenta o la pasarela, y no pese en la carga inicial.
// El número completo solo pasa por estas funciones para validarlo y sacar la red y los últimos 4:
// lo que devuelven nunca lo incluye. El código de seguridad se pide y se valida (3 dígitos, 4 en
// American Express), y se descarta: nunca se devuelve ni se guarda.
import { LIMITES, MEDIOS_PAGO } from './constantes.mjs';
import { ErrorDominio, PATRON_VENCE, luhnValido, partesCordoba, tarjetaVencida } from './dominio.mjs';

/** Solo los dígitos del número tal como se escribe ("4242 4242-4242" → "424242424242"). */
export function digitosTarjeta(texto) {
  return String(texto ?? '').replace(/[\s.-]/g, '');
}

/** Red por el prefijo del número, solo como texto: Visa, Mastercard, American Express o "Tarjeta". */
export function redTarjeta(numero) {
  const d = digitosTarjeta(numero);
  if (/^4/.test(d)) return 'Visa';
  if (/^3[47]/.test(d)) return 'American Express';
  const dos = Number(d.slice(0, 2));
  const cuatro = Number(d.slice(0, 4));
  if ((d.length >= 2 && dos >= 51 && dos <= 55) || (d.length >= 4 && cuatro >= 2221 && cuatro <= 2720)) return 'Mastercard';
  return 'Tarjeta';
}

/** "0829", "8/29" o "08 / 29" → "08/29". Devuelve null si no se puede leer como mes y año. */
export function normalizarVence(texto) {
  const m = /^(\d{1,2})\s*\/?\s*(\d{2})$/.exec(String(texto ?? '').trim());
  if (!m) return null;
  const vence = `${m[1].padStart(2, '0')}/${m[2]}`;
  return PATRON_VENCE.test(vence) ? vence : null;
}

/**
 * Revisa los datos del formulario de alta y devuelve TODOS los errores a la vez (uno por campo),
 * para mostrarlos debajo de cada campo. `codigo` (el de seguridad) se valida solo si llega.
 *   → { tarjeta: { tipo, red, ultimos4, titular, vence } | null, errores: { tipo?, numero?, titular?, codigo?, vence? } }
 */
export function revisarTarjeta({ tipo, numero, titular, vence, codigo } = {}, ahoraMs = Date.now()) {
  const errores = {};
  if (!MEDIOS_PAGO.includes(tipo)) errores.tipo = 'Elegí si es de crédito o de débito.';

  const digitos = digitosTarjeta(numero);
  if (!digitos) errores.numero = 'Ingresá el número de la tarjeta.';
  else if (!/^[0-9]+$/.test(digitos)) errores.numero = 'Usá solo números.';
  else if (digitos.length < LIMITES.largoTarjetaMin || digitos.length > LIMITES.largoTarjetaMax) {
    errores.numero = `El número tiene entre ${LIMITES.largoTarjetaMin} y ${LIMITES.largoTarjetaMax} dígitos.`;
  } else if (!luhnValido(digitos)) errores.numero = 'Revisá el número: no corresponde a una tarjeta válida.';

  const nombre = typeof titular === 'string' ? titular.trim().replace(/\s+/g, ' ') : '';
  if (!nombre) errores.titular = 'Ingresá el nombre como figura en la tarjeta.';
  else if (nombre.length < LIMITES.largoTitularMin || nombre.length > LIMITES.largoTitularMax) {
    errores.titular = `Usá entre ${LIMITES.largoTitularMin} y ${LIMITES.largoTitularMax} caracteres.`;
  } else if (/[0-9]/.test(nombre)) errores.titular = 'El titular no lleva números.';

  // Código de seguridad: se valida (3 dígitos, 4 en American Express) y se descarta; nunca se
  // devuelve ni se guarda. Solo se exige cuando llega el campo (el formulario siempre lo envía).
  // El de American Express va en el frente, arriba del número; el de las demás, al dorso.
  if (codigo !== undefined) {
    const cvv = String(codigo ?? '').trim();
    const amex = redTarjeta(digitos) === 'American Express';
    const largo = amex ? 4 : 3;
    if (!cvv) errores.codigo = 'Ingresá el código de seguridad.';
    else if (!new RegExp(`^[0-9]{${largo}}$`).test(cvv)) {
      errores.codigo = amex ? 'Son 4 números, en el frente de la tarjeta, arriba del número.' : 'Son 3 números, al dorso de la tarjeta.';
    }
  }

  const venceNormalizado = normalizarVence(vence);
  if (!String(vence ?? '').trim()) errores.vence = 'Ingresá el vencimiento.';
  else if (!venceNormalizado) errores.vence = 'Usá el formato MM/AA, por ejemplo 08/29.';
  else if (tarjetaVencida(venceNormalizado, ahoraMs)) errores.vence = 'La tarjeta está vencida.';
  else if (Number(venceNormalizado.slice(3)) + 2000 > partesCordoba(ahoraMs).anio + 20) errores.vence = 'Revisá el año de vencimiento.';

  if (Object.keys(errores).length) return { tarjeta: null, errores };
  return {
    tarjeta: { tipo, red: redTarjeta(digitos), ultimos4: digitos.slice(-4), titular: nombre, vence: venceNormalizado },
    errores,
  };
}

/** Como revisarTarjeta, pero lanza ErrorDominio con el primer error (campo tipo, numero, titular, codigo o vence). */
export function validarTarjeta(datos, ahoraMs = Date.now()) {
  const { tarjeta, errores } = revisarTarjeta(datos, ahoraMs);
  if (tarjeta) return tarjeta;
  const [campo, mensaje] = Object.entries(errores)[0];
  throw new ErrorDominio(mensaje, campo);
}
