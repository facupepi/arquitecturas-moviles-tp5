// Componentes compartidos de la interfaz (WP5, sección 7.2). Las pantallas importan desde acá:
//   import { Pantalla, Tarjeta, Boton, useAvisoFlotante } from '../ui';
// La galería (#/galeria, solo en desarrollo) muestra cada uno con sus variantes.
export { default as Pantalla } from './Pantalla';
export { default as Encabezado, ANTETITULO_POR_DEFECTO } from './Encabezado';
export { default as Seccion } from './Seccion';
export { default as Tarjeta } from './Tarjeta';
export { default as Boton } from './Boton';
export { default as Campo } from './Campo';
export { default as Selector } from './Selector';
export { default as Pestanas } from './Pestanas';
export { default as EtiquetaEstado, TONOS_ESTADO } from './EtiquetaEstado';
export { default as Aviso, TONOS_AVISO } from './Aviso';
export { ProveedorAvisos, useAvisoFlotante, DURACION_AVISO_MS } from './AvisoFlotante';
export { default as Vacio } from './Vacio';
export { default as Cargando } from './Cargando';
export { default as ErrorCarga, CODIGOS_REINTENTABLES } from './ErrorCarga';
export { default as Dialogo } from './Dialogo';
export { default as Mapa } from './Mapa';
export { default as Icono, NOMBRES_ICONOS } from './Icono';
export { default as Insignia, textoInsignia } from './Insignia';
export { default as FilaDato } from './FilaDato';
export { default as Interruptor } from './Interruptor';
export { default as Texto } from './Texto';
export { ContextoMarco } from './contextoMarco';
