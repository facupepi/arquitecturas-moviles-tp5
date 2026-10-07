// Textos de privacidad compartidos por Ingreso (versión breve) y Cuenta (versión completa), S1.
// Describen lo que de verdad hace la app: reglas por dueño (sección 3), sin correo ni coordenadas
// en Firestore, Analytics sin datos personales (5.5) y borrado total con vecino/baja (6.8).

export const PRIVACIDAD_BREVE = [
  {
    icono: 'usuario',
    titulo: 'Guardamos solo tus gestiones',
    texto: 'Tus reclamos, pagos simulados, estacionamientos y preferencias de avisos. Solo vos podés verlos.',
  },
  {
    icono: 'ubicacion',
    titulo: 'Tu ubicación nunca se guarda',
    texto: 'La usamos en el momento para ordenar estaciones o avisarte de alarmas cercanas.',
  },
  {
    icono: 'info',
    titulo: 'Estadísticas anónimas',
    texto: 'Medimos el uso de la app sin tu nombre, tu patente ni tu dirección.',
  },
  {
    icono: 'check',
    titulo: 'Podés borrar todo cuando quieras',
    texto: 'Desde Mi cuenta, en un toque. Es tu derecho según la Ley 25.326 de Protección de Datos Personales.',
  },
];

export const PRIVACIDAD_COMPLETA = [
  {
    titulo: 'Qué guardamos',
    texto:
      'El nombre de tu cuenta, el tipo de cuenta (invitado o Google), tus preferencias de avisos, '
      + 'tus cedulones y pagos simulados, tus reclamos con sus fotos o PDF, tus estacionamientos y tus notificaciones. '
      + 'Si activás los avisos en un dispositivo, guardamos un código de ese navegador para poder enviarte notificaciones.',
  },
  {
    titulo: 'Qué no guardamos',
    texto:
      'Tu ubicación: la usamos solo en el momento. Para avisarte de alarmas cercanas registramos qué alarmas '
      + 'están cerca durante 30 minutos, nunca tus coordenadas. Tampoco guardamos tu correo en nuestra base '
      + 'ni datos de tarjetas: los pagos son simulados.',
  },
  {
    titulo: 'Quién puede verlo',
    texto:
      'Solo vos. El personal municipal de la demostración ve los reclamos para poder responderlos. '
      + 'La patente de un estacionamiento activo queda bloqueada sin tu identidad, para que nadie más la use al mismo tiempo.',
  },
  {
    titulo: 'Estadísticas',
    texto:
      'Usamos Google Analytics y Performance Monitoring para saber qué pantallas se usan y qué tan rápido cargan. '
      + 'Los eventos no llevan tu nombre, tu patente ni tu dirección.',
  },
  {
    titulo: 'Tus derechos',
    texto:
      'Según la Ley 25.326 de Protección de Datos Personales podés acceder a tus datos, corregirlos y pedir que se borren. '
      + 'Con "Borrar mis datos" eliminamos al instante todo lo tuyo, incluidos los archivos adjuntos y tu usuario.',
  },
];

export const LEY = 'Ley 25.326 de Protección de Datos Personales';
