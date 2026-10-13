// Nota académica (WP5, 7.4). Ya no hay franja en cada pantalla: el texto se muestra solo en el pie
// institucional, en la pantalla de ingreso y en el cedulón. Sale de Remote Config
// (leyenda_prototipo) con su respaldo: si llega vacío o con menos de 20 caracteres se usa el valor
// por defecto.
import { useConfigRemota } from '../firebase/configRemota';

export const LEYENDA_POR_DEFECTO = 'Proyecto académico UTN FRSFCO';

/** Texto vigente de la nota (con respaldo). */
export function useTextoLeyenda() {
  let texto = null;
  try {
    texto = useConfigRemota()?.leyendaPrototipo;
  } catch {
    texto = null;
  }
  return typeof texto === 'string' && texto.trim().length >= 20 ? texto.trim() : LEYENDA_POR_DEFECTO;
}
