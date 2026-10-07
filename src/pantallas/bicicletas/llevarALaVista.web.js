// Desplaza la pantalla hasta un elemento (en RNW, la ref de un View es su nodo del DOM).
// Lo usan "Ver en mapa" de Bicicletas y Alarmas: el mapa queda arriba de la lista.
export function llevarALaVista(ref) {
  const nodo = ref?.current;
  if (!nodo || typeof nodo.scrollIntoView !== 'function') return;
  const sinMovimiento = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  try {
    nodo.scrollIntoView({ behavior: sinMovimiento ? 'auto' : 'smooth', block: 'start' });
  } catch {
    nodo.scrollIntoView();
  }
}
