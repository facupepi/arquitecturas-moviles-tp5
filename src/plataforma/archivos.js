// Adjuntos de un reclamo: stub nativo (S5, sección 8.8). La versión web es archivos.web.js.
// En una app nativa se reemplazaría por el selector de documentos o la cámara del sistema.
import { ErrorApp } from '../datos/errores';
import { validarArchivo } from '../../shared/dominio.mjs';

export async function elegirArchivos() {
  throw new ErrorApp('no-soportado', 'Adjuntar archivos todavía no está disponible en esta versión de la app.');
}

export async function prepararArchivo(archivo) {
  try {
    const ok = validarArchivo({ nombre: archivo?.nombre, tipo: archivo?.tipo, tamano: archivo?.tamano });
    return { ...archivo, nombre: ok.nombre };
  } catch (e) {
    throw new ErrorApp('validacion', e?.message, { campo: 'adjuntos' });
  }
}

export function liberarVistaPrevia() {}
