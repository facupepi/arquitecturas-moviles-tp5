// En escritorio, el mapa queda a la vista mientras se recorre la lista de al lado (position: sticky
// dentro del ScrollView de la pantalla; es un valor de estilo que solo existe en la web).
import { espacio } from '../../tema/tokens';

export const estiloMapaFijo = { position: 'sticky', top: espacio.l, zIndex: 1 };
