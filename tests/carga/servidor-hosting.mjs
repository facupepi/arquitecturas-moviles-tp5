// Servidor estático que imita a Firebase Hosting para medir la carga en local (WI, sección 10.5).
//
// Sirve una carpeta dist/ con lo que hace Hosting y que cambia los tiempos de carga:
// - compresión Brotli (o gzip si el navegador no acepta br) de HTML, JS, CSS, JSON, SVG y manifiesto;
// - los encabezados Cache-Control de firebase.json (assets inmutables, sw.js e index.html sin caché);
// - Cache-Control "max-age=3600" por defecto, como Hosting;
// - reescritura de toda ruta desconocida a /index.html.
// No imita HTTP/2 ni la CDN: el navegador abre hasta 6 conexiones HTTP/1.1 con keep-alive.
//
// Uso directo: node tests/carga/servidor-hosting.mjs <dist> [puerto]
// Uso desde medir-carga.mjs: import { servirHosting } from './servidor-hosting.mjs'.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve, extname, normalize, sep } from 'node:path';
import { brotliCompressSync, gzipSync, constants as zlib } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};
const COMPRIMIBLES = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt', '.md']);

function cacheControl(ruta) {
  if (ruta.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  if (ruta === '/sw.js' || ruta === '/index.html' || ruta === '/manifest.webmanifest') return 'no-cache';
  return 'max-age=3600';
}

export function servirHosting(dist, puerto = 0) {
  const raiz = resolve(dist);
  if (!existsSync(join(raiz, 'index.html'))) throw new Error(`No existe ${join(raiz, 'index.html')}. Compilá antes.`);
  // Se comprime todo al arrancar (como la CDN de Hosting, que guarda la versión comprimida): comprimir
  // con Brotli 11 en cada solicitud bloquearía el proceso y demoraría las respuestas chicas.
  const comprimidos = new Map(); // clave "br:/ruta" → Buffer
  const recorrer = (carpeta) => readdirSync(carpeta, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? recorrer(join(carpeta, e.name)) : [join(carpeta, e.name)]);
  for (const archivo of recorrer(raiz)) {
    if (!COMPRIMIBLES.has(extname(archivo).toLowerCase())) continue;
    const ruta = `/${archivo.slice(raiz.length + 1).split(sep).join('/')}`;
    const cuerpo = readFileSync(archivo);
    comprimidos.set(`br:${ruta}`, brotliCompressSync(cuerpo, { params: { [zlib.BROTLI_PARAM_QUALITY]: 11 } }));
    comprimidos.set(`gzip:${ruta}`, gzipSync(cuerpo, { level: 9 }));
  }

  const servidor = createServer((req, res) => {
    let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (ruta === '/') ruta = '/index.html';
    let archivo = join(raiz, normalize(ruta));
    if (!archivo.startsWith(raiz) || !existsSync(archivo) || !statSync(archivo).isFile()) {
      ruta = '/index.html'; // rewrites: ** → /index.html
      archivo = join(raiz, 'index.html');
    }
    const ext = extname(archivo).toLowerCase();
    let cuerpo = readFileSync(archivo);
    const encabezados = {
      'Content-Type': TIPOS[ext] ?? 'application/octet-stream',
      'Cache-Control': cacheControl(ruta),
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Accept-Encoding',
    };
    const acepta = String(req.headers['accept-encoding'] ?? '');
    if (COMPRIMIBLES.has(ext)) {
      const codificacion = /\bbr\b/.test(acepta) ? 'br' : /\bgzip\b/.test(acepta) ? 'gzip' : null;
      if (codificacion) {
        const clave = `${codificacion}:${ruta}`;
        if (!comprimidos.has(clave)) {
          comprimidos.set(clave, codificacion === 'br'
            ? brotliCompressSync(cuerpo, { params: { [zlib.BROTLI_PARAM_QUALITY]: 11 } })
            : gzipSync(cuerpo, { level: 9 }));
        }
        cuerpo = comprimidos.get(clave);
        encabezados['Content-Encoding'] = codificacion;
      }
    }
    encabezados['Content-Length'] = cuerpo.length;
    res.writeHead(200, encabezados);
    res.end(req.method === 'HEAD' ? undefined : cuerpo);
  });
  servidor.keepAliveTimeout = 30_000;

  return new Promise((ok, mal) => {
    servidor.once('error', mal);
    servidor.listen(puerto, '127.0.0.1', () => {
      const { port } = servidor.address();
      ok({ url: `http://127.0.0.1:${port}`, cerrar: () => new Promise((r) => { servidor.closeAllConnections?.(); servidor.close(() => r()); }) });
    });
  });
}

const ejecutadoDirecto = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (ejecutadoDirecto) {
  const [dist = 'dist', puerto = '4190'] = process.argv.slice(2);
  const { url } = await servirHosting(dist, Number(puerto));
  console.log(`Sirviendo ${resolve(dist)} en ${url} (Ctrl+C para cerrar)`);
}
