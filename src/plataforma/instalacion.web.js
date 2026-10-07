// Instalación de la PWA (S1, sección 8.2). Variante web.
//
//   const { disponible, esIOS, instalada, instalar } = useInstalacion();
//
// - disponible: el navegador ofreció la instalación (beforeinstallprompt de Chrome, Edge y
//   Samsung Internet) y todavía no se usó. instalar() abre el diálogo del navegador y devuelve
//   'accepted', 'dismissed' o 'no-disponible'.
// - esIOS: Safari de iPhone o iPad, que no tiene beforeinstallprompt: la pantalla explica
//   "Compartir, Agregar a inicio".
// - instalada: la app ya corre instalada (display-mode standalone) o se instaló en esta visita.
//
// El evento beforeinstallprompt se escucha al importar el módulo: llega una sola vez por carga de
// página, así que src/index.web.js lo importa al arrancar (también lo usan Ingreso y Cuenta).
// El evento appinstalled registra pwa_instalada en Analytics.
import { useSyncExternalStore } from 'react';
import { EVENTOS, registrarEvento } from '../firebase/analytics';

let eventoDiferido = null;
let instaladaEnEstaVisita = false;
const oyentes = new Set();

function detectarIOS() {
  try {
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  } catch {
    return false;
  }
}

function modoInstalada() {
  try {
    if (navigator.standalone === true) return true;
    return typeof window.matchMedia === 'function'
      && (window.matchMedia('(display-mode: standalone)').matches
        || window.matchMedia('(display-mode: minimal-ui)').matches);
  } catch {
    return false;
  }
}

const ES_IOS = detectarIOS();

function calcular() {
  const instalada = instaladaEnEstaVisita || modoInstalada();
  return { disponible: !!eventoDiferido && !instalada, esIOS: ES_IOS, instalada };
}

let instantanea = calcular();

function notificar() {
  const nueva = calcular();
  if (nueva.disponible === instantanea.disponible && nueva.instalada === instantanea.instalada) return;
  instantanea = nueva;
  for (const oyente of [...oyentes]) {
    try { oyente(); } catch (e) { console.warn('[Instalación] Error en un oyente:', e); }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (evento) => {
    // Sin preventDefault Chrome muestra su propia barra; la app ofrece el botón en Cuenta e Ingreso.
    evento.preventDefault();
    eventoDiferido = evento;
    notificar();
  });
  window.addEventListener('appinstalled', () => {
    eventoDiferido = null;
    instaladaEnEstaVisita = true;
    registrarEvento(EVENTOS.PWA_INSTALADA);
    notificar();
  });
  try {
    window.matchMedia?.('(display-mode: standalone)')?.addEventListener?.('change', notificar);
  } catch {
    // Navegadores viejos sin addEventListener en MediaQueryList: se ve al recargar.
  }
}

/** Abre el diálogo de instalación del navegador. Devuelve 'accepted', 'dismissed' o 'no-disponible'. */
export async function instalar() {
  const evento = eventoDiferido;
  if (!evento) return 'no-disponible';
  // El evento se puede usar una sola vez.
  eventoDiferido = null;
  notificar();
  try {
    await evento.prompt();
    const eleccion = await evento.userChoice;
    const resultado = eleccion?.outcome === 'accepted' ? 'accepted' : 'dismissed';
    if (resultado === 'accepted') {
      instaladaEnEstaVisita = true;
      notificar();
    }
    return resultado;
  } catch (e) {
    console.warn('[Instalación] El navegador no abrió el diálogo:', e?.message || e);
    return 'no-disponible';
  }
}

function suscribir(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

const leer = () => instantanea;

/** { disponible, esIOS, instalada, instalar } */
export function useInstalacion() {
  const estado = useSyncExternalStore(suscribir, leer, leer);
  return { ...estado, instalar };
}
