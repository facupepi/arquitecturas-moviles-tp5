// Navegación por hash con enlaces profundos (WP5, sección 7.3).
//   const { ruta, navegar, volver, irA } = useRuta();
//   ruta = { nombre, id, params }      p. ej. #/reclamos/nuevo?estacion=b2 → { nombre: 'reclamos', id: 'nuevo', params: { estacion: 'b2' } }
//   navegar('reclamos', 'nuevo', { estacion: 'b2' })
//   navegar('inicio', null, null, { reemplazar: true })   // sin dejar entrada en el historial
//   irA('#/alarmas/a2')                // destino ya armado (aviso, push); pasa por rutaSegura
//   volver()                           // atrás si se llegó navegando, si no a inicio
// El Enrutador se importa aparte (./Enrutador) desde App.jsx.
export { ProveedorNavegacion, useRuta, useRutaOpcional, normalizarRuta } from './ProveedorNavegacion';
export { useTituloDocumento, NOMBRE_APP } from './useTituloDocumento';
export { ARCHIVO_POR_RUTA, esRutaConocida } from './rutasApp';
export { parsearHash, construirHash, rutaSegura } from '../../shared/rutas.mjs';
