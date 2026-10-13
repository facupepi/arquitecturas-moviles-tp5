# Demostración en tiempo real sobre la versión publicada

Registro de la demostración realizada el 12 de octubre de 2026, entre las 20:31 y las 20:43 (hora de Córdoba), sobre https://san-francisco-conecta-tp5.web.app en su versión final (commit 8f39e0a). No se modificó el código de la aplicación ni se desplegó nada.

## Entorno

| Elemento | Detalle |
|---|---|
| Navegador | Chromium sin interfaz gráfica de Playwright 1.56.1, en Windows 11 |
| Administrador | Facundo Pepino, contexto de 1440 × 900 en el panel municipal |
| Vecina | Lucía Fernández (cuenta de prueba), contexto táctil de 390 × 844 con escala 2 |
| Inicio de sesión | Tokens personalizados emitidos por el orquestador y canjeados en el navegador, sin credenciales de servidor |
| Interacción | Todas las acciones se hicieron desde la interfaz, igual que lo haría una persona |

Los dos contextos estuvieron abiertos a la vez durante cada tramo. El entorno de ejecución no permitió dejar un proceso de control abierto entre tramos, por lo que el recorrido se dividió en cuatro tramos (preparación, demostración, capturas y restauración) y en cada uno se volvieron a canjear los tokens dentro de su período de validez.

## Recorrido

### Preparación de la vecina

1. El alta terminó sola al primer ingreso. La cuenta quedó con cuatro cedulones y seis notificaciones iniciales.
2. En Alarmas se agregó la zona Norte a las zonas seguidas (Centro y Parque venían por defecto).
3. Se creó el reclamo R-D44AFF (bacheo, Bv. 25 de Mayo 1850) con una foto PNG de 201 KB. La aplicación la guardó como «bache-bv-25-de-mayo.jpg» de 41 KB, porque recomprime las imágenes antes de subirlas.
4. Se crearon tres reclamos más sin adjunto (R-5C2A23, R-76BCF0 y R-77B728) para disponer de al menos cinco avances medibles.
5. Se pagó el cedulón T-1002 (Contribución sobre inmuebles 10/2026, $ 24.750). El comprobante fue REC-CE24FF80.
6. Se inició un estacionamiento de 90 minutos en la zona Municipalidad con la patente AE482KD ($ 1.200).

El estacionamiento se pudo iniciar a las 20:32 aunque la zona cobra de 8 a 20 h, porque la configuración municipal publicada tiene el horario estricto desactivado. No hizo falta tocar esa opción.

### Demostración en tiempo real

Desde el panel se repitieron cuatro tipos de cambio mientras la vecina tenía abierta la pantalla correspondiente.

| Cambio desde el panel | Pantalla de la vecina | Elemento observado |
|---|---|---|
| Activar y desactivar la Alarma UTN (a4, zona Norte) | Alarmas | Estado de la alarma |
| Avanzar un reclamo de la vecina | Reclamos | Estado del reclamo en la lista |
| Sumar y quitar una bicicleta en la estación Plaza Bouchard (b7) | Bicicletas | Cantidad de bicicletas de la estación |
| Publicar un aviso de obras para la zona Norte, vigente 2 horas | Notificaciones | Título del aviso en el historial |

### Método de medición

Antes de cada acción se instaló en la página de la vecina un observador de cambios del DOM que registra el instante en que el elemento observado muestra el valor esperado. El tiempo inicial es el instante inmediatamente anterior al toque del administrador sobre el control que confirma el cambio. Ambos navegadores corrían en la misma máquina, con el mismo reloj. La demora medida incluye la escritura del panel, la propagación por Firestore y el renderizado en el celular de la vecina.

## Mediciones

| Tipo de cambio | Repeticiones | Mediana | Máximo | Mínimo |
|---|---|---|---|---|
| Alarma (activar o desactivar) | 10 | 199 ms | 755 ms | 173 ms |
| Avance de reclamo | 7 | 230 ms | 298 ms | 197 ms |
| Disponibilidad de estación | 10 | 243 ms | 609 ms | 208 ms |
| Aviso de obras | 5 | 225 ms | 252 ms | 224 ms |

Ninguna repetición se perdió y todas quedaron muy por debajo del objetivo de 2 segundos de la especificación.

