// Instalación de la PWA (S1, sección 8.2). Stub nativo: una app nativa ya está instalada por la
// tienda, así que no hay nada que ofrecer. La web usa instalacion.web.js.

export async function instalar() {
  return 'no-disponible';
}

const ESTADO = Object.freeze({ disponible: false, esIOS: false, instalada: true });

/** { disponible, esIOS, instalada, instalar } */
export function useInstalacion() {
  return { ...ESTADO, instalar };
}
