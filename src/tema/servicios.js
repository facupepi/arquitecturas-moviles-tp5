// Servicios de la app (WP5, sección 7.1). Reproduce heredado:src/services.js con nombres en español.
// `icono` es un nombre de <Icono>; `fondo`, `acento` y `tinta` son los colores de cada servicio
// (tinta sobre fondo cumple contraste AA para texto).

export const SERVICIOS = [
  {
    ruta: 'bicicletas',
    nombre: 'Bicicletas públicas',
    corto: 'Bicicletas',
    descripcion: 'Encontrá una bici cerca tuyo.',
    icono: 'bicicleta',
    fondo: '#edf5e6',
    acento: '#6aa435',
    tinta: '#3c6520',
  },
  {
    ruta: 'tributos',
    nombre: 'Mis tributos',
    corto: 'Tributos',
    descripcion: 'Consultá y pagá tus cedulones.',
    icono: 'tributo',
    fondo: '#e0f2fc',
    acento: '#009ee2',
    tinta: '#006c9c',
  },
  {
    ruta: 'reclamos',
    nombre: 'Centro de reclamos',
    corto: 'Reclamos',
    descripcion: 'Contanos qué podemos mejorar.',
    icono: 'reclamo',
    fondo: '#fff1df',
    acento: '#f07e07',
    tinta: '#a84f00',
  },
  {
    ruta: 'contactos',
    nombre: 'Atención al vecino',
    corto: 'Atención',
    descripcion: 'Estamos para ayudarte.',
    icono: 'telefono',
    fondo: '#e0f2fc',
    acento: '#009ee2',
    tinta: '#006c9c',
  },
  {
    ruta: 'alarmas',
    nombre: 'Alarmas comunitarias',
    corto: 'Alarmas',
    descripcion: 'Conectados con tu barrio.',
    icono: 'alarma',
    fondo: '#fde6ea',
    acento: '#ce0e3c',
    tinta: '#a21937',
  },
  {
    ruta: 'estacionamiento',
    nombre: 'Estacionamiento',
    corto: 'Estacionamiento',
    descripcion: 'Gestioná tu tiempo en la ciudad.',
    icono: 'estacionamiento',
    fondo: '#e5eef7',
    acento: '#00538b',
    tinta: '#00538b',
  },
  {
    ruta: 'notificaciones',
    nombre: 'Notificaciones',
    corto: 'Notificaciones',
    descripcion: 'Lo que pasa, cuando importa.',
    icono: 'campana',
    fondo: '#fff6cd',
    acento: '#f4c000',
    tinta: '#7a5e00',
  },
];

export const INICIO = {
  ruta: 'inicio',
  nombre: 'Inicio',
  corto: 'Inicio',
  descripcion: 'Todos tus servicios en un lugar.',
  icono: 'inicio',
  fondo: '#e0f2fc',
  acento: '#009ee2',
  tinta: '#006c9c',
};

export const CUENTA = {
  ruta: 'cuenta',
  nombre: 'Mi cuenta',
  corto: 'Cuenta',
  descripcion: 'Tus datos, privacidad y sesión.',
  icono: 'usuario',
  fondo: '#eef2f6',
  acento: '#526174',
  tinta: '#1e2939',
};

export const PANEL = {
  ruta: 'panel',
  nombre: 'Panel municipal',
  corto: 'Panel',
  descripcion: 'Simulación de los sistemas municipales.',
  icono: 'panel',
  fondo: '#eef2f6',
  acento: '#526174',
  tinta: '#1e2939',
};

export const NAVEGACION = [INICIO, ...SERVICIOS, CUENTA];

const TODOS = [...NAVEGACION, PANEL];

/** Servicio (o entrada de navegación) de una ruta, o null. */
export function servicioPorRuta(ruta) {
  return TODOS.find((s) => s.ruta === ruta) ?? null;
}
