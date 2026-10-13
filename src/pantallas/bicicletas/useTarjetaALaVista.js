// Tarjetas de una lista que acompaña a un mapa (Bicicletas, Alarmas, zonas de Estacionamiento).
// Cuando el vecino elige un punto en el mapa, su tarjeta entra a la vista en la lista: en escritorio
// la lista de al lado se desplaza hasta ella y en el celular la pantalla baja hasta ella.
//   const tarjetas = useTarjetaALaVista();
//   <TarjetaX refContenedor={tarjetas.registrar(id)} />      (o ref={…} en el nodo de la tarjeta)
//   <Mapa onSeleccionar={(id) => { setSeleccionado(id); tarjetas.pedir(id); }} />
// El desplazamiento espera a que la lista se acomode: así ya se ve el borde de "elegida" y, si la
// tarjeta estaba oculta por un filtro que se acaba de limpiar, ya existe.
import { useCallback, useEffect, useRef, useState } from 'react';
import { espacio } from '../../tema/tokens';
import { llevarALaVista } from './llevarALaVista';

const ESPERA_MS = 120;

export function useTarjetaALaVista() {
  const refs = useRef({});
  const [pedido, setPedido] = useState(null);

  useEffect(() => {
    if (!pedido) return undefined;
    // Un instante después: elegir puede cambiar la dirección (Estacionamiento) y volver a dibujar la
    // lista con otro alto (la tarjeta elegida suma borde, aparece un aviso); se mide ya acomodada.
    const t = setTimeout(() => {
      const nodo = refs.current[pedido.id];
      if (nodo) llevarALaVista({ current: nodo }, { bloque: 'nearest', margen: espacio.l });
    }, ESPERA_MS);
    return () => clearTimeout(t);
  }, [pedido]);

  // Cada pedido es nuevo (aunque sea el mismo punto): si el vecino se alejó, la vuelve a traer.
  const pedir = useCallback((id) => setPedido((previo) => ({ id, vez: (previo?.vez ?? 0) + 1 })), []);
  const registrar = useCallback((id) => (nodo) => {
    if (nodo) refs.current[id] = nodo;
    else delete refs.current[id];
  }, []);

  return { refs, pedir, registrar };
}
