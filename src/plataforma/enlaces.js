// Apertura de enlaces externos (WP5, sección 7.2). Un solo archivo, React Native puro.
//
// En RNW 0.21, Linking.openURL(url) con un solo argumento abre '_blank' con 'noopener'; para
// mailto: y sms: eso deja una pestaña en blanco, así que esos esquemas (y tel:) van con '_self'.
// React Native nativo ignora el segundo argumento.
import { Linking } from 'react-native';

const ESQUEMAS_PROPIOS = /^(tel|mailto|sms):/i;
const ESQUEMAS_WEB = /^https?:\/\//i;

/** true si el enlace se puede abrir con abrirEnlace (evita javascript:, data:, etc.). */
export function esEnlaceValido(url) {
  return typeof url === 'string' && (ESQUEMAS_PROPIOS.test(url) || ESQUEMAS_WEB.test(url));
}

/**
 * Abre un enlace externo: tel:, mailto: y sms: en la misma ventana (la app del sistema toma el
 * control) y https: en otra pestaña. Devuelve la promesa de Linking.openURL.
 */
export function abrirEnlace(url) {
  if (!esEnlaceValido(url)) return Promise.reject(new Error(`Enlace no admitido: ${url}`));
  if (ESQUEMAS_PROPIOS.test(url)) return Linking.openURL(url, '_self');
  return Linking.openURL(url);
}
