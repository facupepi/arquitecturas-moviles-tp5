// Guardado automático de las preferencias (S7, N2 y A4).
//
// Cada toque en un chip guarda enseguida. No usa useComando porque su candado descarta una
// segunda llamada mientras la primera sigue en curso, y acá el vecino puede tocar varios chips
// seguidos: se guarda siempre la última versión, una escritura por vez.
// Mientras hay cambios sin confirmar, la pantalla muestra `borrador` en lugar de lo del almacén.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as repositorio from '../../datos/repositorio';
import { ErrorApp, desdeFirebase } from '../../datos/errores';
import { EVENTOS, registrarEvento } from '../../firebase/analytics';

export function useGuardarPreferencias() {
  const [estado, setEstado] = useState({ fase: 'inactivo', error: null, borrador: null });
  const siguiente = useRef(null);
  const corriendo = useRef(false);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  const fijar = (parcial) => {
    if (montado.current) setEstado((e) => ({ ...e, ...parcial }));
  };

  const vaciarCola = useCallback(async () => {
    if (corriendo.current) return;
    corriendo.current = true;
    let ultimoError = null;
    let guardadas = null;
    while (siguiente.current) {
      const preferencias = siguiente.current;
      siguiente.current = null;
      try {
        await repositorio.guardarPreferencias(preferencias);
        ultimoError = null;
        guardadas = preferencias;
      } catch (e) {
        ultimoError = e instanceof ErrorApp ? e : desdeFirebase(e);
      }
    }
    corriendo.current = false;
    if (ultimoError) {
      // El borrador se descarta: la pantalla vuelve a mostrar lo que quedó guardado.
      fijar({ fase: 'error', error: ultimoError, borrador: null });
      try { registrarEvento(EVENTOS.ERROR_OPERACION, { codigo: ultimoError.codigo }); } catch { /* opcional */ }
      return;
    }
    fijar({ fase: 'guardado', error: null, borrador: null });
    if (guardadas) {
      try {
        registrarEvento(EVENTOS.PREFERENCIAS_GUARDADAS, {
          frecuencia: guardadas.frecuencia, tipos: guardadas.tipos.length, zonas: guardadas.zonas.length,
        });
      } catch { /* Analytics es opcional */ }
    }
  }, []);

  const guardar = useCallback((preferencias) => {
    siguiente.current = preferencias;
    fijar({ fase: 'guardando', error: null, borrador: preferencias });
    vaciarCola();
  }, [vaciarCola]);

  const errorDe = (campo) => (estado.error?.campo === campo ? estado.error.message : null);

  return { ...estado, guardar, errorDe };
}
