// Doble de src/plataforma/ubicacion: el test emite posiciones o errores.
export const control = { alCambiar: null, alFallar: null, detenido: 0 };
export function seguirUbicacion(alCambiar, alFallar) {
  control.alCambiar = alCambiar; control.alFallar = alFallar;
  return () => { control.detenido += 1; control.alCambiar = null; };
}
export async function ubicar() { return { lat: 0, lng: 0 }; }
