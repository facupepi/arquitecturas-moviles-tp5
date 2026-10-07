// Título del documento por pantalla (WP5, 7.3). fijarTitulo es el único lugar que toca document.title.
import { useEffect } from 'react';
import { fijarTitulo } from '../plataforma/hash';

export const NOMBRE_APP = 'San Francisco Conecta';

export function useTituloDocumento(titulo) {
  useEffect(() => {
    fijarTitulo(titulo ? `${titulo} · ${NOMBRE_APP}` : NOMBRE_APP);
  }, [titulo]);
}
