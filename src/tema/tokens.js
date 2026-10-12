// Tokens de diseño (WP5, sección 7.1). Colores tomados del CSS heredado y de public/brand/README.md.
// Todo componente toma de acá colores, tipografía, espacios y medidas: no hay valores sueltos.

export const colores = {
  municipal: '#009ee2', accion: '#0077ae', accionOscuro: '#005c88', celesteClaro: '#e0f2fc',
  texto: '#1e2939', textoSuave: '#526174', fondo: '#f4f7fa', superficie: '#ffffff',
  borde: '#dce4eb', bordeCampo: '#b7c8d6', foco: '#0077ae', blanco: '#ffffff',
  exito: '#3c6520', exitoFondo: '#edf5e6', exitoAcento: '#6aa435',
  alerta: '#a84f00', alertaFondo: '#fff1df', alertaAcento: '#f07e07',
  peligro: '#a21937', peligroFondo: '#fde6ea', peligroAcento: '#ce0e3c',
  aviso: '#7a5e00', avisoFondo: '#fff6cd', avisoAcento: '#f4c000',
  info: '#006c9c', infoFondo: '#e0f2fc',
  pie: '#102b3d', pieTexto: '#dce7f0',
};

export const tipografia = {
  familia: 'Quicksand, system-ui, Arial, sans-serif',
  titulo1: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  titulo2: { fontSize: 22, lineHeight: 30, fontWeight: '700' },
  titulo3: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  cuerpo: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  chico: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  antetitulo: { fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  numero: { fontSize: 32, lineHeight: 38, fontWeight: '700', fontVariant: ['tabular-nums'] },
};

export const espacio = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };
export const radios = { chico: 10, medio: 12, grande: 18, pildora: 999 };
export const sombras = {
  // boxShadow (RN 0.76+ y RNW 0.21): las props shadow* están en desuso en RNW y avisan por consola.
  tarjeta: { boxShadow: '0px 2px 10px rgba(30, 41, 57, 0.06)' },
  flotante: { boxShadow: '0px 6px 24px rgba(16, 43, 61, 0.22)' },
  barra: { boxShadow: '0px 2px 10px rgba(30, 41, 57, 0.12)' },
};
export const medidas = { toqueMinimo: 48, anchoMaximo: 1440, margenLateral: 16, anchoMenu: 260 };
export const cortes = { tableta: 600, escritorio: 900 }; // useWindowDimensions().width

// Colores de los puntos del mapa (como heredado:MapView.jsx:37-43).
export const coloresMapa = {
  normal: colores.accion,
  seleccionado: colores.alertaAcento,
  activo: colores.peligro,
  alerta: colores.alerta,
  neutro: colores.textoSuave,
  ubicacion: '#3264da',
};
