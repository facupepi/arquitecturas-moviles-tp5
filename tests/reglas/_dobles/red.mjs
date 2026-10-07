// Doble de src/plataforma/red.
export const estado = { enLinea: true, oculta: false, listo: false };
export const estaEnLinea = () => estado.enLinea;
export const useConexion = () => ({ enLinea: estado.enLinea });
export const marcarListo = () => { estado.listo = true; };
export const pestanaOculta = () => estado.oculta;
