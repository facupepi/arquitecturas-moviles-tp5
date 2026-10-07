// Stub nativo de plataforma/cedulon (S4; la variante web es cedulon.web.js). En un teléfono sin
// navegador no hay diálogo de impresión: se comparte el cedulón como texto con la hoja de compartir
// del sistema (Share de react-native), desde donde se puede guardar o enviar.
import { Share } from 'react-native';
import { ErrorApp } from '../datos/errores';

export function imprimirCedulon(tributo, info = {}) {
  const lineas = [
    info.titulo ?? `Cedulón ${tributo?.id ?? ''}`,
    info.leyenda,
    ...(info.filas ?? []).map(([etiqueta, valor]) => `${etiqueta}: ${valor}`),
    info.importe ? `Importe: ${info.importe}` : null,
    info.codigo ? `Código de pago: ${info.codigoAgrupado ?? info.codigo}` : null,
    info.aviso,
  ].filter(Boolean);
  return Share.share({ title: info.titulo, message: lineas.join('\n') })
    .then(() => ({ modo: 'compartir' }))
    .catch((e) => {
      throw new ErrorApp('no-soportado', 'Este dispositivo no permite compartir el cedulón.', { causa: e });
    });
}
