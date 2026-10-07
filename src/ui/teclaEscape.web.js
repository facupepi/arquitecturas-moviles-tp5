// Escape para los Modal de src/ui (WP5). El Modal de RNW 0.21 registra su escucha de Escape en un
// efecto que corre recién después del render que lo marca activo: un Escape apretado justo al
// abrir se pierde (en WebKit pasa seguido). Esta escucha se registra al montar el Modal y solo
// avisa al de más arriba, así un diálogo encima de otro no cierra los dos.

const pila = [];
let escuchando = false;

function alSoltar(evento) {
  if (evento.key !== 'Escape' && evento.key !== 'Esc') return;
  const tope = pila[pila.length - 1];
  tope?.cb();
}

/** Registra cb para Escape mientras el Modal está abierto. Devuelve la función para quitarlo. */
export function escucharEscape(cb) {
  const entrada = { cb };
  pila.push(entrada);
  if (!escuchando) {
    document.addEventListener('keyup', alSoltar);
    escuchando = true;
  }
  return () => {
    const i = pila.indexOf(entrada);
    if (i !== -1) pila.splice(i, 1);
  };
}
