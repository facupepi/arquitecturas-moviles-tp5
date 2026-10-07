// Código de barras del cedulón (S4). Intercalado 2 de 5 (ITF), el formato de los cedulones
// argentinos: codifica pares de dígitos, así que el código de pago (24 dígitos, codigoPagoTributo
// de shared/dominio.mjs) entra justo. Funciones puras: las usan el diálogo del cedulón (barras de
// View) y la versión imprimible (SVG en plataforma/cedulon.web.js).

// N = angosta, W = ancha. Cada dígito tiene 5 elementos, dos de ellos anchos.
const PATRONES = {
  0: 'NNWWN', 1: 'WNNNW', 2: 'NWNNW', 3: 'WWNNN', 4: 'NNWNW',
  5: 'WNWNN', 6: 'NWWNN', 7: 'NNNWW', 8: 'WNNWN', 9: 'NWNWN',
};
const ANCHA = 3;
const ZONA_SILENCIO = 10;

const elemento = (barra, letra) => ({ barra, ancho: letra === 'W' ? ANCHA : 1 });

/**
 * Lista de elementos { barra: boolean, ancho: unidades } de izquierda a derecha, sin las zonas de
 * silencio. Devuelve [] si el código no tiene solo dígitos o tiene una cantidad impar.
 */
export function barrasITF(codigo) {
  const digitos = String(codigo ?? '');
  if (!/^[0-9]+$/.test(digitos) || digitos.length % 2 !== 0) return [];
  const salida = [elemento(true, 'N'), elemento(false, 'N'), elemento(true, 'N'), elemento(false, 'N')];
  for (let i = 0; i < digitos.length; i += 2) {
    const barras = PATRONES[digitos[i]];
    const espacios = PATRONES[digitos[i + 1]];
    for (let j = 0; j < 5; j += 1) {
      salida.push(elemento(true, barras[j]), elemento(false, espacios[j]));
    }
  }
  salida.push(elemento(true, 'W'), elemento(false, 'N'), elemento(true, 'N'));
  return salida;
}

/** Ancho total en unidades, con las dos zonas de silencio. */
export function anchoITF(barras) {
  return barras.reduce((total, b) => total + b.ancho, 0) + ZONA_SILENCIO * 2;
}

export const ZONA_SILENCIO_ITF = ZONA_SILENCIO;

/** "001001000018500202610097" → "0010 0100 0018 5002 0261 0097" (más fácil de dictar o copiar). */
export function agruparCodigo(codigo, cada = 4) {
  const texto = String(codigo ?? '');
  const grupos = [];
  for (let i = 0; i < texto.length; i += cada) grupos.push(texto.slice(i, i + cada));
  return grupos.join(' ');
}
