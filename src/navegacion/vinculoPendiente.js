// Credencial de Google pendiente después de un vínculo por redirect que falló con
// "cuenta-existente" (WP5, 7.4). App.jsx la guarda y navega a #/cuenta?vinculo=existente; la
// pantalla Cuenta (S1) la lee para ofrecer sesion.cambiarACuentaExistente(credencial).
// Vive solo en memoria: una credencial no se puede poner en la URL.

let credencialPendiente = null;
const oyentes = new Set();

export function guardarCredencialPendiente(credencial) {
  credencialPendiente = credencial ?? null;
  for (const cb of [...oyentes]) cb(credencialPendiente);
}

/** La credencial guardada, o null. No la borra. */
export function leerCredencialPendiente() {
  return credencialPendiente;
}

export function limpiarCredencialPendiente() {
  guardarCredencialPendiente(null);
}

/** Avisa cuando cambia la credencial pendiente. Devuelve la función para dejar de escuchar. */
export function escucharCredencialPendiente(cb) {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}
