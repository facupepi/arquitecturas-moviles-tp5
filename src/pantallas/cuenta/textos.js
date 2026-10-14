// Textos de privacidad compartidos por Ingreso (versión breve) y Cuenta (versión completa), S1.
// Describen lo que de verdad hace la app: reglas por dueño (sección 3), sin correo ni coordenadas
// en Firestore, Analytics sin datos personales (5.5) y borrado total con vecino/baja (6.8).

export const PRIVACIDAD_BREVE = [
  {
    icono: 'usuario',
    titulo: 'Guardamos solo tus gestiones',
    texto: 'Tus reclamos, pagos, estacionamientos, tarjetas guardadas (solo los últimos 4 dígitos) y preferencias de avisos. Otros vecinos no los ven; el municipio, solo lo necesario para atenderlos.',
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
      'El nombre de tu cuenta de Google, tus preferencias de avisos, '
      + 'tus cedulones y pagos, tus reclamos con sus fotos o PDF, tus estacionamientos y tus notificaciones. '
      + 'De las tarjetas que guardás para pagar, solo el tipo, la red, los últimos 4 dígitos, el titular y el vencimiento. '
      + 'Si activás los avisos en un dispositivo, guardamos un código de ese navegador para poder enviarte notificaciones.',
  },
  {
    titulo: 'Qué no guardamos',
    texto:
      'Tu ubicación, que usamos solo en el momento. Para avisarte de alarmas cercanas registramos qué alarmas '
      + 'están cerca durante 30 minutos, nunca tus coordenadas. Tampoco guardamos tu correo en nuestra base, '
      + 'el número completo de tus tarjetas ni su código de seguridad, que solo usamos para validarlas.',
  },
  {
    titulo: 'Quién puede verlo',
    texto:
      'Ningún otro vecino. El personal municipal ve los reclamos para poder responderlos, y para controlar los cobros '
      + 've tus pagos (importe, comprobante, red y últimos 4 dígitos de la tarjeta), tus cedulones vencidos y tus '
      + 'estacionamientos (patente, zona y horario). En esas listas te identifica con un código corto, sin tu nombre ni tu correo. '
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
