// useComando (WP3, sección 4.6): estado local de ocupado y error por operación (COD-03, UIX-04).
// No importa nada de WP5: el aviso de éxito lo decide la pantalla con alExito.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorApp, desdeFirebase } from './errores';
import { EVENTOS, registrarEvento } from '../firebase/analytics';
import { medir } from '../firebase/rendimiento';

function registrar(nombre, parametros) {
  try { registrarEvento(nombre, parametros); } catch { /* Analytics es opcional */ }
}

// const pago = useComando(repositorio.pagarTributo, { alExito, evento, parametrosEvento, traza });
//   pago.ejecutar(...args) → Promise<resultado | null>; nunca lanza.
//   parametrosEvento(resultado, ...args) es opcional y arma los parámetros de Analytics.
export function useComando(comando, { alExito, evento, parametrosEvento, traza } = {}) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const candado = useRef(false);
  const montado = useRef(true);
  const opciones = useRef({ comando, alExito, evento, parametrosEvento, traza });
  opciones.current = { comando, alExito, evento, parametrosEvento, traza };

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  const ejecutar = useCallback(async (...args) => {
    if (candado.current) return null;   // evita la doble ejecución (heredado:useMunicipal.js:72-73)
    candado.current = true;
    const o = opciones.current;
    if (montado.current) { setOcupado(true); setError(null); }
    try {
      const correr = () => o.comando(...args);
      const resultado = await (o.traza ? medir(o.traza, correr) : correr());
      if (o.evento) registrar(o.evento, o.parametrosEvento ? o.parametrosEvento(resultado, ...args) : undefined);
      try { o.alExito?.(resultado); } catch (e) { console.warn('alExito falló:', e); }
      return resultado ?? null;
    } catch (e) {
      const errorApp = e instanceof ErrorApp ? e : desdeFirebase(e);
      if (montado.current) setError(errorApp);
      registrar(EVENTOS?.ERROR_OPERACION ?? 'error_operacion', { codigo: errorApp.codigo });
      return null;
    } finally {
      candado.current = false;
      if (montado.current) setOcupado(false);
    }
  }, []);

  const limpiar = useCallback(() => setError(null), []);
  const errorDe = useCallback((campo) => (error && error.campo === campo ? error.message : null), [error]);

  return { ejecutar, ocupado, error, errorDe, limpiar };
}

export default useComando;
