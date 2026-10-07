// "Ver todos los avisos de la ciudad" (S7, sección 8.10): el historial sin filtrar por preferencias.
//
// El almacén entrega las notificaciones ya filtradas por las preferencias (4.5) y no expone las
// personales crudas ni el conjunto de avisosLeidos. Mientras el interruptor está prendido, este hook
// abre esas dos escuchas con las funciones del repositorio (4.3) y une todo con unirNotificaciones
// y { todos: true }. Al apagarlo se cierran: no hay lecturas extra si nadie lo usa.
import { useEffect, useMemo, useState } from 'react';
import * as repositorio from '../../datos/repositorio';
import { unirNotificaciones } from '../../../shared/notificaciones.mjs';

const VACIO = { personales: null, leidos: null, error: null };

export function useHistorialCompleto({ activo, uid, avisos, preferencias, limite }) {
  const [crudo, setCrudo] = useState(VACIO);

  useEffect(() => {
    if (!activo || !uid) {
      setCrudo(VACIO);
      return undefined;
    }
    const alFallar = (error) => setCrudo((c) => ({ ...c, error }));
    let cancelarPersonales = () => {};
    let cancelarLeidos = () => {};
    try {
      cancelarPersonales = repositorio.suscribirNotificaciones(uid, limite, (personales) => {
        setCrudo((c) => ({ ...c, personales, error: null }));
      }, alFallar);
      cancelarLeidos = repositorio.suscribirAvisosLeidos(uid, (leidos) => {
        setCrudo((c) => ({ ...c, leidos }));
      }, alFallar);
    } catch (e) {
      alFallar(e);
    }
    return () => {
      cancelarPersonales?.();
      cancelarLeidos?.();
    };
  }, [activo, uid, limite]);

  const lista = useMemo(() => {
    if (!activo || !crudo.personales || !crudo.leidos) return null;
    try {
      return unirNotificaciones(crudo.personales, avisos, crudo.leidos, preferencias, { todos: true });
    } catch {
      return null;
    }
  }, [activo, crudo.personales, crudo.leidos, avisos, preferencias]);

  return { lista, cargando: activo && !lista && !crudo.error, error: activo ? crudo.error : null };
}
