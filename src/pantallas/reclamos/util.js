// Ayudantes puros de la pantalla de reclamos (S5).
import { validarReclamo } from '../../../shared/dominio.mjs';
import { CATEGORIAS_RECLAMO, ESTADOS_RECLAMO, ETIQUETAS } from '../../../shared/constantes.mjs';

export const CAMPOS = ['categoria', 'direccion', 'descripcion'];
export const LARGOS = { direccion: 160, descripcion: 1500 };

export const OPCIONES_CATEGORIA = CATEGORIAS_RECLAMO.map((valor) => ({
  valor,
  etiqueta: ETIQUETAS.categorias?.[valor] ?? valor,
}));

// Datos válidos de referencia: se reemplaza un campo por vez para obtener su propio error.
const BASE_VALIDA = {
  categoria: CATEGORIAS_RECLAMO[0],
  direccion: 'Dirección válida',
  descripcion: 'Descripción válida del problema',
  estacionId: null,
};

// Mensajes que dicen qué hacer, en lugar del genérico "este dato es obligatorio" del dominio.
// La validación es la misma (validarReclamo); solo cambia el texto que ve el vecino.
const MENSAJES = {
  categoria: () => 'Elegí de qué se trata tu reclamo.',
  direccion: (valor) => (String(valor ?? '').trim()
    ? 'La ubicación es muy corta. Sumá la calle y la altura, o una esquina.'
    : 'Indicá dónde es, con calle y altura, una esquina o un lugar conocido.'),
  descripcion: (valor) => (String(valor ?? '').trim()
    ? 'Contanos un poco más, con al menos 10 caracteres.'
    : 'Contanos qué pasa (al menos 10 caracteres).'),
};

/**
 * Errores de todos los campos a la vez, con la misma validación que validarReclamo de
 * shared/dominio.mjs (que corta en el primero). → { categoria?, direccion?, descripcion? }
 */
export function erroresDeReclamo(datos) {
  const errores = {};
  for (const campo of CAMPOS) {
    try {
      validarReclamo({ ...BASE_VALIDA, [campo]: datos[campo] });
    } catch (e) {
      const demasiadoLargo = typeof datos[campo] === 'string' && datos[campo].trim().length > (LARGOS[campo] ?? Infinity);
      errores[campo] = demasiadoLargo ? (e?.message || 'Revisá este dato.') : MENSAJES[campo](datos[campo]);
    }
  }
  return errores;
}

export function etiquetaCategoria(categoria) {
  return ETIQUETAS.categorias?.[categoria] ?? 'Otros';
}

export function etiquetaEstado(estado) {
  return ETIQUETAS.estadosReclamo?.[estado] ?? 'Recibido';
}

export const TONO_ESTADO = { recibido: 'info', en_proceso: 'alerta', resuelto: 'exito' };
export const ICONO_ESTADO = { recibido: 'checkCirculo', en_proceso: 'reloj', resuelto: 'check' };

/** Estado para mostrar en la tarjeta: "Pendiente de envío" mientras la escritura no llegó al servidor. */
export function estadoVisible(reclamo) {
  if (reclamo?.pendiente) return { texto: 'Pendiente de envío', tono: 'neutro', icono: 'sinConexion' };
  const estado = ESTADOS_RECLAMO.includes(reclamo?.estado) ? reclamo.estado : 'recibido';
  return { texto: etiquetaEstado(estado), tono: TONO_ESTADO[estado], icono: ICONO_ESTADO[estado] };
}

/** Minúsculas y sin tildes, para buscar "dirección" escribiendo "direccion". */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** R4: busca por código, dirección o descripción (y categoría) sobre los reclamos ya cargados. */
export function filtrarReclamos(reclamos, busqueda) {
  const terminos = normalizar(busqueda).split(/\s+/).filter(Boolean);
  if (!terminos.length) return reclamos;
  return reclamos.filter((r) => {
    const texto = normalizar([r.codigo, r.direccion, r.descripcion, etiquetaCategoria(r.categoria)].join(' '));
    return terminos.every((t) => texto.includes(t));
  });
}

/** "820 KB", "1,4 MB". */
export function tamanoLegible(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export function esImagen(tipo) {
  return typeof tipo === 'string' && tipo.startsWith('image/');
}

/** Ubicación precargada en un reclamo de Bicicletas (B4): el nombre de la estación, corto para el campo. */
export function ubicacionDeEstacion(estacion) {
  return estacion?.nombre ?? '';
}
