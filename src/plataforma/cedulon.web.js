// Cedulón imprimible (S4, sección 8.7). Reemplaza heredado:src/platform.web.js:41-80, que descargaba
// un .html (FUN-10, UIX-10): ahora se abre directamente el diálogo de impresión del navegador, desde
// donde el vecino imprime o elige "Guardar como PDF".
//
// Cómo imprime: arma el cedulón como HTML escapado (función esc de heredado:platform.web.js:42-55)
// dentro de un contenedor propio en el documento, oculto en pantalla, y una hoja de estilos de
// impresión que oculta todo lo demás. Después llama a print().
// Por qué no un iframe oculto (lo que proponía la especificación): Safari de iOS ignora print()
// dentro de un iframe e imprime la página de afuera (punto VERIFICAR 9). Imprimir el propio documento
// con estilos de impresión funciona igual en Chrome de Android, Safari de iOS y escritorio, y no abre
// ventanas emergentes. Si print() no existe o falla, se abre la vista en una pestaña aparte.
//
// imprimirCedulon(tributo, info) → Promise<{ modo: 'impresion' | 'pestana' }>
//   tributo: { id, concepto, periodo, … }   (solo para el título)
//   info: {
//     titulo, subtitulo, municipio, pie, leyenda, aviso,
//     estado: { texto, tono: 'exito' | 'alerta' | 'peligro' | 'neutro' },
//     filas: [[etiqueta, valor], …], importe, codigo, codigoAgrupado,
//     barras: [{ barra, ancho }], unidades, silencio, emitido,
//   }
// Todo llega ya formateado desde la pantalla: este archivo solo escapa y dibuja.
import { ErrorApp } from '../datos/errores';

const ID_CONTENEDOR = 'cedulon-impresion';
const ID_ESTILOS = 'cedulon-impresion-estilos';

export function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

const TONOS = {
  exito: ['#edf5e6', '#3c6520'],
  alerta: ['#fff1df', '#a84f00'],
  peligro: ['#fde6ea', '#a21937'],
  neutro: ['#eef2f6', '#526174'],
};

function svgBarras(barras, unidades, silencio) {
  if (!Array.isArray(barras) || !barras.length || !unidades) return '';
  let x = silencio ?? 10;
  const rects = [];
  for (const b of barras) {
    if (b.barra) rects.push(`<rect x="${x}" y="0" width="${b.ancho}" height="60"/>`);
    x += b.ancho;
  }
  return `<svg class="barras" viewBox="0 0 ${unidades} 60" preserveAspectRatio="none" role="img" aria-label="Código de barras" xmlns="http://www.w3.org/2000/svg"><g fill="#000">${rects.join('')}</g></svg>`;
}

// Estilos del cedulón, todos bajo #cedulon-impresion para no tocar la app.
const CSS_CEDULON = `
#${ID_CONTENEDOR}{font-family:Quicksand,system-ui,Arial,sans-serif;color:#1e2939;max-width:720px;margin:0 auto;font-size:14px;line-height:1.45}
#${ID_CONTENEDOR} *{box-sizing:border-box}
#${ID_CONTENEDOR} .cabecera{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid #0077ae;padding-bottom:10px}
#${ID_CONTENEDOR} .marca{font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#0077ae;font-weight:700;margin:0}
#${ID_CONTENEDOR} h1{font-size:24px;margin:2px 0 0}
#${ID_CONTENEDOR} .sub{margin:2px 0 0;color:#526174}
#${ID_CONTENEDOR} .estado{display:inline-block;padding:3px 12px;border-radius:999px;font-weight:700;border:1px solid currentColor;white-space:nowrap}
#${ID_CONTENEDOR} .leyenda{margin:12px 0;padding:8px 12px;border:1px dashed #7a5e00;color:#7a5e00;font-size:12px}
#${ID_CONTENEDOR} table{width:100%;border-collapse:collapse;margin:8px 0}
#${ID_CONTENEDOR} th,#${ID_CONTENEDOR} td{text-align:left;padding:8px 4px;border-bottom:1px solid #dce4eb;vertical-align:top}
#${ID_CONTENEDOR} th{color:#526174;font-weight:500;width:38%}
#${ID_CONTENEDOR} td{font-weight:700}
#${ID_CONTENEDOR} .importe{display:flex;justify-content:space-between;align-items:baseline;margin:12px 0;padding:12px 0;border-top:2px solid #1e2939;border-bottom:2px solid #1e2939}
#${ID_CONTENEDOR} .importe strong{font-size:28px}
#${ID_CONTENEDOR} .codigo{border:1px solid #1e2939;border-radius:8px;padding:12px 16px;text-align:center;page-break-inside:avoid;break-inside:avoid}
#${ID_CONTENEDOR} .codigo p{margin:0 0 6px;color:#526174;font-size:12px;text-transform:uppercase;letter-spacing:1px}
#${ID_CONTENEDOR} .barras{display:block;width:100%;max-width:520px;height:64px;margin:0 auto 6px}
#${ID_CONTENEDOR} .digitos{font-family:"Courier New",monospace;font-size:16px;font-weight:700;letter-spacing:1px;white-space:nowrap}
#${ID_CONTENEDOR} .aviso{margin:12px 0 0;font-weight:700}
#${ID_CONTENEDOR} .pie{margin-top:16px;color:#526174;font-size:12px}
`;

