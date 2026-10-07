// Configuración de Vite (WP1, sección 9.1 de la especificación).
// - react-native se resuelve como react-native-web.
// - Las variantes .web.* se eligen antes que los stubs nativos (imports sin extensión).
// - El service worker único es src/sw.js (WP4), compilado con injectManifest.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const extensiones = ['.web.jsx', '.web.js', '.web.mjs', '.jsx', '.js', '.mjs', '.json'];

// Manifiesto de la PWA (sección 9.3). El ícono es propio, no el logo municipal.
const MANIFIESTO = {
  name: 'San Francisco Conecta (prototipo)',
  short_name: 'SF Conecta',
  description: 'Servicios al vecino de San Francisco. Prototipo académico UTN FRSF, sin vínculo oficial con la Municipalidad.',
  lang: 'es-AR',
  dir: 'ltr',
  start_url: '/#/inicio',
  scope: '/',
  id: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#f4f7fa',
  theme_color: '#009ee2',
  categories: ['government', 'utilities'],
  icons: [
    { src: '/icons/icono-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icono-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  shortcuts: [
    { name: 'Nuevo reclamo', url: '/#/reclamos/nuevo' },
    { name: 'Estacionar', url: '/#/estacionamiento' },
    { name: 'Bicicletas', url: '/#/bicicletas' },
  ],
};

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt',
      injectRegister: false, // lo registra src/plataforma/registroSW.web.js, llamado desde index.web.js
      manifest: MANIFIESTO,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,webmanifest}'],
        globIgnores: ['**/brand/README.md'],
        maximumFileSizeToCacheInBytes: 3_000_000,
      },
      devOptions: { enabled: mode === 'development', type: 'module' },
    }),
  ],
  resolve: { alias: { 'react-native': 'react-native-web' }, extensions: extensiones },
  optimizeDeps: { esbuildOptions: { resolveExtensions: extensiones, loader: { '.js': 'jsx' } } },
  define: { __DEV__: JSON.stringify(mode !== 'production') },
  server: { host: '127.0.0.1', port: 5175, strictPort: true },
  preview: { host: '127.0.0.1', port: 4175, strictPort: true },
  build: {
    target: 'es2022',
    emptyOutDir: true, // borra los service workers viejos de dist/
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@firebase/firestore') || id.includes('node_modules/firebase/firestore')) return 'firestore';
          if (id.includes('node_modules/@firebase/auth')) return 'auth';
          if (id.includes('node_modules/react-native-web')) return 'rnw';
          // leaflet NO va acá: queda en el chunk diferido del mapa (UIX-03)
          return undefined;
        },
      },
    },
  },
}));
