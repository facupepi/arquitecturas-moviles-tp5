// Adjuntos de un reclamo en el navegador (S5, sección 8.8).
//
//   const lista = await elegirArchivos({ maximo: 3 });    // ArchivoLocal[] (lista.descartados = sobrantes)
//   const listo = await prepararArchivo(lista[0]);        // comprimido y validado
//   liberarVistaPrevia(listo);                            // al quitarlo o al enviar
//
// ArchivoLocal = { nombre, tipo, tamano, blob, vistaPrevia? }. Las imágenes se comprimen en el
// cliente a 1600 px por lado y JPEG 0,8; los PDF pasan tal cual si pesan hasta 2 MiB. El tipo se
// confirma por los primeros bytes (tipoPorFirma), igual que lo hace adjuntos/subir en el servidor.
import { ErrorApp } from '../datos/errores';
import { tipoPorFirma, validarArchivo } from '../../shared/dominio.mjs';
import { LIMITES, TIPOS_ARCHIVO } from '../../shared/constantes.mjs';

const ACEPTA = 'image/jpeg,image/png,application/pdf';
const CALIDAD_JPEG = 0.8;
const MENSAJE_TIPO = 'Adjuntá imágenes JPG o PNG, o documentos PDF.';

function errorAdjunto(mensaje) {
  return new ErrorApp('validacion', mensaje, { campo: 'adjuntos' });
}

function aLocal(archivo) {
  return { nombre: archivo.name || 'archivo', tipo: archivo.type || '', tamano: archivo.size, blob: archivo };
}

/**
 * Abre el selector del sistema (en el celular ofrece la cámara y la galería). Resuelve con los
 * archivos elegidos, como mucho `maximo`; si se eligieron más, `lista.descartados` dice cuántos
 * quedaron afuera. Si la persona cancela, resuelve con una lista vacía.
 */
export function elegirArchivos({ maximo = LIMITES.adjuntos } = {}) {
  return new Promise((resolver, rechazar) => {
    if (typeof document === 'undefined' || !document.body) {
      rechazar(new ErrorApp('no-soportado', 'Este navegador no permite adjuntar archivos.'));
      return;
    }
    const entrada = document.createElement('input');
    entrada.type = 'file';
    entrada.accept = ACEPTA;
    entrada.multiple = maximo > 1;
    entrada.tabIndex = -1;
    entrada.setAttribute('aria-hidden', 'true');
    entrada.setAttribute('data-adjuntos-reclamo', '');
    entrada.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0;';

    let terminado = false;
    const terminar = (lista) => {
      if (terminado) return;
      terminado = true;
      entrada.remove();
      resolver(lista);
    };
    entrada.addEventListener('change', () => {
      const todos = Array.from(entrada.files ?? []);
      const lista = todos.slice(0, Math.max(0, maximo)).map(aLocal);
      lista.descartados = Math.max(0, todos.length - lista.length);
      terminar(lista);
    });
    // Chrome 113+ y Safari 16.4+ avisan la cancelación; en los demás la promesa queda pendiente
    // sin bloquear nada (la pantalla no espera en estado ocupado mientras se elige).
    entrada.addEventListener('cancel', () => terminar([]));

    // En Safari el input tiene que estar en el documento para que click() abra el selector.
    document.body.appendChild(entrada);
    entrada.click();
  });
}

async function cabecera(blob) {
  try {
    return new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  } catch {
    return new Uint8Array(0);
  }
}

function decodificarConImagen(blob) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(blob);
    const imagen = new window.Image();
    imagen.onload = () => {
      URL.revokeObjectURL(url);
      resolver({ fuente: imagen, ancho: imagen.naturalWidth, alto: imagen.naturalHeight, cerrar: () => {} });
    };
    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error('imagen ilegible'));
    };
    imagen.src = url;
  });
}

async function decodificar(blob) {
  if (typeof window.createImageBitmap === 'function') {
    try {
      const mapa = await window.createImageBitmap(blob, { imageOrientation: 'from-image' });
      return { fuente: mapa, ancho: mapa.width, alto: mapa.height, cerrar: () => mapa.close?.() };
    } catch {
      // Safari viejo no acepta opciones: se prueba con <img>.
    }
  }
  return decodificarConImagen(blob);
}

