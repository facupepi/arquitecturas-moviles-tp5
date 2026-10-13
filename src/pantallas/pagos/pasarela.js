// Pasarela de pagos (T2, E2, E4): lo que comparten Tributos y Estacionamiento.
// El flujo es siempre el mismo: elegir el medio → "Pagar $X" → "Procesando el pago…" → "Pago aprobado"
// con el comprobante. Solo se registra qué medio se eligió: la app no pide ni guarda datos de tarjetas,
// de cuentas ni CBU (requisito de seguridad).
import { useCallback, useState } from 'react';
import { ETIQUETAS, MEDIOS_PAGO } from '../../../shared/constantes.mjs';
import { medir } from '../../firebase/rendimiento';

// Lo mínimo que se muestra "Procesando el pago…": la confirmación de Firestore suele tardar menos
// y, sin esta pausa, el estado parpadea y el vecino no llega a leerlo.
export const DEMORA_PROCESO_MS = 1500;

export const MENSAJE_SIN_MEDIO = 'Elegí un medio de pago para continuar.';

// Ícono y una línea de ayuda por medio. Íconos genéricos: ninguna marca comercial.
const DETALLE_MEDIO = {
  credito: { icono: 'tarjetaCredito', ayuda: 'En un pago, sin recargo' },
  debito: { icono: 'tarjetaDebito', ayuda: 'Se debita en el momento' },
  billetera: { icono: 'billetera', ayuda: 'Con el saldo de tu billetera' },
  transferencia: { icono: 'banco', ayuda: 'Desde tu banco, al instante' },
};

export const OPCIONES_MEDIO = MEDIOS_PAGO.map((valor) => ({
  valor,
  etiqueta: ETIQUETAS.mediosPago[valor],
  ...DETALLE_MEDIO[valor],
}));

/** Etiqueta del medio ("Tarjeta de débito"), o null si el pago no lo tiene (pagos anteriores). */
export function etiquetaMedio(medio) {
  return ETIQUETAS.mediosPago[medio] ?? null;
}

const esperar = (ms) => new Promise((resolver) => { setTimeout(resolver, ms); });

/**
 * Envuelve un comando de pago del repositorio para que el estado "procesando" dure al menos
 * DEMORA_PROCESO_MS, también cuando falla (un error inmediato, como "sin conexión", se ve
 * después del procesamiento, igual que en cualquier pasarela). La traza de rendimiento mide solo
 * el comando, sin la pausa.
 */
export function conProcesamiento(comando, traza) {
  return async (...args) => {
    const correr = () => comando(...args);
    const [resultado] = await Promise.allSettled([
      traza ? medir(traza, correr) : correr(),
      esperar(DEMORA_PROCESO_MS),
    ]);
    if (resultado.status === 'rejected') throw resultado.reason;
    return resultado.value;
  };
}

/**
 * Estado del medio elegido en un diálogo de pago.
 *   const medio = useMedioPago();
 *   medio.valor, medio.error, medio.elegir(v), medio.validar() → boolean, medio.reiniciar()
 */
export function useMedioPago() {
  const [valor, setValor] = useState(null);
  const [error, setError] = useState(null);
  const elegir = useCallback((v) => { setValor(v); setError(null); }, []);
  const reiniciar = useCallback(() => { setValor(null); setError(null); }, []);
  const validar = useCallback(() => {
    if (MEDIOS_PAGO.includes(valor)) return true;
    setError(MENSAJE_SIN_MEDIO);
    return false;
  }, [valor]);
  return { valor, error, elegir, validar, reiniciar };
}
