// Remote Config diferido (WP4, sección 5.7).
//
// Hasta que el SDK carga (iniciarConfigRemota, desde diferidos.js) se usan VALORES_POR_DEFECTO.
// Los cambios publicados en la consola llegan en vivo con onConfigUpdate; si esa escucha falla, se
// vuelve a pedir la configuración al traer la pestaña al frente (con el intervalo mínimo de 5 min en
// producción y 1 min en desarrollo). Con emuladores no se carga: las pruebas usan los valores por defecto.
// La plantilla versionada con los mismos parámetros está en remoteconfig.template.json.
import { useSyncExternalStore } from 'react';
import { app } from './app.js';
import { USAR_EMULADORES, DESARROLLO } from './config.js';

const LEYENDA_POR_DEFECTO = 'Prototipo académico UTN FRSF, sin vínculo oficial con la Municipalidad de San Francisco';

/** Valores por defecto, con los nombres de los parámetros de Remote Config. */
export const VALORES_POR_DEFECTO = Object.freeze({
  leyenda_prototipo: LEYENDA_POR_DEFECTO,
  banner_emergencia: '',
  radio_alarma_km: 1,
  intervalo_cercania_min: 30,
  mensaje_bienvenida: 'Tu ciudad, a un toque.',
});

const NIVELES_BANNER = ['alerta', 'peligro'];

function numeroEntre(texto, minimo, maximo, porDefecto) {
  const n = Number(texto);
  if (texto === '' || !Number.isFinite(n) || n <= 0) return porDefecto;
  return Math.min(maximo, Math.max(minimo, n));
}

// Un destino válido es un hash de la app ("#/alarmas/a2"); cualquier otra cosa se descarta.
function destinoValido(destino) {
  return typeof destino === 'string' && /^#\/[\w\-/?=&.%]*$/.test(destino) ? destino : null;
}

/** '{"texto","nivel","destino"}' → { texto, nivel, destino } | null */
export function convertirBanner(texto) {
  if (typeof texto !== 'string' || !texto.trim()) return null;
  try {
    const dato = JSON.parse(texto);
    const contenido = typeof dato?.texto === 'string' ? dato.texto.trim() : '';
    if (!contenido) return null;
    return {
      texto: contenido.slice(0, 280),
      nivel: NIVELES_BANNER.includes(dato.nivel) ? dato.nivel : 'alerta',
      destino: destinoValido(dato.destino),
    };
  } catch {
    return null;
  }
}

/** Convierte los valores crudos (texto) a lo que usa la app, con los respaldos de 5.7. */
export function convertirConfig(crudos = {}) {
  const texto = (clave) => {
    const valor = crudos[clave];
    return valor === undefined || valor === null ? String(VALORES_POR_DEFECTO[clave]) : String(valor);
  };
  const leyenda = texto('leyenda_prototipo').trim();
  const bienvenida = texto('mensaje_bienvenida').trim();
  return Object.freeze({
    // La leyenda no se puede quitar: vacía o con menos de 20 caracteres vuelve al valor por defecto.
    leyendaPrototipo: leyenda.length >= 20 ? leyenda : LEYENDA_POR_DEFECTO,
    bannerEmergencia: convertirBanner(texto('banner_emergencia')),
    radioAlarmaKm: numeroEntre(texto('radio_alarma_km').trim(), 0.1, 20, VALORES_POR_DEFECTO.radio_alarma_km),
    // El cliente limita la vigencia de la cercanía a 60 minutos (las reglas aceptan hasta 61).
    intervaloCercaniaMin: Math.round(numeroEntre(texto('intervalo_cercania_min').trim(), 1, 60, VALORES_POR_DEFECTO.intervalo_cercania_min)),
    mensajeBienvenida: bienvenida || VALORES_POR_DEFECTO.mensaje_bienvenida,
  });
}

let actual = convertirConfig();
const oyentes = new Set();
let inicio = null;

function publicar(nuevo) {
  if (JSON.stringify(nuevo) === JSON.stringify(actual)) return;
  actual = nuevo;
  for (const oyente of oyentes) oyente();
}

const suscribir = (oyente) => {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
};
const leer = () => actual;

/** Hook: { leyendaPrototipo, bannerEmergencia, radioAlarmaKm, intervaloCercaniaMin, mensajeBienvenida }. */
export function useConfigRemota() {
  return useSyncExternalStore(suscribir, leer, leer);
}

/** Lo mismo que useConfigRemota, fuera de React. */
export function leerConfig() {
  return actual;
}

/** Carga el SDK, activa lo último guardado, trae lo nuevo y escucha cambios en vivo. Idempotente. */
export function iniciarConfigRemota() {
  if (inicio) return inicio;
  inicio = (async () => {
    if (USAR_EMULADORES) return false;
    try {
      const sdk = await import('firebase/remote-config');
      if (!(await sdk.isSupported())) throw new Error('Remote Config no es compatible con este navegador');
      const rc = sdk.getRemoteConfig(app);
      rc.settings.minimumFetchIntervalMillis = DESARROLLO ? 60_000 : 300_000;
      rc.settings.fetchTimeoutMillis = 10_000;
      rc.defaultConfig = { ...VALORES_POR_DEFECTO };

      const actualizar = () => {
        const crudos = {};
        for (const clave of Object.keys(VALORES_POR_DEFECTO)) crudos[clave] = sdk.getValue(rc, clave).asString();
        publicar(convertirConfig(crudos));
      };
      const traerYActivar = async () => {
        try {
          await sdk.fetchAndActivate(rc);
        } catch (e) {
          console.info('[Remote Config] Sin valores nuevos:', e?.code || e?.message || e);
        }
        actualizar();
      };

      // Lo último activado (guardado en IndexedDB) se ve enseguida, aun sin red.
      await sdk.ensureInitialized(rc);
      actualizar();
      await traerYActivar();

      // Cambios en vivo para la demo: un cambio publicado en la consola llega en segundos.
      try {
        sdk.onConfigUpdate(rc, {
          next: () => { sdk.activate(rc).then(actualizar, () => {}); },
          error: (e) => {
            console.info('[Remote Config] Se cortó la escucha en vivo; se actualiza al volver a la pestaña.', e?.code || e);
          },
          complete: () => {},
        });
      } catch (e) {
        console.info('[Remote Config] Sin escucha en vivo:', e?.message || e);
      }

      // Respaldo: al volver la pestaña al frente se pide de nuevo. Si la escucha en vivo sigue
      // abierta, el SDK respeta el intervalo mínimo y no sale a la red.
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') traerYActivar();
        });
      }
      return true;
    } catch (e) {
      console.info('[Remote Config] Inactivo, se usan los valores por defecto:', e?.message || e);
      return false;
    }
  })();
  return inicio;
}
