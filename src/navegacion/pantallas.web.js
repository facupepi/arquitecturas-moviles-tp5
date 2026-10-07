// Carga diferida de las pantallas (WP5, 7.3). import.meta.glob de Vite arma un import() por cada
// archivo que exista en src/pantallas/, así cada pantalla queda en su propio chunk y el build no
// falla mientras alguna todavía no está escrita (fase 1): esa ruta muestra un aviso.
import { lazy } from 'react';

const MODULOS = import.meta.glob('../pantallas/[A-Z]*.jsx');
// La galería no entra en el build de producción: __DEV__ es false y Rollup descarta la rama.
const GALERIA = __DEV__ ? import.meta.glob('../pantallas/_Galeria.jsx') : {};

const memoria = new Map();

/** Componente diferido de src/pantallas/<archivo>.jsx, o null si el archivo no existe. */
export function cargarPantalla(archivo, version = 0) {
  // `version` sube con cada "Reintentar": React.lazy recuerda un import fallido, así que hace
  // falta un componente diferido nuevo para volver a intentarlo.
  const clave = `${archivo}#${version}`;
  if (memoria.has(clave)) return memoria.get(clave);
  const cargador = MODULOS[`../pantallas/${archivo}.jsx`] ?? GALERIA[`../pantallas/${archivo}.jsx`];
  const componente = cargador ? lazy(cargador) : null;
  memoria.set(clave, componente);
  return componente;
}
