// Stub nativo de plataforma/red (la variante web es red.web.js).
export function estaEnLinea() {
  return true;
}

export function useConexion() {
  return { enLinea: true };
}

export function marcarListo() {}

export function pestanaOculta() {
  return false;
}
