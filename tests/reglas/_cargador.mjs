// Ganchos de resolución para probar src/datos en Node contra el emulador (WP3).
// - Los módulos de WP4/WP6 y de plataforma se reemplazan por dobles de prueba (_dobles/).
// - Los imports sin extensión de src/ ('./errores') se resuelven como hace Vite.
const DOBLES = [
  [/\/firebase\/firestore$/, 'firestore.mjs'],
  [/\/firebase\/auth$/, 'auth.mjs'],
  [/\/firebase\/mensajeria$/, 'mensajeria.mjs'],
  [/\/firebase\/configRemota$/, 'configRemota.mjs'],
  [/\/firebase\/analytics$/, 'analytics.mjs'],
  [/\/firebase\/rendimiento$/, 'rendimiento.mjs'],
  [/\/supabase\/funciones$/, 'funciones.mjs'],
  [/\/plataforma\/red$/, 'red.mjs'],
  [/\/plataforma\/ubicacion$/, 'ubicacion.mjs'],
  [/\/plataforma\/notificacionesLocales$/, 'notificacionesLocales.mjs'],
  [/^react-native$/, 'react-native.mjs'],
];

export async function resolve(especificador, contexto, siguiente) {
  const desdeSrc = contexto.parentURL?.includes('/src/');
  for (const [patron, archivo] of DOBLES) {
    if ((desdeSrc || especificador === 'react-native') && patron.test(especificador)) {
      return { url: new URL(`./_dobles/${archivo}`, import.meta.url).href, shortCircuit: true };
    }
  }
  if (desdeSrc && especificador.startsWith('.') && !/\.[a-z]+$/i.test(especificador)) {
    for (const ext of ['.js', '.jsx', '.mjs']) {
      try { return await siguiente(especificador + ext, contexto); } catch { /* probar la siguiente */ }
    }
  }
  return siguiente(especificador, contexto);
}
