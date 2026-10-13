// useAdmin() (WP3, sección 4.5): suscripciones del panel municipal. Solo se monta en
// PanelMunicipal: { reclamos (con uid, últimos 50), eventos (últimos 20), cargando, error }.
// useControlAdmin() y useResumenAdmin(): lo que hacen los vecinos con tributos y estacionamiento.
import { useEffect, useMemo, useState } from 'react';
import { suscribirEventos, suscribirReclamosAdmin } from './repositorio';
import {
  resumenControlAdmin, suscribirPagosAdmin, suscribirSesionesActivasAdmin, suscribirTributosVencidosAdmin,
} from './repositorioPanel';

export function useAdmin() {
  const [estado, setEstado] = useState({ reclamos: [], eventos: [], cargando: true, error: null });

  useEffect(() => {
    let vivo = true;
    const llegaron = { reclamos: false, eventos: false };
    const fijar = (cambios) => { if (vivo) setEstado((previo) => ({ ...previo, ...cambios })); };
    const marcar = (porcion) => {
      llegaron[porcion] = true;
      return llegaron.reclamos && llegaron.eventos ? { cargando: false } : {};
    };
    const fallar = (porcion) => (error) => fijar({ error, ...marcar(porcion) });

    const cancelarReclamos = suscribirReclamosAdmin(50, (reclamos) => fijar({ reclamos, error: null, ...marcar('reclamos') }), fallar('reclamos'));
    const cancelarEventos = suscribirEventos(20, (eventos) => fijar({ eventos, ...marcar('eventos') }), fallar('eventos'));
    return () => {
      vivo = false;
      cancelarReclamos();
      cancelarEventos();
    };
  }, []);

  return estado;
}

// Tope de la escucha de cedulones sin pagar: si los vencidos llenan la lista, puede haber más.
export const LIMITE_VENCIDOS = 50;

/** Los cedulones de la escucha que ya vencieron a `ahora` y si la lista quedó cortada por el tope. */
export function vencidosAl(impagos, ahora) {
  const lista = impagos.filter((t) => t.vence != null && t.vence < ahora);
  return { lista, cortada: impagos.length >= LIMITE_VENCIDOS && lista.length === impagos.length };
}

const SUSCRIPCIONES_CONTROL = {
  pagos: (ok, mal) => suscribirPagosAdmin(100, ok, mal),
  sesiones: (ok, mal) => suscribirSesionesActivasAdmin(200, ok, mal),
  vencidos: (ok, mal) => suscribirTributosVencidosAdmin(LIMITE_VENCIDOS, ok, mal),
};

/** Una porción del control: { lista, cargando, error }. Escucha solo mientras `activa` es true. */
function usePorcionControl(porcion, activa) {
  const [estado, setEstado] = useState({ lista: [], cargando: true, error: null });
  useEffect(() => {
    if (!activa) return undefined;
    let vivo = true;
    const cancelar = SUSCRIPCIONES_CONTROL[porcion](
      (lista) => { if (vivo) setEstado({ lista, cargando: false, error: null }); },
      (error) => { if (vivo) setEstado((previo) => ({ ...previo, cargando: false, error })); },
    );
    return () => { vivo = false; cancelar(); };
  }, [porcion, activa]);
  return estado;
}

/**
 * Escuchas del control de pagos y estacionamiento, cada porción con su carga y su error:
 * { pagos (últimos 100), sesiones (activas), vencidos (los 50 cedulones sin pagar más atrasados;
 *   la pantalla se queda con los ya vencidos usando vencidosAl),
 *   cargando: { pagos, sesiones, vencidos }, errores: { pagos, sesiones, vencidos } }.
 * `activas` elige qué porciones escuchar: los pagos y los vencidos son las más pesadas (en un
 * celular modesto, con caché persistente, procesarlas demora las escrituras del resto del panel),
 * así que el panel las abre solo mientras se ve la pestaña Pagos.
 */
export function useControlAdmin({ pagos: conPagos = true, sesiones: conSesiones = true, vencidos: conVencidos = true } = {}) {
  const pagos = usePorcionControl('pagos', conPagos);
  const sesiones = usePorcionControl('sesiones', conSesiones);
  const vencidos = usePorcionControl('vencidos', conVencidos);
  return useMemo(() => ({
    pagos: pagos.lista, sesiones: sesiones.lista, vencidos: vencidos.lista,
    cargando: { pagos: pagos.cargando, sesiones: sesiones.cargando, vencidos: vencidos.cargando },
    errores: { pagos: pagos.error, sesiones: sesiones.error, vencidos: vencidos.error },
  }), [pagos, sesiones, vencidos]);
}

const ESPERA_RESUMEN_MS = 700;           // agrupa varios pagos que llegan juntos en un solo cálculo
const REFRESCO_RESUMEN_MS = 5 * 60_000;  // y se recalcula solo cada tanto (cambio de día, vencimientos)

/**
 * Totales del servidor (recaudación del día y del mes, estacionamiento del día y cedulones vencidos).
 * Se recalculan cuando cambia `senal` (por ejemplo, el id del último pago) y cada 5 minutos.
 * { resumen | null, cargando, error }.
 */
export function useResumenAdmin(senal) {
  const [estado, setEstado] = useState({ resumen: null, cargando: true, error: null });
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setVuelta((n) => n + 1), REFRESCO_RESUMEN_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      resumenControlAdmin().then(
        (resumen) => { if (vivo) setEstado({ resumen, cargando: false, error: null }); },
        (error) => { if (vivo) setEstado((previo) => ({ ...previo, cargando: false, error })); },
      );
    }, ESPERA_RESUMEN_MS);
    return () => { vivo = false; clearTimeout(t); };
  }, [senal, vuelta]);

  return estado;
}

export default useAdmin;
