// Alta de una tarjeta guardada (medios de pago): estado del formulario que comparten Mi cuenta y la
// pasarela (cuando el vecino no tiene tarjetas, la carga sin salir del pago).
// Seguridad: el número completo vive solo en este estado. repositorio.guardarTarjeta lo usa para
// validarlo y guarda { tipo, red, ultimos4, titular, vence }; al guardar, al cancelar o al cerrar,
// el formulario vuelve a vacío. Nunca se pide el código de seguridad.
import { useCallback, useMemo, useRef, useState } from 'react';
import * as repositorio from '../../datos/repositorioTarjetas';
import { useComando } from '../../datos/useComando';
import { LIMITES } from '../../../shared/constantes.mjs';
import { revisarTarjeta } from '../../../shared/tarjetas.mjs';

export const CAMPOS_TARJETA = ['tipo', 'numero', 'titular', 'vence'];

export const OPCIONES_TIPO_TARJETA = [
  { valor: 'credito', etiqueta: 'Crédito' },
  { valor: 'debito', etiqueta: 'Débito' },
];

export const NOTA_SEGURIDAD_TARJETAS = 'Guardamos solo los últimos 4 dígitos. Nunca te pedimos el código de seguridad.';

const VACIO = { tipo: null, numero: '', titular: '', vence: '' };

/** "4242424242424242" → "4242 4242 4242 4242" (solo dígitos, hasta 19, en grupos de 4). */
export function formatearNumero(texto) {
  const digitos = String(texto ?? '').replace(/\D/g, '').slice(0, LIMITES.largoTarjetaMax);
  return digitos.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** "0829" → "08/29" mientras se escribe (solo dígitos, la barra la pone la app). */
export function formatearVence(texto) {
  const digitos = String(texto ?? '').replace(/\D/g, '').slice(0, 4);
  return digitos.length > 2 ? `${digitos.slice(0, 2)}/${digitos.slice(2)}` : digitos;
}

/**
 * const alta = useAltaTarjeta({ alGuardar });
 *   alta.valores, alta.errores (uno por campo), alta.errorGeneral, alta.ocupado,
 *   alta.cambiar(campo, valor), alta.enviar() → tarjeta guardada | null, alta.reiniciar(), alta.refs
 */
export function useAltaTarjeta({ alGuardar } = {}) {
  const [valores, setValores] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const refs = useRef(null);
  if (!refs.current) refs.current = { tipo: { current: null }, numero: { current: null }, titular: { current: null }, vence: { current: null } };
  const alGuardarRef = useRef(alGuardar);
  alGuardarRef.current = alGuardar;
  const guardado = useComando(repositorio.guardarTarjeta);
  const { limpiar, ejecutar, errorDe } = guardado;

  const enfocar = useCallback((campo) => {
    setTimeout(() => { try { refs.current[campo]?.current?.focus?.(); } catch { /* sin foco en nativo */ } }, 0);
  }, []);

  const cambiar = useCallback((campo, valor) => {
    setValores((v) => ({ ...v, [campo]: valor }));
    setErrores((e) => (e[campo] ? { ...e, [campo]: null } : e));
    limpiar();
  }, [limpiar]);

  const reiniciar = useCallback(() => {
    setValores(VACIO);
    setErrores({});
    limpiar();
  }, [limpiar]);

  const enviar = useCallback(async () => {
    const revision = revisarTarjeta(valores, Date.now());
    if (!revision.tarjeta) {
      setErrores(revision.errores);
      enfocar(CAMPOS_TARJETA.find((c) => revision.errores[c]));
      return null;
    }
    const guardada = await ejecutar(valores);
    if (!guardada) {
      enfocar('numero');   // "Esa tarjeta ya está guardada" va debajo del número
      return null;
    }
    setValores(VACIO);     // el número completo se descarta apenas se guarda
    setErrores({});
    alGuardarRef.current?.(guardada);
    return guardada;
  }, [valores, ejecutar, enfocar]);

  const mostrados = useMemo(
    () => Object.fromEntries(CAMPOS_TARJETA.map((c) => [c, errores[c] ?? errorDe(c)])),
    [errores, errorDe],
  );
  const errorGeneral = guardado.error && !CAMPOS_TARJETA.includes(guardado.error.campo) ? guardado.error : null;

  return {
    valores, errores: mostrados, errorGeneral, ocupado: guardado.ocupado, cambiar, enviar, reiniciar, refs: refs.current,
  };
}
