// Lleva la vista hasta una sección de la pantalla y le pasa el foco (S7, variante web).
// En RNW la ref de un View es su nodo del DOM, así que alcanza con scrollIntoView.
export function desplazarHasta(ref, refFoco) {
  const nodo = ref?.current;
  if (!nodo || typeof nodo.scrollIntoView !== 'function') return;
  const sinMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  nodo.scrollIntoView({ behavior: sinMovimiento ? 'auto' : 'smooth', block: 'start' });
  try {
    (refFoco?.current ?? nodo).focus?.({ preventScroll: true });
  } catch {
    // Sin foco programático: alcanza con el desplazamiento.
  }
}
