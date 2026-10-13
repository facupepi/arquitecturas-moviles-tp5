// Variante nativa de la carga de pantallas (WP5, 7.3): Metro no tiene import.meta.glob, así que
// la lista es explícita. La web usa pantallas.web.js.
import { lazy } from 'react';

const CARGADORES = {
  Ingreso: () => import('../pantallas/Ingreso'),
  Inicio: () => import('../pantallas/Inicio'),
  Bicicletas: () => import('../pantallas/Bicicletas'),
  Tributos: () => import('../pantallas/Tributos'),
  Reclamos: () => import('../pantallas/Reclamos'),
  Contactos: () => import('../pantallas/Contactos'),
  Alarmas: () => import('../pantallas/Alarmas'),
  Estacionamiento: () => import('../pantallas/Estacionamiento'),
  Notificaciones: () => import('../pantallas/Notificaciones'),
  Cuenta: () => import('../pantallas/Cuenta'),
  PanelMunicipal: () => import('../pantallas/PanelMunicipal'),
};

const memoria = new Map();

export function cargarPantalla(archivo, version = 0) {
  // `version` sube con cada "Reintentar": React.lazy recuerda un import fallido, así que hace
  // falta un componente diferido nuevo para volver a intentarlo.
  const clave = `${archivo}#${version}`;
  if (memoria.has(clave)) return memoria.get(clave);
  const componente = CARGADORES[archivo] ? lazy(CARGADORES[archivo]) : null;
  memoria.set(clave, componente);
  return componente;
}

/** Empieza a descargar el chunk de una pantalla sin dibujarla (el import() se comparte con lazy). */
export function precargarPantalla(archivo) {
  CARGADORES[archivo]?.().catch(() => {});
}
