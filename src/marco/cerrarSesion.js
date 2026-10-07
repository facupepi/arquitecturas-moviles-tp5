// "Cerrar sesión" desde el marco (menú de cuenta y menú lateral), WP5.
// - Cuenta de Google: sesion.salir() (8.2).
// - Invitado: no puede volver a entrar a su cuenta anónima, así que no se cierra la sesión acá:
//   se abre Cuenta con ?salir=1 para que muestre el diálogo que ofrece vincular con Google o
//   borrar los datos y salir (dialogo-invitado-salir, S1).
import { salir } from '../datos/sesion';

export async function cerrarSesionDesdeMarco(usuario, navegar) {
  if (!usuario || usuario.anonimo) {
    navegar('cuenta', null, { salir: '1' });
    return { tipo: 'dialogo-invitado' };
  }
  await salir();
  return { tipo: 'salio' };
}
