// Servicios diferidos (WP4, sección 5.1).
//
// App.jsx llama iniciarServiciosDiferidos({ alTerminar: refrescarPush }) una sola vez, cuando el
// almacén queda listo por primera vez. Los SDK de Analytics, Performance y Remote Config se cargan con
// import() dinámico en un momento ocioso (requestIdleCallback, o setTimeout de 1,5 s si no existe),
// así no compiten con la primera pantalla. alTerminar llega por parámetro para que src/firebase/ no
// importe src/datos/ (grafo sin ciclos, 11.3).
import { iniciarAnalytics } from './analytics.js';
import { iniciarRendimiento } from './rendimiento.js';
import { iniciarConfigRemota } from './configRemota.js';

let inicio = null;

function cuandoEsteOcioso() {
  return new Promise((resolver) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolver(), { timeout: 3000 });
    else setTimeout(resolver, 1500);
  });
}

/**
 * Carga los servicios diferidos y después llama alTerminar(). Idempotente: las llamadas siguientes
 * devuelven la misma promesa. Nunca rechaza; resuelve con { analytics, rendimiento, configRemota }
 * (true si cada uno quedó activo).
 */
export function iniciarServiciosDiferidos({ alTerminar } = {}) {
  if (inicio) return inicio;
  inicio = (async () => {
    await cuandoEsteOcioso();
    const [analytics, rendimiento, configRemota] = await Promise.allSettled([
      iniciarAnalytics(),
      iniciarRendimiento(),
      iniciarConfigRemota(),
    ]);
    const activo = (r) => r.status === 'fulfilled' && r.value === true;
    if (typeof alTerminar === 'function') {
      try {
        await alTerminar();
      } catch (e) {
        console.warn('[Diferidos] alTerminar falló:', e?.message || e);
      }
    }
    return { analytics: activo(analytics), rendimiento: activo(rendimiento), configRemota: activo(configRemota) };
  })();
  return inicio;
}
