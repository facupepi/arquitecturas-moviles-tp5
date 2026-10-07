// Presentación de las notificaciones (S7): íconos y colores por tipo, etiquetas y filtros.
// Funciones puras: no tocan datos ni la plataforma.
import { colores } from '../../tema/tokens';
import { servicioPorRuta } from '../../tema/servicios';
import { ETIQUETAS } from '../../../shared/constantes.mjs';
import { parsearHash } from '../../../shared/rutas.mjs';

const CIUDAD = { fondo: colores.infoFondo, tinta: colores.info, tono: 'info' };
const ATENCION = { fondo: colores.alertaFondo, tinta: colores.alerta, tono: 'alerta' };
const URGENTE = { fondo: colores.peligroFondo, tinta: colores.peligro, tono: 'peligro' };
const TUYO = { fondo: colores.celesteClaro, tinta: colores.accionOscuro, tono: 'info' };

const ESTILO_TIPO = {
  obras: { icono: 'ajustes', ...ATENCION },
  cortes: { icono: 'sinConexion', ...ATENCION },
  eventos: { icono: 'campana', ...CIUDAD },
  servicios: { icono: 'info', ...CIUDAD },
  emergencias: { icono: 'alerta', ...URGENTE },
  alarmas: { icono: 'alarma', ...URGENTE },
  tributos: { icono: 'tributo', ...TUYO },
  estacionamiento: { icono: 'estacionamiento', ...TUYO },
  reclamos: { icono: 'reclamo', ...TUYO },
};

/** { icono, fondo, tinta, tono } para dibujar una notificación según su tipo. */
export function estiloTipo(tipo) {
  return ESTILO_TIPO[tipo] ?? { icono: 'campana', ...CIUDAD };
}

export function etiquetaTipo(tipo) {
  return ETIQUETAS.tipos[tipo] ?? 'Aviso';
}

/** "Centro", "Toda la ciudad" o null (las personales no tienen zona). */
export function etiquetaZona(zona) {
  if (!zona) return null;
  return ETIQUETAS.zonas[zona] ?? null;
}

// Tipos que el vecino puede elegir, agrupados como los piensa: lo que pasa en la ciudad y lo suyo.
// Las emergencias no se eligen: llegan siempre (decidirEntrega las deja pasar sin mirar tipos ni zona).
export const TIPOS_CIUDAD = ['obras', 'cortes', 'eventos', 'servicios', 'alarmas'];
export const TIPOS_TRAMITES = ['tributos', 'estacionamiento', 'reclamos'];

export const EXPLICACION_FRECUENCIA = {
  inmediata: 'Te avisamos en el momento en que se publica.',
  resumen_diario: 'Un solo aviso por día, a las 20, con las novedades. Las emergencias llegan igual al momento.',
  solo_historial: 'No te mandamos avisos: los ves acá cuando entrás. Las emergencias llegan igual al momento.',
};

export const FILTROS = [
  { valor: 'todas', etiqueta: 'Todas' },
  { valor: 'no_leidas', etiqueta: 'No leídas' },
  { valor: 'ciudad', etiqueta: 'Ciudad' },
  { valor: 'tramites', etiqueta: 'Trámites' },
];

export function filtrar(lista, filtro) {
  switch (filtro) {
    case 'no_leidas': return lista.filter((n) => !n.leida);
    case 'ciudad': return lista.filter((n) => n.fuente === 'aviso');
    case 'tramites': return lista.filter((n) => n.fuente === 'personal');
    default: return lista;
  }
}

/**
 * A dónde lleva "Ir al servicio": { ruta, titulo } o null. Un destino a Notificaciones (la bienvenida)
 * no lleva a otra pantalla: abre las preferencias.
 */
export function accionDestino(destino) {
  if (!destino) return null;
  const { nombre } = parsearHash(destino);
  if (nombre === 'notificaciones') return { ruta: nombre, titulo: 'Elegir qué recibir', preferencias: true };
  if (nombre === 'inicio') return { ruta: nombre, titulo: 'Ir al inicio' };
  const servicio = servicioPorRuta(nombre);
  return { ruta: nombre, titulo: servicio ? `Ir a ${servicio.corto ?? servicio.nombre}` : 'Ir al servicio' };
}

/** Texto de los textos accesibles y del encabezado: "Tenés 3 sin leer". */
export function textoNoLeidas(n) {
  if (!n) return 'Tenés todo leído';
  return n === 1 ? 'Tenés 1 sin leer' : `Tenés ${n} sin leer`;
}
