// Ayudantes de la prueba de humo (WI, sección 10.4). No dependen de los emuladores ni de Vite:
// todo se hace sobre la página publicada.

export const SUPABASE_URL = process.env.HUMO_SUPABASE_URL || 'https://qsxwsbdhlwyshqjfxaxw.supabase.co';

// Mensajes de consola que no indican una falla de la app. Cada uno está justificado:
// - reCAPTCHA y App Check en un navegador sin interfaz: el puntaje bajo o el token rechazado los
//   reporta el SDK como error, aunque App Check está en modo monitor (5.4) y la app sigue andando.
// - Recursos de terceros cancelados por la navegación (teselas de un mapa que se desmonta).
const RUIDO_TOLERADO = [
  /AppCheck.*(throttled|recaptcha-error|fetch-status-error)/i,
  /recaptcha/i,
  /tile\.openstreetmap\.org.*(ERR_ABORTED|NS_BINDING_ABORTED|cancel)/i,
];

/**
 * Junta los errores graves de una página: excepciones no atrapadas, console.error (salvo el ruido
 * tolerado) y respuestas 5xx o solicitudes fallidas del propio sitio y de Supabase.
 */
export function vigilarConsola(page, origenes) {
  const errores = [];
  const propio = (url) => origenes.some((o) => url.startsWith(o));
  page.on('pageerror', (e) => errores.push(`excepción: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // WebKit escribe "Failed to load resource" sin la URL: va en location().
    const donde = m.location()?.url ?? '';
    const texto = donde && !m.text().includes(donde) ? `${m.text()} [${donde}]` : m.text();
    if (RUIDO_TOLERADO.some((r) => r.test(texto))) return;
    errores.push(`console.error: ${texto.slice(0, 300)}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 500 && propio(r.url())) errores.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  page.on('requestfailed', (r) => {
    const motivo = r.failure()?.errorText ?? '';
    // Las navegaciones y los canales largos de Firestore se cancelan al cambiar de pantalla.
    if (/ABORTED|BINDING_ABORTED|cancel/i.test(motivo)) return;
    if (propio(r.url())) errores.push(`falló ${r.url()}: ${motivo}`);
  });
  return errores;
}

/** Usuario de Firebase Auth guardado en el navegador (IndexedDB de Auth), o null. */
export async function usuarioGuardado(page) {
  return page.evaluate(() => new Promise((resolver) => {
    let pedido;
    try { pedido = indexedDB.open('firebaseLocalStorageDb'); } catch { resolver(null); return; }
    pedido.onerror = () => resolver(null);
    pedido.onupgradeneeded = () => { /* no existía: no hay sesión */ };
    pedido.onsuccess = () => {
      const db = pedido.result;
      if (!db.objectStoreNames.contains('firebaseLocalStorage')) { db.close(); resolver(null); return; }
      const todo = db.transaction('firebaseLocalStorage', 'readonly').objectStore('firebaseLocalStorage').getAll();
      todo.onerror = () => { db.close(); resolver(null); };
      todo.onsuccess = () => {
        db.close();
        const fila = (todo.result || []).find((f) => String(f.fbase_key || '').startsWith('firebase:authUser:'));
        const v = fila?.value;
        resolver(v ? { uid: v.uid, anonimo: !!v.isAnonymous } : null);
      };
    };
  }));
}
