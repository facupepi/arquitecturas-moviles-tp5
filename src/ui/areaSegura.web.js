// Márgenes del área segura en la web (WP5): con viewport-fit=cover, la PWA instalada en iPhone
// dibuja debajo del indicador de inicio. RNW pasa el valor tal cual a CSS.
export const rellenoInferiorSeguro = 'env(safe-area-inset-bottom, 0px)';
export const rellenoSuperiorSeguro = 'env(safe-area-inset-top, 0px)';
