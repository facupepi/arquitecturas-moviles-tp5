// Stub nativo de plataforma/hash (WP5, 7.3): el hash vive en memoria, con su propio historial.

const oyentes = new Set();
const historial = [''];

function notificar() {
  const actual = leerHash();
  for (const cb of [...oyentes]) cb(actual);
}

export function escucharHash(cb) {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

export function leerHash() {
  return historial[historial.length - 1];
}

export function escribirHash(hash, { reemplazar = false } = {}) {
  const destino = hash.startsWith('#') ? hash : `#${hash}`;
  if (leerHash() === destino) return;
  if (reemplazar) historial[historial.length - 1] = destino;
  else historial.push(destino);
  notificar();
}

export function atras() {
  if (historial.length > 1) {
    historial.pop();
    notificar();
  }
}

export function fijarTitulo() {}

export function subirAlInicio() {}