Valores individuales, en milisegundos y en orden de ejecución.

- Alarma. Activar 755, desactivar 173, activar 209, desactivar 185, activar 198, desactivar 173, activar 199, desactivar 176, activar 227 y desactivar 499 (esta última durante la restauración).
- Reclamo. R-D44AFF a En proceso 298, R-5C2A23 a En proceso 237 y a Resuelto 228, R-76BCF0 a En proceso 230 y a Resuelto 197, R-77B728 a En proceso 234 y a Resuelto 207.
- Estación. Diez cambios alternados entre 1 y 2 bicicletas, con 558, 250, 251, 208, 223, 229, 257, 236, 221 y 609.
- Aviso. Avisos «Prueba de demo» 1 a 5, con 225, 224, 243, 224 y 252.

Los valores altos aparecen en el primer cambio de cada serie y en el último de la estación. Corresponden a la primera escritura de la sesión y a esperas puntuales de red, y aun así no superan los 0,8 segundos.

## Capturas del informe

Se generaron 17 capturas de 780 × 1688 píxeles (390 × 844 con escala 2) en la carpeta `informe/capturas` del espacio de trabajo. Las versiones anteriores se conservaron en `informe/capturas-previas`.

| Archivo | Contenido |
|---|---|
| inicio | Inicio de la vecina con la alarma activada y el estacionamiento en curso |
| ingreso | Pantalla de Ingreso en un contexto nuevo sin sesión |
| bicicletas-mapa | Mapa de estaciones con las teselas cargadas |
| bicicletas-detalle | Lista de estaciones con la tarjeta elegida resaltada |
| tributos-lista | Total pendiente y cedulones |
| tributos-cedulon | Cedulón T-1001 con código de barras |
| reclamos-formulario | Formulario de nuevo reclamo vacío |
| reclamos-seguimiento | R-D44AFF en proceso, con la respuesta municipal y la foto adjunta |
| contactos | Atención al vecino |
| alarmas-mapa | Alarma UTN activada, con el mapa desplazado para que el marcador no quede bajo los controles |
| alarmas-zonas | Zonas seguidas (Centro, Parque y Norte) |
| estacionamiento-zonas | Mapa y selector de zonas |
| estacionamiento-temporizador | Sesión activa con el tiempo restante |
| notificaciones-historial | Historial con un recordatorio de tributos, la bienvenida y avisos de obras y eventos |
| notificaciones-preferencias | Sección «Qué querés recibir» |
| panel-municipal | Panel del administrador en la pestaña Reclamos |
| instalacion | Sección «Instalar la app» de Cuenta |

Todas se revisaron como imagen. Se repitieron bicicletas-detalle (el título quedaba cortado), reclamos-formulario (un botón quedaba resaltado por el puntero), reclamos-seguimiento (no se veían el progreso y el adjunto), alarmas-mapa, notificaciones-historial (el comienzo mostraba solo los cinco avisos de prueba), notificaciones-preferencias e instalacion. Ninguna tiene avisos flotantes ni diálogos superpuestos, salvo tributos-cedulon, cuyo contenido es el propio diálogo.

## Restauración

| Cambio | Estado final |
|---|---|
| Alarma UTN | Desactivada desde el panel. Las cinco alarmas quedaron desactivadas |
| Estación Plaza Bouchard | Al terminar la demostración tenía 1 bicicleta, igual que al principio. Al momento de restaurar el panel mostraba otro valor y se devolvió a 1 con un toque. Quedó operativa |
| Avisos de prueba | El panel no ofrece archivar ni eliminar avisos, y el diálogo de publicación advierte que no se puede deshacer. Los cinco avisos se publicaron con vigencia de 2 horas y vencen alrededor de las 22:36 |
| Configuración municipal | Sin cambios. Horario estricto desactivado y simulador encendido, tal como estaban. No se usó «Restablecer» |

Por último la vecina usó «Borrar mis datos» desde Cuenta. Antes del borrado la pantalla mostraba 4 cedulones, 3 pagos, 5 reclamos y 17 notificaciones personales. Al confirmar, la aplicación volvió a la pantalla de Ingreso con el mensaje «Borramos tus datos» en unos 5 segundos, y los cuatro reclamos de la vecina desaparecieron del panel municipal.

