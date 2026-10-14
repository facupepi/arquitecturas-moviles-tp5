// Ayudantes de las pantallas de Bicicletas y Alarmas (S3). Funciones puras, sin plataforma.
import { ETIQUETAS } from '../../../shared/constantes.mjs';
import { ESPACIO_DURO, tiempoRelativo } from '../../../shared/formato.mjs';

/** Texto sin tildes y en minúscula, para buscar "utn" o "plaza general paz" sin importar acentos. */
export function normalizarBusqueda(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** "a 350 m" o "a 1,2 km" (coma decimal, como se lee en Argentina; número y unidad con espacio duro). */
export function distanciaTexto(km) {
  if (!Number.isFinite(km)) return '';
  if (km < 1) return `a ${Math.max(10, Math.round((km * 1000) / 10) * 10)}${ESPACIO_DURO}m`;
  return `a ${km.toFixed(1).replace('.', ',')}${ESPACIO_DURO}km`;
}

export function nombreZona(zona) {
  return ETIQUETAS.zonas[zona] ?? zona ?? '';
}

/** "Actualizado hace 3 min" / "Actualizado recién". Vacío si no hay fecha. */
export function actualizadoTexto(ms, ahora, femenino = false) {
  if (!Number.isFinite(ms)) return '';
  const relativo = tiempoRelativo(Math.min(ms, ahora), ahora);
  return `${femenino ? 'Actualizada' : 'Actualizado'} ${relativo}`;
}

/** Disponibilidad de una estación: texto de la etiqueta, tono de la etiqueta y tono del mapa. */
export function estadoEstacion(estacion) {
  if (estacion.estado === 'fuera_de_servicio') {
    // Rojo en el mapa, como la etiqueta: el naranja oscuro se confundía con el de "Elegida".
    return { texto: 'Fuera de servicio', tono: 'peligro', tonoMapa: 'activo', icono: 'alerta' };
  }
  if (!estacion.bicicletas) return { texto: 'Sin bicicletas', tono: 'neutro', tonoMapa: 'neutro', icono: null };
  if (estacion.bicicletas <= 2) return { texto: 'Quedan pocas', tono: 'alerta', tonoMapa: 'normal', icono: null };
  return { texto: 'Disponible', tono: 'exito', tonoMapa: 'normal', icono: 'check' };
}

/** "1 bicicleta" / "3 bicicletas" (con espacio duro: el número no queda solo al final de un renglón). */
export function plural(n, singular, pluralTexto = `${singular}s`) {
  return `${n}${ESPACIO_DURO}${n === 1 ? singular : pluralTexto}`;
}

/**
 * Orden sin ubicación: primero las que tienen bicicletas, después las vacías y al final las que
 * están fuera de servicio; dentro de cada grupo, el orden del catálogo. Así la lista no empieza por
 * una estación vacía y no salta cada vez que cambia una bicicleta (solo al vaciarse o cerrarse).
 */
export function ordenarPorDisponibilidad(estaciones) {
  const grupo = (e) => (e.estado === 'fuera_de_servicio' ? 2 : e.bicicletas > 0 ? 0 : 1);
  return (estaciones ?? [])
    .map((e, indice) => ({ e, indice }))
    .sort((a, b) => grupo(a.e) - grupo(b.e) || a.indice - b.indice)
    .map(({ e }) => e);
}
