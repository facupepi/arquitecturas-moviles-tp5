// Presupuesto del paquete inicial (WP1, sección 10.5).
//
// Mide el JavaScript que index.html carga antes del primer pintado: el script de entrada y todo lo
// que importa de forma estática (y los <link rel="modulepreload">). Los import() dinámicos quedan
// afuera, porque se descargan después. Falla si la suma comprimida con gzip supera el presupuesto
// o si Leaflet aparece en ese paquete (el mapa va en un chunk diferido, UIX-03).
//
// Uso: node scripts/presupuesto.mjs [--dist <carpeta>] [--json]
//
// Medición del esqueleto (fase 0, 7 de octubre de 2026): React 19.1 + react-dom, RNW 0.21.2 con los
// componentes de la sección 7.2, firebase/app, App Check (reCAPTCHA v3), Auth con initializeAuth y
// las funciones de Google con browserPopupRedirectResolver, Firestore con caché persistente y
// registerSW, compilado con este vite.config.mjs. Resultado con gzip nivel 9: 307,0 KB
// (firestore 156,2; rnw con react-dom 109,8; auth 30,4; entrada con React 10,7). Sin
// browserPopupRedirectResolver daba 303,8 KB: el resolvedor cuesta 3,2 KB y se mantiene (5.2).
// Presupuesto = esqueleto + 40 KB para el código propio = 347 KB.
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname, resolve, relative } from 'node:path';

export const ESQUELETO_KB = 307;
export const MARGEN_CODIGO_PROPIO_KB = 40;
export const PRESUPUESTO_KB = ESQUELETO_KB + MARGEN_CODIGO_PROPIO_KB;

const args = process.argv.slice(2);
const indiceDist = args.indexOf('--dist');
const dist = resolve(indiceDist >= 0 ? args[indiceDist + 1] : 'dist');
const comoJson = args.includes('--json');

function fallar(mensaje) {
  console.error(`presupuesto: ${mensaje}`);
  process.exit(1);
}

const rutaIndice = join(dist, 'index.html');
if (!existsSync(rutaIndice)) fallar(`no existe ${rutaIndice}. Corré antes "vite build".`);
const html = readFileSync(rutaIndice, 'utf8');

// Rutas absolutas del sitio ("/assets/x.js") a archivos de dist/.
const aArchivo = (url, desde = dist) => {
  const limpia = url.split('?')[0].split('#')[0];
  return limpia.startsWith('/') ? join(dist, limpia) : resolve(desde, limpia);
};

const iniciales = new Set();
for (const m of html.matchAll(/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["']/g)) iniciales.add(aArchivo(m[1]));
for (const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*\btype=["']module["']/g)) iniciales.add(aArchivo(m[1]));
for (const m of html.matchAll(/<link\b[^>]*\brel=["']modulepreload["'][^>]*\bhref=["']([^"']+)["']/g)) iniciales.add(aArchivo(m[1]));
if (iniciales.size === 0) fallar('index.html no carga ningún script de tipo module.');

// Recorre los imports estáticos de cada chunk (import … from "x", import "x", export … from "x").
const reImport = /(?:^|[;}\s)])(?:import|export)\s*(?:[\w$*{}\s,]+?\s*from\s*)?["']([^"']+\.m?js)["']/g;
const visitados = new Set();
const pendientes = [...iniciales];
while (pendientes.length) {
  const archivo = pendientes.pop();
  if (visitados.has(archivo)) continue;
  if (!existsSync(archivo)) fallar(`index.html referencia ${relative(dist, archivo)}, que no existe.`);
  visitados.add(archivo);
  const codigo = readFileSync(archivo, 'utf8');
  for (const m of codigo.matchAll(reImport)) {
    if (/^https?:/.test(m[1])) continue;
    pendientes.push(aArchivo(m[1], dirname(archivo)));
  }
}

const filas = [...visitados].map((archivo) => {
  const contenido = readFileSync(archivo);
  const texto = contenido.toString('utf8');
  return {
    archivo: relative(dist, archivo).replaceAll('\\', '/'),
    kb: contenido.length / 1024,
    gzipKb: gzipSync(contenido, { level: 9 }).length / 1024,
    leaflet: /leaflet/i.test(archivo) || texto.includes('leaflet-container') || texto.includes('leafletjs.com'),
  };
}).sort((a, b) => b.gzipKb - a.gzipKb);

const totalGzip = filas.reduce((s, f) => s + f.gzipKb, 0);
const totalKb = filas.reduce((s, f) => s + f.kb, 0);
const conLeaflet = filas.filter((f) => f.leaflet);

if (comoJson) {
  console.log(JSON.stringify({ presupuestoKb: PRESUPUESTO_KB, totalGzipKb: +totalGzip.toFixed(1), totalKb: +totalKb.toFixed(1), archivos: filas }, null, 2));
} else {
  console.log('Paquete inicial (JavaScript que carga index.html antes del primer pintado):');
  for (const f of filas) console.log(`  ${f.archivo.padEnd(48)} ${f.kb.toFixed(1).padStart(8)} KB  ${f.gzipKb.toFixed(1).padStart(7)} KB gzip`);
  console.log(`  ${'Total'.padEnd(48)} ${totalKb.toFixed(1).padStart(8)} KB  ${totalGzip.toFixed(1).padStart(7)} KB gzip`);
  console.log(`  Presupuesto: ${PRESUPUESTO_KB} KB gzip (esqueleto ${ESQUELETO_KB} + ${MARGEN_CODIGO_PROPIO_KB} de código propio)`);
}

if (conLeaflet.length) fallar(`Leaflet está en el paquete inicial (${conLeaflet.map((f) => f.archivo).join(', ')}). Cargá el mapa con React.lazy.`);
if (totalGzip > PRESUPUESTO_KB) fallar(`el paquete inicial pesa ${totalGzip.toFixed(1)} KB gzip y supera el presupuesto de ${PRESUPUESTO_KB} KB.`);
if (!comoJson) console.log('presupuesto: OK');
