// Control de "React Native de verdad" (WP1, sección 0 de la especificación).
//
// Recorre src/ y falla si, fuera de las excepciones, encuentra:
//   - etiquetas JSX en minúscula (<div>, <span>, <button>, <input>, <select>, <a>, …),
//   - los identificadores document., window., navigator. o localStorage,
//   - un import de .css que no sea reset.css o leaflet/dist/leaflet.css (esto vale para todo src/).
// Excepciones: archivos .web.js, .web.jsx y .web.mjs, src/index.web.js, src/sw.js y src/firebase/**.
//
// Uso: node scripts/verificar-rn.mjs [carpeta …]   (por defecto, src)
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, basename } from 'node:path';

const raizProyecto = process.cwd();
const carpetas = process.argv.slice(2).length ? process.argv.slice(2) : ['src'];
const EXTENSIONES = /\.(m?js|jsx)$/;

const normalizar = (ruta) => relative(raizProyecto, resolve(ruta)).replaceAll('\\', '/');

function esExcepcion(ruta) {
  return /\.web\.(m?js|jsx)$/.test(ruta)
    || ruta === 'src/sw.js'
    || ruta.startsWith('src/firebase/');
}

function listar(carpeta) {
  if (!existsSync(carpeta)) return [];
  if (!statSync(carpeta).isDirectory()) return [carpeta]; // también acepta archivos sueltos (pedido de S3)
  const salida = [];
  for (const nombre of readdirSync(carpeta)) {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...listar(ruta));
    else salida.push(ruta);
  }
  return salida;
}

// Reemplaza comentarios y el texto de las cadenas por espacios (conserva los saltos de línea para
// que los números de línea sigan valiendo). Las expresiones ${…} de las plantillas se conservan.
function soloCodigo(fuente) {
  let salida = '';
  let i = 0;
  const pilaPlantilla = [];   // profundidad de llaves al entrar a cada ${
  let llaves = 0;
  const blanco = (c) => (c === '\n' ? '\n' : ' ');
  while (i < fuente.length) {
    const c = fuente[i];
    const s = fuente[i + 1];
    if (c === '/' && s === '/') {
      while (i < fuente.length && fuente[i] !== '\n') { salida += ' '; i++; }
    } else if (c === '/' && s === '*') {
      salida += '  '; i += 2;
      while (i < fuente.length && !(fuente[i] === '*' && fuente[i + 1] === '/')) { salida += blanco(fuente[i]); i++; }
      salida += '  '; i += 2;
    } else if (c === '"' || c === "'") {
      salida += c; i++;
      while (i < fuente.length && fuente[i] !== c && fuente[i] !== '\n') {
        if (fuente[i] === '\\') { salida += ' '; i++; }
        salida += blanco(fuente[i] ?? ''); i++;
      }
      salida += c; i++;
    } else if (c === '`' || (c === '}' && pilaPlantilla.length && llaves === pilaPlantilla.at(-1))) {
      if (c === '}') pilaPlantilla.pop();
      salida += c; i++;
      while (i < fuente.length && fuente[i] !== '`' && !(fuente[i] === '$' && fuente[i + 1] === '{')) {
        if (fuente[i] === '\\') { salida += ' '; i++; }
        salida += blanco(fuente[i] ?? ''); i++;
      }
      if (fuente[i] === '$') { pilaPlantilla.push(llaves); salida += '${'; i += 2; } else { salida += '`'; i++; }
    } else {
      if (c === '{') llaves++;
      if (c === '}') llaves--;
      salida += c; i++;
    }
  }
  return salida;
}

const lineaDe = (texto, indice) => texto.slice(0, indice).split('\n').length;

const PALABRAS_ANTES_DE_JSX = new Set(['return', 'default', 'yield', 'await', 'case', 'else', 'in', 'of']);

// Etiquetas JSX en minúscula: "<div", "<span", … con el nombre pegado al "<". Se descartan las
// comparaciones (a<b, f(x) <y, v[0]<n): si antes del "<" hay un identificador que no es una
// palabra clave, ")" o "]", no es JSX.
function etiquetasHtml(codigo) {
  const salida = [];
  for (const m of codigo.matchAll(/<([a-z][\w-]*)(?=[\s/>])/g)) {
    let j = m.index - 1;
    while (j >= 0 && /\s/.test(codigo[j])) j--;
    const previo = j >= 0 ? codigo[j] : '';
    if (previo === ')' || previo === ']') continue;
    if (/[\w$]/.test(previo)) {
      let k = j;
      while (k >= 0 && /[\w$]/.test(codigo[k])) k--;
      if (!PALABRAS_ANTES_DE_JSX.has(codigo.slice(k + 1, j + 1))) continue;
    }
    salida.push({ indice: m.index, motivo: `etiqueta HTML <${m[1]}> (usá componentes de react-native)` });
  }
  return salida;
}

const REGLAS_DOM = [
  { re: /(?<![\w$.])(document|window|navigator)\s*\??\./g, motivo: (m) => `uso de ${m[1]}. (solo en archivos .web.*)` },
  { re: /(?<![\w$])localStorage(?![\w$])/g, motivo: () => 'uso de localStorage (solo en archivos .web.*)' },
];

const RE_CSS = /(?:import\s*(?:[\w$*{}\s,]+from\s*)?|import\s*\(\s*|require\s*\(\s*)["']([^"']+\.css)["']/g;

const hallazgos = [];
const archivos = carpetas.flatMap((c) => listar(c));
for (const archivo of archivos) {
  const ruta = normalizar(archivo);
  if (ruta.endsWith('.css')) {
    if (basename(ruta) !== 'reset.css') hallazgos.push(`${ruta}:1: archivo CSS propio no permitido (el único es src/reset.css)`);
    continue;
  }
  if (!EXTENSIONES.test(ruta)) continue;
  const fuente = readFileSync(archivo, 'utf8');

  for (const m of fuente.matchAll(RE_CSS)) {
    const destino = m[1];
    const permitido = destino === 'leaflet/dist/leaflet.css' || basename(destino) === 'reset.css';
    if (!permitido) hallazgos.push(`${ruta}:${lineaDe(fuente, m.index)}: import de CSS no permitido (${destino})`);
  }

  if (esExcepcion(ruta)) continue;
  const codigo = soloCodigo(fuente);
  const problemas = etiquetasHtml(codigo);
  for (const regla of REGLAS_DOM) {
    for (const m of codigo.matchAll(regla.re)) problemas.push({ indice: m.index, motivo: regla.motivo(m) });
  }
  for (const p of problemas.sort((a, b) => a.indice - b.indice)) hallazgos.push(`${ruta}:${lineaDe(codigo, p.indice)}: ${p.motivo}`);
}

if (hallazgos.length) {
  console.error(`verificar-rn: ${hallazgos.length} problema(s) en ${carpetas.join(', ')}:`);
  for (const h of hallazgos) console.error('  ' + h);
  console.error('Fuera de los archivos .web.*, src/index.web.js, src/sw.js y src/firebase/** todo se escribe con react-native.');
  process.exit(1);
}
console.log(`verificar-rn: OK (${archivos.length} archivo(s) revisados en ${carpetas.join(', ')})`);
