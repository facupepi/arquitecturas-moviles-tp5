// Registro del service worker único (WP4, secciones 5.1 y 9.1).
//
// src/index.web.js llama registrarServiceWorker() al arrancar, antes del ingreso, para que la app se
// pueda instalar y usar sin red desde la primera visita. registerType es 'prompt': una versión nueva
// queda en espera hasta que el vecino acepta el aviso (ActualizacionDisponible, WP5), que llama
// aplicarActualizacion(); sw.js atiende el mensaje SKIP_WAITING y la página se recarga sola.
import { registerSW } from 'virtual:pwa-register';
import { ErrorApp } from '../datos/errores.js';

let actualizar = null;
let hayActualizacion = false;
const oyentes = new Set();

const soportado = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

// Si el service worker no pudo navegar la ventana al tocar una notificación (ventana no controlada),
// manda { tipo: 'navegar', destino: '#/…' } y la ruta se cambia acá. destino ya pasó por rutaSegura.
function escucharNavegacion() {
  navigator.serviceWorker.addEventListener('message', (evento) => {
    const { tipo, destino } = evento.data || {};
    if (tipo === 'navegar' && typeof destino === 'string' && destino.startsWith('#/')) window.location.hash = destino;
  });
}

export function registrarServiceWorker() {
  if (!soportado() || actualizar) return;
  escucharNavegacion();
  actualizar = registerSW({
    immediate: true,
    onNeedRefresh() {
      hayActualizacion = true;
      for (const oyente of oyentes) {
        try { oyente(); } catch (e) { console.warn('[SW] Error en un oyente de actualización:', e); }
      }
    },
    onRegisterError(e) {
      console.warn('[SW] No se pudo registrar el service worker:', e);
    },
  });
}

/** Avisa cuando hay una versión nueva esperando. Si ya la había, avisa enseguida. Devuelve cancelar. */
export function alHaberActualizacion(cb) {
  oyentes.add(cb);
  if (hayActualizacion) queueMicrotask(() => { if (oyentes.has(cb)) cb(); });
  return () => { oyentes.delete(cb); };
}

/** Activa la versión en espera y recarga la página. */
export async function aplicarActualizacion() {
  if (actualizar) await actualizar(true);
}

/**
 * Registración activa del service worker (para getToken de Cloud Messaging y para mostrar
 * notificaciones). Rechaza con ErrorApp('no-soportado') si el navegador no tiene service workers o
 * si no queda activo en `ms` milisegundos.
 */
export function registroListo(ms = 5000) {
  if (!soportado()) {
    return Promise.reject(new ErrorApp('no-soportado', 'Este navegador no admite avisos en segundo plano.'));
  }
  let temporizador;
  const vencido = new Promise((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new ErrorApp('no-soportado',
      'El servicio de avisos todavía no está listo. Recargá la página e intentá de nuevo.')), ms);
  });
  return Promise.race([navigator.serviceWorker.ready, vencido]).finally(() => clearTimeout(temporizador));
}
