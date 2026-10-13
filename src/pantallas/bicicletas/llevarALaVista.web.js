// Desplaza la pantalla hasta un elemento (en RNW, la ref de un View es su nodo del DOM).
// - "Ver en mapa" de Bicicletas y Alarmas (celular): el mapa queda arriba de la lista.
// - Un punto elegido en el mapa: su tarjeta entra a la vista (bloque 'nearest': solo se mueve lo
//   justo, y nada si ya se ve), con un margen para que no quede pegada al borde.
// Con "reducir movimiento" el salto es directo, sin animación.
export function llevarALaVista(ref, { bloque = 'start', margen = 0 } = {}) {
  const nodo = ref?.current;
  if (!nodo || typeof nodo.scrollIntoView !== 'function') return;
  const sinMovimiento = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (margen && nodo.style) {
    nodo.style.scrollMarginTop = `${margen}px`;
    nodo.style.scrollMarginBottom = `${margen}px`;
  }
  try {
    nodo.scrollIntoView({ behavior: sinMovimiento ? 'auto' : 'smooth', block: bloque, inline: 'nearest' });
  } catch {
    nodo.scrollIntoView();
  }
}
