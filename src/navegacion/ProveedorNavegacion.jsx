// Navegación por hash (WP5, sección 7.3). Formato: #/<ruta>[/<id>][?clave=valor].
// El estado sale siempre del hash (enlaces profundos, botón atrás y push que abren #/alarmas/a2).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { parsearHash, construirHash, rutaSegura } from '../../shared/rutas.mjs';
import { escucharHash, leerHash, escribirHash, atras } from '../plataforma/hash';

export const ContextoNavegacion = createContext(null);

/** Normaliza lo que devuelve parsearHash: siempre { nombre, id, params }. */
export function normalizarRuta(hash) {
  let r = null;
  try {
    r = parsearHash(hash);
  } catch {
    r = null;
  }
  const nombre = typeof r?.nombre === 'string' && r.nombre ? r.nombre : 'inicio';
  const id = r?.id === undefined || r?.id === '' ? null : r.id;
  const params = r?.params && typeof r.params === 'object' ? r.params : {};
  return { nombre, id, params };
}

export function ProveedorNavegacion({ children }) {
  const [estado, setEstado] = useState(() => ({ hash: leerHash(), cambios: 0 }));
  // Navegaciones propias apiladas en el historial: "volver" usa atrás solo si hay alguna.
  const profundidad = useRef(0);

  useEffect(() => {
    // Por si el hash cambió entre el primer render y la suscripción.
    setEstado((prev) => (prev.hash === leerHash() ? prev : { hash: leerHash(), cambios: prev.cambios + 1 }));
    return escucharHash((hash) => {
      setEstado((prev) => (prev.hash === hash ? prev : { hash, cambios: prev.cambios + 1 }));
    });
  }, []);

  const ruta = useMemo(() => normalizarRuta(estado.hash), [estado.hash]);

  const navegar = useCallback((nombre, id = null, params = null, opciones = {}) => {
    const destino = construirHash(nombre, id ?? undefined, params ?? undefined);
    if (!opciones.reemplazar && destino !== leerHash()) profundidad.current += 1;
    escribirHash(destino, opciones);
  }, []);

  /** Navega a un hash ya armado (destino de un aviso o de un push), pasado por rutaSegura. */
  const irA = useCallback((destino, opciones = {}) => {
    const seguro = rutaSegura(destino);
    if (!opciones.reemplazar && seguro !== leerHash()) profundidad.current += 1;
    escribirHash(seguro, opciones);
  }, []);

  const volver = useCallback(() => {
    if (profundidad.current > 0) {
      profundidad.current -= 1;
      atras();
    } else {
      escribirHash(construirHash('inicio'), { reemplazar: true });
    }
  }, []);

  const valor = useMemo(
    () => ({ ruta, hash: estado.hash, cambios: estado.cambios, navegar, irA, volver }),
    [ruta, estado.hash, estado.cambios, navegar, irA, volver],
  );

  return <ContextoNavegacion.Provider value={valor}>{children}</ContextoNavegacion.Provider>;
}

/**
 * { ruta: { nombre, id, params }, navegar(nombre, id?, params?, { reemplazar }?), volver(), irA(hash) }.
 * Lanza un error claro si se usa fuera de <ProveedorNavegacion>.
 */
export function useRuta() {
  const contexto = useContext(ContextoNavegacion);
  if (!contexto) throw new Error('useRuta() necesita <ProveedorNavegacion> (lo monta App.jsx).');
  return contexto;
}

/** Como useRuta, pero devuelve null fuera del proveedor (para componentes de src/ui). */
export function useRutaOpcional() {
  return useContext(ContextoNavegacion);
}