// Lado mayor a 1600 px como máximo y JPEG 0,8, con fondo blanco (un PNG transparente no queda negro).
async function comprimir(blob) {
  const { fuente, ancho, alto, cerrar } = await decodificar(blob);
  try {
    if (!ancho || !alto) throw new Error('imagen sin tamaño');
    const escala = Math.min(1, LIMITES.ladoImagen / Math.max(ancho, alto));
    const w = Math.max(1, Math.round(ancho * escala));
    const h = Math.max(1, Math.round(alto * escala));
    const lienzo = document.createElement('canvas');
    lienzo.width = w;
    lienzo.height = h;
    const ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(fuente, 0, 0, w, h);
    const salida = await new Promise((resolver) => lienzo.toBlob(resolver, 'image/jpeg', CALIDAD_JPEG));
    if (!salida) throw new Error('no se pudo comprimir');
    return { blob: salida, reducida: escala < 1 };
  } finally {
    cerrar();
  }
}

function conExtensionJpg(nombre) {
  const base = String(nombre || 'foto').replace(/\.[^.]{1,8}$/, '');
  return `${base || 'foto'}.jpg`;
}

function validar(datos) {
  try {
    return validarArchivo(datos);
  } catch (e) {
    throw errorAdjunto(e?.message || MENSAJE_TIPO);
  }
}

/**
 * Comprime las imágenes y valida tipo y peso. Lanza ErrorApp('validacion', …, { campo: 'adjuntos' })
 * con un mensaje para mostrar debajo de la lista de adjuntos.
 */
export async function prepararArchivo(archivo) {
  const blob = archivo?.blob;
  if (!blob || typeof blob.slice !== 'function') throw errorAdjunto('No pudimos leer el archivo.');
  if (!blob.size) throw errorAdjunto('El archivo está vacío.');
  const nombre = archivo.nombre || blob.name || 'archivo';
  const declarado = archivo.tipo || blob.type || '';
  const bytes = await cabecera(blob);
  // Si los primeros bytes no se pudieron leer, se confía en el tipo declarado: el servidor vuelve
  // a comprobar la firma de todos modos (adjuntos/subir responde adjunto-invalido si no coincide).
  const real = bytes.length ? tipoPorFirma(bytes) : (TIPOS_ARCHIVO.includes(declarado) ? declarado : null);

  if (real === 'application/pdf' || (!real && declarado === 'application/pdf')) {
    if (real !== 'application/pdf') throw errorAdjunto('El PDF parece dañado. Probá con otro archivo.');
    const ok = validar({ nombre, tipo: real, tamano: blob.size });
    return { nombre: ok.nombre, tipo: real, tamano: blob.size, blob };
  }

  const pareceImagen = real === 'image/jpeg' || real === 'image/png' || declarado.startsWith('image/');
  if (!pareceImagen) throw errorAdjunto(MENSAJE_TIPO);

  let comprimida = null;
  try {
    comprimida = await comprimir(blob);
  } catch {
    comprimida = null;
  }

  let final;
  if (comprimida && (!real || comprimida.reducida || comprimida.blob.size < blob.size)) {
    // Se usa la versión comprimida si achica la foto, si pesa menos o si el original no era JPG ni PNG
    // (por ejemplo, una foto HEIC del iPhone que el navegador sí sabe dibujar).
    final = { nombre: conExtensionJpg(nombre), tipo: 'image/jpeg', blob: comprimida.blob };
  } else if (real === 'image/jpeg' || real === 'image/png') {
    final = { nombre, tipo: real, blob };
  } else {
    throw errorAdjunto('No pudimos abrir esa imagen. Probá con una foto JPG o PNG.');
  }

  const ok = validar({ nombre: final.nombre, tipo: final.tipo, tamano: final.blob.size });
  let vistaPrevia;
  try {
    vistaPrevia = URL.createObjectURL(final.blob);
  } catch {
    vistaPrevia = undefined;
  }
  return { nombre: ok.nombre, tipo: final.tipo, tamano: final.blob.size, blob: final.blob, vistaPrevia };
}

/** Libera la URL temporal de la miniatura (al quitar el archivo o después de enviar). */
export function liberarVistaPrevia(archivo) {
  if (archivo?.vistaPrevia && archivo.vistaPrevia.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(archivo.vistaPrevia);
    } catch {
      // Ya estaba liberada.
    }
  }
}