const CSS_IMPRESION = `
@media screen{#${ID_CONTENEDOR}{display:none !important}}
@media print{
  @page{margin:14mm}
  html,body{height:auto !important;background:#fff !important}
  body>*:not(#${ID_CONTENEDOR}){display:none !important}
  #${ID_CONTENEDOR}{display:block !important}
}
${CSS_CEDULON}`;

function cuerpoCedulon(tributo, info = {}) {
  const [fondo, tinta] = TONOS[info.estado?.tono] ?? TONOS.neutro;
  const filas = (info.filas ?? [])
    .map(([etiqueta, valor]) => `<tr><th scope="row">${esc(etiqueta)}</th><td>${esc(valor)}</td></tr>`)
    .join('');
  const codigo = info.codigo
    ? `<div class="codigo"><p>Código de pago</p>${svgBarras(info.barras, info.unidades, info.silencio)}<div class="digitos">${esc(info.codigoAgrupado ?? info.codigo)}</div></div>`
    : '';
  return `
<div class="cabecera">
  <div>
    <p class="marca">San Francisco Conecta${info.municipio ? ` · ${esc(info.municipio)}` : ''}</p>
    <h1>${esc(info.titulo ?? `Cedulón ${tributo?.id ?? ''}`)}</h1>
    ${info.subtitulo ? `<p class="sub">${esc(info.subtitulo)}</p>` : ''}
  </div>
  ${info.estado?.texto ? `<span class="estado" style="background:${fondo};color:${tinta}">${esc(info.estado.texto)}</span>` : ''}
</div>
<p class="leyenda">${esc(info.leyenda ?? 'Prototipo académico. Documento sin validez.')}</p>
<table><tbody>${filas}</tbody></table>
${info.importe ? `<div class="importe"><span>Importe</span><strong>${esc(info.importe)}</strong></div>` : ''}
${codigo}
${info.aviso ? `<p class="aviso">${esc(info.aviso)}</p>` : ''}
<p class="pie">${esc(info.emitido ?? '')}${info.pie ? ` · ${esc(info.pie)}` : ''}</p>`;
}

/** Documento completo, para la vista en pestaña aparte. */
export function documentoCedulon(tributo, info = {}) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(info.titulo ?? `Cedulón ${tributo?.id ?? ''}`)}</title><style>body{margin:24px;background:#fff}${CSS_CEDULON}</style></head><body><div id="${ID_CONTENEDOR}">${cuerpoCedulon(tributo, info)}</div></body></html>`;
}

function abrirEnPestana(tributo, info) {
  if (typeof window.open !== 'function') {
    throw new ErrorApp('no-soportado', 'Este navegador no permite imprimir el cedulón.');
  }
  // Con "noopener" open() devuelve null aunque la pestaña se abra: no sirve para detectar un bloqueo.
  const url = URL.createObjectURL(new Blob([documentoCedulon(tributo, info)], { type: 'text/html;charset=utf-8' }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { modo: 'pestana' };
}

function prepararContenedor(tributo, info) {
  document.getElementById(ID_CONTENEDOR)?.remove();
  let estilos = document.getElementById(ID_ESTILOS);
  if (!estilos) {
    estilos = document.createElement('style');
    estilos.id = ID_ESTILOS;
    estilos.textContent = CSS_IMPRESION;
    document.head.appendChild(estilos);
  }
  const contenedor = document.createElement('div');
  contenedor.id = ID_CONTENEDOR;
  contenedor.setAttribute('aria-hidden', 'true');
  contenedor.dataset.tributo = String(tributo?.id ?? '');
  contenedor.innerHTML = cuerpoCedulon(tributo, info);
  document.body.appendChild(contenedor);
  return contenedor;
}

/**
 * Se llama directamente desde el onPress (sin await antes): así el navegador lo toma como un gesto
 * del usuario y permite print() o, en el respaldo, abrir la pestaña.
 */
export function imprimirCedulon(tributo, info) {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new ErrorApp('no-soportado', 'Este navegador no permite imprimir el cedulón.');
    }
    prepararContenedor(tributo, info);
    if (typeof window.print !== 'function') return Promise.resolve(abrirEnPestana(tributo, info));
    try {
      window.print();
      return Promise.resolve({ modo: 'impresion' });
    } catch {
      return Promise.resolve(abrirEnPestana(tributo, info));
    }
  } catch (e) {
    return Promise.reject(e instanceof ErrorApp ? e : new ErrorApp('no-soportado', 'No pudimos abrir la impresión. Probá desde otro navegador.', { causa: e }));
  }
}
