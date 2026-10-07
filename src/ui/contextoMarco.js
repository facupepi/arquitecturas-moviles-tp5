// Lo que el marco (src/marco/Marco.jsx) le pasa a cada <Pantalla> (WP5).
// `pie`: el pie institucional, que va al final del contenido desplazable de la pantalla.
import { createContext } from 'react';

export const ContextoMarco = createContext({ pie: null });
