// Devolución del foco al cerrar un Modal (WP5). RNW ya lo intenta, pero en WebKit a veces el foco
// termina en <body>. Esto guarda el elemento enfocado antes de abrir y lo vuelve a enfocar después
// de cerrar, solo si nadie más tomó el foco (por ejemplo, el título tras una navegación).

/** Guarda el elemento enfocado ahora y devuelve la función que lo vuelve a enfocar. */
export function recordarFoco() {
  const elemento = document.activeElement;
  return function devolverFoco() {
    setTimeout(() => {
      if (!elemento || elemento === document.body || !document.contains(elemento)) return;
      const actual = document.activeElement;
      if (actual && actual !== document.body && actual !== document.documentElement) return;
      try {
        elemento.focus({ preventScroll: true });
      } catch {
        // Elemento que ya no admite foco.
      }
    }, 0);
  };
}
