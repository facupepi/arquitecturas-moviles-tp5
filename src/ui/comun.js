// Ayudantes compartidos por los componentes de src/ui (WP5).
import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { recordarFoco } from './foco';
import { escucharEscape } from './teclaEscape';

/**
 * En RNW, Enter activa cualquier Pressable pero la barra espaciadora solo los de role="button".
 * Los controles con role radio, checkbox, switch o tab la necesitan: se agrega con onKeyDown.
 */
export function alPresionarEspacio(accion) {
  return (evento) => {
    const tecla = evento?.nativeEvent?.key ?? evento?.key;
    if (tecla === ' ' || tecla === 'Spacebar') {
      evento.preventDefault?.();
      accion();
    }
  };
}

/** Id estable para relacionar etiqueta, ayuda y error (aria-labelledby, aria-describedby). */
export function useIdAccesible(prefijo, idPropio) {
  const generado = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return idPropio || `${prefijo}-${generado}`;
}

/** Une ids de aria-describedby descartando los vacíos. */
export function unirIds(...ids) {
  const lista = ids.filter(Boolean);
  return lista.length ? lista.join(' ') : undefined;
}

/**
 * Envuelve un onPress para que el control tocado reciba el foco antes de actuar. Safari no enfoca
 * los botones al tocarlos con el puntero, y los Modal de RNW devuelven el foco al elemento que lo
 * tenía al abrirse: sin esto, al cerrar un diálogo el foco se perdería en el documento.
 * (Mismo problema que resolvía heredado:MunicipalApp.jsx con menuOrigin.) En nativo no hace nada.
 */
export function conFoco(accion) {
  return (evento, ...resto) => {
    const nodo = evento?.currentTarget;
    if (nodo && typeof nodo.focus === 'function') {
      try {
        nodo.focus({ preventScroll: true });
      } catch {
        // Sin foco programático: se sigue igual.
      }
    }
    return accion?.(evento, ...resto);
  };
}

/**
 * Para Modal: al pasar `visible` a true guarda el elemento enfocado (antes de que el Modal mueva
 * el foco adentro, por eso useLayoutEffect) y al cerrarse se lo devuelve.
 */
export function useDevolverFoco(visible) {
  const devolver = useRef(null);
  useLayoutEffect(() => {
    if (visible) {
      devolver.current = recordarFoco();
    } else if (devolver.current) {
      devolver.current();
      devolver.current = null;
    }
  }, [visible]);
  useEffect(
    () => () => {
      devolver.current?.();
      devolver.current = null;
    },
    [],
  );
}

/**
 * Escape para un Modal abierto (ver teclaEscape.web.js). Se registra en layout, en el mismo commit
 * que monta el Modal, antes de que RNW lo marque activo. `alEscape` puede cambiar en cada render.
 */
export function useEscape(abierto, alEscape) {
  const ultimo = useRef(alEscape);
  ultimo.current = alEscape;
  useLayoutEffect(() => {
    if (!abierto) return undefined;
    return escucharEscape(() => ultimo.current?.());
  }, [abierto]);
}
