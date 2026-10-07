// Acceso al hash de la URL, al título del documento y al desplazamiento de la ventana (WP5, 7.3).
// Es el único lugar de la app que toca location.hash y document.title.

const oyentes = new Set();
let escuchando = false;

function notificar() {
  const actual = leerHash();
  for (const cb of [...oyentes]) cb(actual);
}

/** Llama cb(hash) cada vez que cambia el hash. Devuelve la función para dejar de escuchar. */
export function escucharHash(cb) {
  if (!escuchando) {
    window.addEventListener('hashchange', notificar);
    escuchando = true;
  }
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

/** Hash actual, con el "#" (o cadena vacía). */
export function leerHash() {
  return window.location.hash || '';
}

/**
 * Cambia el hash. Por defecto agrega una entrada al historial (dispara hashchange).
 * Con { reemplazar: true } reemplaza la entrada actual (para redirecciones, así "atrás" no vuelve
 * a la ruta que redirigió) y avisa a los oyentes en el momento.
 */
export function escribirHash(hash, { reemplazar = false } = {}) {
  const destino = hash.startsWith('#') ? hash : `#${hash}`;
  if (window.location.hash === destino) return;
  if (reemplazar) {
    window.history.replaceState(window.history.state, '', destino);
    notificar();
  } else {
    window.location.hash = destino;
  }
}

/** Vuelve a la entrada anterior del historial. */
export function atras() {
  window.history.back();
}

export function fijarTitulo(titulo) {
  document.title = titulo;
}

export function subirAlInicio() {
  window.scrollTo(0, 0);
}
