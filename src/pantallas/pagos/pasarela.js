// Pasarela de pagos (T2, E2, E4): lo que comparten Tributos y Estacionamiento.
// El flujo es siempre el mismo: elegir una tarjeta guardada → "Pagar $X" → "Procesando el pago…" →
// "Pago aprobado" con el comprobante. Los medios son solo tarjetas de crédito y de débito que el
// vecino guarda en Mi cuenta (o carga desde el mismo pago si todavía no tiene ninguna). El pago
// registra el tipo (medio) y la tarjeta enmascarada { red, ultimos4 }: nunca el número completo.
import { useCallback, useState } from 'react';
import { tarjetaVencida } from '../../../shared/dominio.mjs';
import { textoMedioPago } from '../../../shared/formato.mjs';
import { medir } from '../../firebase/rendimiento';
import { useMunicipal } from '../../datos/almacen';
import { useAltaTarjeta } from './tarjetas';

// Lo mínimo que se muestra "Procesando el pago…": la confirmación de Firestore suele tardar menos
// y, sin esta pausa, el estado parpadea y el vecino no llega a leerlo.
export const DEMORA_PROCESO_MS = 1500;

export const MENSAJE_SIN_MEDIO = 'Elegí un medio de pago para continuar.';
export const MENSAJE_SIN_TARJETAS = 'Agregá una tarjeta de crédito o de débito para pagar.';
export const MENSAJE_VENCIDA = 'Esa tarjeta está vencida. Elegí otra o agregá una nueva.';
export const TITULO_ALTA = 'Agregar tarjeta';

// Íconos genéricos por tipo de tarjeta: ninguna marca comercial.
const ICONOS = { credito: 'tarjetaCredito', debito: 'tarjetaDebito', billetera: 'billetera', transferencia: 'banco' };
export const iconoMedio = (medio) => ICONOS[medio] ?? 'tarjetaCredito';

/**
 * Medio de un pago para mostrar: "Tarjeta de crédito Visa •••• 4242", o solo "Tarjeta de débito"
 * (o "Billetera virtual") en pagos anteriores a las tarjetas guardadas. null si no tiene medio.
 */
export function etiquetaMedio(medio, tarjeta = null) {
  return textoMedioPago(medio, tarjeta);
}

/** Lo mismo para una tarjeta guardada ({ tipo, red, ultimos4 }). */
export function etiquetaTarjeta(tarjeta) {
  return tarjeta ? textoMedioPago(tarjeta.tipo, tarjeta) : null;
}

const seleccionarTarjetas = (s) => s.tarjetas;

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
 * Estado del medio de pago de un diálogo: la tarjeta guardada elegida y, si el vecino carga una
 * desde el pago, el formulario de alta (useAltaTarjeta).
 *   const medio = useMedioPago();
 *   medio.tarjetas, medio.valor (id), medio.tarjeta (la elegida), medio.error,
 *   medio.elegir(id), medio.validar() → boolean, medio.reiniciar(),
 *   medio.agregando, medio.abrirAlta(), medio.cerrarAlta(), medio.alta, medio.volviendo
 * Al guardar la tarjeta nueva queda elegida y el diálogo vuelve al pago.
 */
export function useMedioPago() {
  const tarjetas = useMunicipal(seleccionarTarjetas);
  const [valor, setValor] = useState(null);
  const [error, setError] = useState(null);
  const [agregando, setAgregando] = useState(false);
  // Al volver del alta (guardada o cancelada), el foco va a las tarjetas (MediosDePago lo lee).
  const [volviendo, setVolviendo] = useState(false);
  // La recién guardada, por si la escucha de tarjetas todavía no la trajo.
  const [recien, setRecien] = useState(null);

  const alta = useAltaTarjeta({
    alGuardar: (t) => {
      setRecien(t);
      setValor(t.id);
      setError(null);
      setAgregando(false);
      setVolviendo(true);
    },
  });
  const { reiniciar: reiniciarAlta } = alta;

  const tarjeta = tarjetas.find((t) => t.id === valor) ?? (recien && recien.id === valor ? recien : null);

  const elegir = useCallback((v) => { setValor(v); setError(null); }, []);
  const reiniciar = useCallback(() => {
    setValor(null);
    setError(null);
    setAgregando(false);
    setVolviendo(false);
    setRecien(null);
    reiniciarAlta();
  }, [reiniciarAlta]);
  const abrirAlta = useCallback(() => {
    reiniciarAlta();
    setError(null);
    setAgregando(true);
    setVolviendo(false);
  }, [reiniciarAlta]);
  const cerrarAlta = useCallback(() => {
    reiniciarAlta();     // el número escrito se descarta
    setAgregando(false);
    setVolviendo(true);
  }, [reiniciarAlta]);
  const validar = useCallback(() => {
    if (tarjeta && !tarjetaVencida(tarjeta.vence, Date.now())) return true;
    if (tarjeta) setError(MENSAJE_VENCIDA);
    else setError(tarjetas.length ? MENSAJE_SIN_MEDIO : MENSAJE_SIN_TARJETAS);
    return false;
  }, [tarjeta, tarjetas.length]);

  return {
    tarjetas, valor, tarjeta, error, elegir, validar, reiniciar, agregando, abrirAlta, cerrarAlta, alta, volviendo,
  };
}
