// Variante nativa de la mensajería (WP4, sección 5.8): sin push. Exporta lo mismo que
// mensajeria.web.js, que Vite elige antes que este archivo en la web.
import { ErrorApp } from '../datos/errores.js';

const MOTIVO = 'Los avisos push no están disponibles en esta plataforma.';

export async function soportaPush() {
  return false;
}

export async function obtenerTokenPush() {
  throw new ErrorApp('no-soportado', MOTIVO);
}

export async function borrarTokenPush() {
  return null;
}

export function estadoPushLocal() {
  return { soportado: false, permiso: 'no-soportado', activo: false, token: null, motivo: MOTIVO };
}

export function guardarTokenLocal() {}
