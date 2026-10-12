// Mensaje que Cuenta le deja a Ingreso al salir (S1). Al borrar los datos o cerrar la sesión,
// el marco y su aviso flotante se desmontan junto con la sesión; Ingreso lee este mensaje una vez
// y lo muestra arriba de los botones, así el vecino ve que la operación terminó bien.
// Vive solo en memoria: una recarga lo descarta, que es lo esperable.

let pendiente = null;

/** tipo: 'borrado' | 'salida' (o null para descartarlo) */
export function dejarAvisoSalida(tipo) {
  pendiente = tipo;
}

/** Devuelve el aviso pendiente (o null) y lo borra. */
export function tomarAvisoSalida() {
  const tipo = pendiente;
  pendiente = null;
  return tipo;
}

export const MENSAJES_SALIDA = {
  borrado: {
    titulo: 'Borramos tus datos',
    mensaje: 'Eliminamos tu cuenta y todo lo que tenías guardado. Podés volver a entrar con Google cuando quieras, empezando de cero.',
  },
  salida: {
    titulo: 'Cerraste la sesión',
    mensaje: 'Para volver a ver tus gestiones, tocá Continuar con Google y elegí la misma cuenta.',
  },
};
