// "Cerrar sesión" desde el marco (menú de cuenta y menú lateral), WP5: sesion.salir() (8.2).
// Deja el aviso "Cerraste la sesión" para la pantalla de Ingreso, igual que Mi cuenta.
import { salir } from '../datos/sesion';
import { dejarAvisoSalida } from '../pantallas/cuenta/avisoSalida';

export async function cerrarSesionDesdeMarco() {
  dejarAvisoSalida('salida');
  try {
    await salir();
  } catch (e) {
    dejarAvisoSalida(null);
    throw e;
  }
  return { tipo: 'salio' };
}