## Consola de los navegadores

Se registraron los mensajes de error y advertencia y las solicitudes fallidas de ambos contextos durante todo el recorrido.

| Origen | Mensaje | Apariciones | Efecto observado |
|---|---|---|---|
| App Check | 403 en `exchangeRecaptchaV3Token`, seguido de «appCheck/initial-throttle» y luego «appCheck/throttled» por 24 horas | 17 respuestas 403 y más de 100 advertencias derivadas | Ninguno visible. Auth, Firestore y las funciones de Supabase respondieron con normalidad |
| reCAPTCHA | «requestStorageAccess: Permission denied» y cancelación de `recaptcha/api2/clr` | 17 y 17 | Ninguno visible |
| Firebase Auth | «Error while retrieving App Check token» | 9 | Ninguno visible |
| Política de seguridad de contenido | Bloqueo de una imagen de `googletagmanager.com` en el panel | 1 | Se pierde una señal de Analytics |
| Analytics | Solicitudes a `google-analytics.com/g/collect` canceladas al navegar y una consulta a `webConfig` cancelada | 35 y 1 | Ninguno visible |
| Chromium | Aviso de WebGL por software | 17 | Propio del navegador sin interfaz |

No hubo errores de Firestore ni de Supabase. La foto se subió y se mostró, el pago, el estacionamiento, los cambios del panel y el borrado de la cuenta se completaron, y el contexto sin sesión de la captura de Ingreso no registró errores.

## Problemas encontrados

1. App Check rechaza con 403 el intercambio de reCAPTCHA v3 en este navegador y el SDK deja de intentarlo durante 24 horas. Como los servicios siguieron respondiendo, App Check no está aplicado en ellos. La causa más probable es que reCAPTCHA no valida un Chromium automatizado, aunque desde aquí no se puede descartar un problema de clave o de dominios registrados. Conviene revisarlo desde un navegador común antes de activar la aplicación obligatoria.
2. El panel municipal no permite archivar ni eliminar avisos. Los cinco avisos de prueba siguen en la lista del panel hasta que venza su vigencia.
3. El simulador municipal está encendido en producción, por lo que la disponibilidad de las estaciones puede cambiar sola. Eso impide garantizar que el valor restaurado de la estación b7 se mantenga.
4. El horario estricto está desactivado en producción, de modo que se puede iniciar un estacionamiento fuera del horario de cobro de la zona.
5. En el modo sin interfaz clásico de Chromium, `Notification.permission` vale `denied` aunque Playwright conceda el permiso, y las pantallas de Alarmas y de Preferencias informan «Bloqueaste las notificaciones». Es un efecto del entorno de prueba: esas dos capturas se rehicieron con el modo sin interfaz nuevo (`channel: "chromium"`), que respeta el permiso.
6. La política de seguridad de contenido bloqueaba una imagen de `googletagmanager.com`. Se agregó ese dominio a `img-src` en `firebase.json`.

## Notificación push con la aplicación cerrada

Prueba hecha el 12 de octubre de 2026 a las 22:33 (hora de Córdoba) contra la versión publicada, con una cuenta de prueba que se borró al terminar.

| Paso | Detalle |
|---|---|
| Navegador del vecino | Google Chrome 142 instalado en la PC, sin interfaz y con un perfil temporal propio. El modo incógnito no admite la Push API, por eso el perfil es persistente |
| Activación | Preferencias, «Avisos en este dispositivo». La suscripción quedó en `fcm.googleapis.com` y el dispositivo se registró en Firestore |
| Aplicación cerrada | Se cerraron todas las pestañas. Solo quedó el service worker |
| Disparo | Desde el panel municipal, con la cuenta administradora, se avanzó el reclamo R-0E579C a Resuelto con una nota |
| Resultado | El service worker mostró «Tu reclamo R-0E579C pasó a Resuelto», con la nota en el cuerpo y el identificador del evento como etiqueta, **2,4 segundos** después del toque en el panel |

Chrome sin interfaz no conserva las notificaciones mostradas, así que la llamada a `showNotification` se registró desde el propio service worker. En un intento anterior, el avance a En proceso, el evento quedó «enviado» con un destinatario 1,5 segundos después del toque.
