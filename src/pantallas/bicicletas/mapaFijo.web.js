// En escritorio, el mapa queda a la vista mientras se recorre la lista de al lado: position: sticky
// (un valor de estilo que solo existe en la web) dentro del ScrollView de la pantalla, que es el
// contenedor que se desplaza; el encabezado de la app queda afuera, así que alcanza con un margen.
import { espacio } from '../../tema/tokens';

export const estiloMapaFijo = { position: 'sticky', top: espacio.l, zIndex: 1 };
