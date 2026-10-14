# San Francisco Conecta

Aplicación móvil web de servicios municipales para la ciudad de San Francisco, Córdoba. Es el trabajo práctico 5 de Arquitecturas Móviles de la UTN Facultad Regional San Francisco.

Es un proyecto académico de la UTN FRSFCO, sin vínculo oficial con la Municipalidad de San Francisco. Los pagos pasan por una pasarela simulada, sin dinero real, y el panel municipal reemplaza a los sistemas del municipio. La app muestra la nota "Proyecto académico UTN FRSFCO" al pie de la pantalla de ingreso, en el pie institucional y al final del cedulón impreso.

La aplicación se publica en https://san-francisco-conecta-tp5.web.app.

## Qué ofrece

La aplicación reúne siete servicios en una sola pantalla de inicio.

| Servicio | Qué permite |
|---|---|
| Bicicletas públicas | Ver las estaciones en un mapa con su disponibilidad en vivo, ordenarlas por cercanía y reportar un problema |
| Tributos | Consultar los cedulones con su estado, abrir la boleta con el código de pago y pagarla eligiendo el medio de pago, con comprobante |
| Reclamos | Cargar un reclamo con hasta tres fotos o documentos, buscarlo y seguir su línea de tiempo |
| Atención al vecino | Llamar, escribir o abrir WhatsApp con cada área municipal |
| Alarmas comunitarias | Ver el estado de cada alarma, seguir zonas y recibir avisos de alarmas cercanas sin guardar la ubicación |
| Estacionamiento medido | Elegir una zona, pagar por bloques de 15 minutos, ver el temporizador, extender o terminar la sesión |
| Notificaciones | Consultar el historial de avisos de la ciudad y de los trámites propios, y elegir tipos, zonas y frecuencia |

El vecino entra con su cuenta de Google, la misma en el celular y en la computadora; no hay acceso como invitado. La aplicación se instala en la pantalla de inicio del teléfono y funciona sin conexión con los últimos datos.

Una cuenta de Google registrada como administradora accede además al panel municipal, que reemplaza a los sistemas del municipio para avanzar reclamos, seguir los pagos y la recaudación, controlar y finalizar los estacionamientos en curso (cada vecino tiene una sola sesión vigente a la vez), activar alarmas, cambiar la disponibilidad de bicicletas, publicar avisos y controlar la simulación.

## Arquitectura

La interfaz está escrita con React Native y se ejecuta en el navegador mediante React Native for Web, compilada con Vite. Todo el backend usa planes gratuitos.

**Firebase, plan Spark**

- Hosting sirve la aplicación desde su red de distribución. La raíz `/`, `index.html`, el service worker y el manifiesto se revalidan en cada visita, y los archivos de `assets/`, que llevan un hash en el nombre, se guardan un año. Como la app navega por hash, no hay reescrituras: una ruta o un archivo inexistente responde 404.
- Authentication administra las cuentas de Google, el único modo de ingreso desde la app.
- Firestore guarda el catálogo municipal y los datos de cada vecino, protegidos por reglas de seguridad que validan dueño, importes, estados y transiciones.
- App Check, Remote Config, Analytics, Performance Monitoring y Cloud Messaging completan el conjunto.

**Supabase, plan gratuito, solo para lo que exige un servidor**

- Cuatro Edge Functions (`vecino`, `adjuntos`, `despachar` y `tareas`) verifican el token de Firebase del usuario y escriben con una cuenta de servicio.
- Storage guarda los adjuntos de los reclamos en un bucket privado, con enlaces firmados de cinco minutos.
- `pg_cron` ejecuta las tareas programadas, que envían los recordatorios de vencimiento, los avisos de estacionamiento por vencer y el resumen diario.
- Las notificaciones push se envían por FCM desde `despachar`, que procesa una bandeja de eventos en Firestore y la reintenta si falla.

Supabase no tiene usuarios propios. La identidad es siempre la de Firebase Authentication, y el navegador no usa ninguna clave de Supabase.

**Carpetas principales**

| Carpeta | Contenido |
|---|---|
| `src/` | Pantallas, componentes, navegación, capa de datos y servicios de Firebase |
| `shared/` | Reglas del dominio sin dependencias de plataforma, usadas por la aplicación, las funciones y las pruebas |
| `supabase/` | Edge Functions, migraciones y configuración |
| `scripts/` | Emuladores, siembra de datos, control de React Native, presupuesto del paquete y capturas |
| `tests/` | Pruebas de unidad, de reglas, extremo a extremo, de humo y de carga |
| `firestore.rules`, `firestore.indexes.json`, `remoteconfig.template.json` | Configuración desplegable de Firebase |

## Requisitos

- Node.js 22.12 o posterior.
- Java 21 para el emulador de Firestore. En Windows, `scripts/emuladores.mjs` usa el JDK 21 de Eclipse Adoptium aunque haya otro JDK en el `PATH`, y la variable `JAVA_21_HOME` indica otra ubicación.
- Navegadores de Playwright, que se instalan con `npx playwright install chromium webkit firefox`.

Las dependencias se instalan con `npm install`. La CLI de Firebase y la de Supabase quedan incluidas como dependencias de desarrollo.

## Ejecución local con emuladores

Esta forma no necesita credenciales ni conexión con los proyectos reales.

```bash
npm run dev:emuladores
```

El comando levanta los emuladores de Authentication (puerto 9099) y Firestore (puerto 8085), siembra el catálogo, inicia `tests/e2e/edge-simulado.mjs` en el puerto 8787 en lugar de Supabase y abre Vite en http://127.0.0.1:5175. La interfaz de los emuladores queda en http://127.0.0.1:4005. Los datos se exportan a `.firebase/datos-emulador` al cerrar con Ctrl+C y se recuperan en el próximo arranque.

Para usar el panel municipal en local, se ingresa con "Continuar con Google" y una cuenta ficticia del emulador, se copia su uid desde la interfaz de los emuladores y se ejecuta, con los emuladores encendidos, el comando siguiente.

```bash
node scripts/sembrar.mjs --emulador --admin <uid>
```

Si un puerto queda ocupado por una ejecución anterior, `node scripts/emuladores.mjs --puertos` muestra qué proceso lo usa.

## Ejecución local contra los servicios reales

1. Copiar `.env.example` como `.env.local` y completar la configuración web de Firebase, la clave del sitio de reCAPTCHA y la clave VAPID. El archivo no se versiona.
2. Para desarrollar desde `localhost`, crear `.env.development.local` con `VITE_FIREBASE_AUTH_DOMAIN=san-francisco-conecta-tp5.firebaseapp.com`.
3. Ejecutar `npm run dev`.

En desarrollo, App Check necesita un token de depuración registrado en la consola de Firebase, que se carga en `VITE_APPCHECK_DEBUG_TOKEN` dentro de `.env.local`.

## Pruebas

| Nivel | Comando | Qué verifica |
|---|---|---|
| Dominio y React Native | `npm test` | Funciones de `shared/`, mapeadores, errores y que `src/` use solo componentes de React Native fuera de los archivos `.web.js` |
| Reglas de seguridad | `npm run test:reglas` | Las reglas de Firestore contra el emulador, con casos permitidos y rechazados por colección |
| Extremo a extremo | `npm run test:e2e` | Cada pantalla en Pixel 7 (Chromium) e iPhone 13 (WebKit) contra los emuladores, con revisión de accesibilidad de axe |
| Paquete | `npm run build` | Compila y falla si el JavaScript inicial supera 350 KB con gzip |
| Humo | `npm run test:humo` | La dirección publicada en celulares y navegadores de escritorio |
| Carga | `npm run test:carga` | El requisito de carga en menos de 3 segundos con red y procesador limitados |
| Todo lo local | `npm run test:todo` | Dominio, reglas, compilación y extremo a extremo en secuencia |

`npm run test:e2e` levanta por su cuenta emuladores separados de los de desarrollo (Authentication 9098, Firestore 8086), el servidor simulado de Supabase y Vite en el puerto 5176, y los apaga al terminar. Los resultados quedan en `docs/pruebas/e2e-junit.xml`.

La prueba de humo y la de carga solo miran lo público: no inician sesión ni crean cuentas en producción. La prueba de humo acepta el token de depuración de App Check en la variable `APPCHECK_TOKEN_HUMO`, que nunca se versiona.

En la última corrida, las pruebas de dominio dieron 100 de 100, las de reglas 152 de 152 y las de extremo a extremo 144 de 150 en la corrida completa (75 en Pixel 7 y 75 en iPhone 13). Las seis que fallaron son demoras del emulador en una máquina cargada, que también aparecen con la versión anterior del código y cambian de una corrida a otra: pasan al repetirlas, salvo la del pago en vivo del panel, que falló una de cuatro veces. El 14 de octubre de 2026, contra la dirección publicada, la prueba de humo dio 30 de 30 en los cinco navegadores.

La prueba de carga del 13 de octubre de 2026, contra la dirección publicada, midió siete repeticiones con red móvil lenta y procesador limitado. En la primera visita, el contenido quedó visible en 1,27 s de mediana y el ingreso utilizable en 2,88 s de mediana, con un peor caso de 3,13 s, 0,13 s por encima del límite de 3 segundos. En la visita repetida, con la app guardada por el service worker, el ingreso quedó utilizable en 1,95 s de mediana. El detalle está en `docs/pruebas/`.

**Capturas para el informe.** `npm run capturas` genera las pantallas a 390 por 844 píxeles con escala 2. Con el modo compartido de los emuladores encendido (`npm run e2e:compartido`), recorre la aplicación con una cuenta de Google ficticia del emulador y usa un administrador ficticio para el panel, en un proyecto propio que se vacía al terminar. Con `node scripts/capturas.mjs --url <dirección>` solo captura la pantalla de ingreso de la aplicación publicada, porque el script no abre sesiones en producción. Las capturas del informe se tomaron en la aplicación publicada con las cuentas de ejemplo, cuya sesión se abre con un token personalizado emitido con la cuenta de servicio (ver "Vecinos de ejemplo"). El modo compartido se apaga con `npm run e2e:compartido:apagar`.

## Cuentas administradoras

El panel municipal solo se muestra a una cuenta con un documento en la colección `administradores` de Firestore, y ninguna cuenta puede crearlo desde la aplicación. Las reglas y las Edge Functions solo aceptan sesiones iniciadas con Google (`sign_in_provider` `google.com`) y rechazan las anónimas, las de correo y contraseña y las de token personalizado, aunque tengan ese documento. La única excepción son las cuentas de ejemplo, cuyo uid empieza con `ejemplo-`: no tienen proveedor de ingreso y solo abren sesión con un token personalizado emitido con la cuenta de servicio (ver "Vecinos de ejemplo"). Entre ellas, `ejemplo-municipio` tiene su documento en `administradores` y abre el panel.

Una cuenta de Google real se habilita así:

1. Ingresar a la aplicación publicada con "Continuar con Google" usando la cuenta que se quiere habilitar.
2. En la consola de Firebase, abrir Authentication, ubicar esa cuenta por su correo y copiar el valor de la columna "UID de usuario".
3. En Firestore Database, crear la colección `administradores` si no existe y agregar un documento cuyo identificador sea ese uid.
4. Cargar en el documento el campo `nombre`, de tipo string, con el nombre que se quiera mostrar, y el campo `alta`, de tipo timestamp, con la fecha del día.
5. Recargar la aplicación. La pantalla Mi cuenta muestra "Abrir el panel municipal" y el menú suma el acceso al panel.

Para quitar el permiso, se borra el documento desde la misma consola. "Borrar mis datos" también lo borra, junto con el resto de los datos de la cuenta.

## Vecinos de ejemplo

`scripts/vecinos-ejemplo.mjs` carga cuatro vecinos ficticios con actividad, para que el panel municipal muestre movimiento desde el primer momento: tarjetas guardadas de crédito y débito, cedulones pagos e impagos, pagos con esas tarjetas, reclamos en cada estado, estacionamientos terminados y uno en curso, y notificaciones. También carga el administrador de ejemplo `ejemplo-municipio`, con su documento en `administradores` a nombre de "Municipio".

```bash
npm run ejemplos:produccion                                  # crea o reescribe los vecinos y el administrador de ejemplo
node scripts/vecinos-ejemplo.mjs --produccion --borrar       # los quita con todos sus datos
node scripts/vecinos-ejemplo.mjs --emulador                  # lo mismo contra los emuladores
```

Sus uid empiezan con `ejemplo-` y sus cuentas no tienen proveedor de ingreso, así que nadie puede entrar con ellas desde la app. La única forma de abrir una sesión con ellas es un token personalizado (`createCustomToken` de `firebase-admin`), que solo puede emitir quien tiene la cuenta de servicio del proyecto. Las reglas de Firestore y las Edge Functions admiten esa sesión solo para los uid que empiezan con `ejemplo-`, y cada cuenta accede solo a lo suyo; `ejemplo-municipio`, además, al panel municipal. Con esas sesiones se tomaron las capturas del informe en la aplicación publicada.

Un vecino que se registra arranca solo con sus cedulones, los recordatorios de vencimiento y la bienvenida. Para la demostración, los datos de ejemplo se pueden cargar en una cuenta de Google real, que primero tiene que haber entrado una vez a la app:

```bash
node scripts/vecinos-ejemplo.mjs --produccion --cuenta <uid>      # le carga tarjetas, pagos, reclamos, estacionamientos y notificaciones
node scripts/vecinos-ejemplo.mjs --produccion --reiniciar <uid>   # la deja como recién registrada
```

Las dos opciones conservan el perfil y el celular registrado para las notificaciones. Del perfil, `--cuenta` solo actualiza el nombre, con el de la cuenta de Google, y las zonas seguidas: los avisos push, la frecuencia y los tipos elegidos quedan como estaban.

Cada vez que el script reescribe o borra los datos de una cuenta, quita también los eventos de la bandeja con su uid, los bloqueos de patente de todas sus sesiones y los adjuntos de sus reclamos, que si no seguirían contando para el tope de 30 archivos por vecino. Con `--emulador` borra los archivos del servidor simulado. En producción, los adjuntos de Storage solo se borran si la variable `SUPABASE_SECRET_KEY` tiene la clave secreta del proyecto de Supabase (Project Settings, API Keys), que nunca se versiona. Sin ella, el script avisa y los archivos quedan en `adjuntos-reclamos/<uid>/`.

## Despliegue

Las credenciales no forman parte del repositorio. La cuenta de servicio de Firebase y los secretos de las funciones se guardan en una carpeta fuera del proyecto, y `.gitignore` excluye `.env.local`, los archivos de credenciales y `supabase/.secretos.env`.

**Preparación, una sola vez**

1. Iniciar sesión en las dos CLI con `npx firebase login` y `npx supabase login`, y vincular Supabase desde esta carpeta con `npx supabase link --project-ref qsxwsbdhlwyshqjfxaxw`.
2. En Authentication, habilitar solo el proveedor Google (el anónimo queda deshabilitado) y autorizar los dominios `san-francisco-conecta-tp5.web.app`, `san-francisco-conecta-tp5.firebaseapp.com`, `localhost` y `127.0.0.1`.
3. En Google Cloud, agregar `https://san-francisco-conecta-tp5.web.app/__/auth/handler` a los URI de redirección del cliente OAuth web. Sin este paso, el ingreso con Google falla cuando `VITE_FIREBASE_AUTH_DOMAIN` apunta a `web.app`.
4. Registrar App Check con reCAPTCHA v3, generar la clave VAPID de Cloud Messaging y copiar ambas en `.env.local`.
5. Cargar los secretos de Supabase desde un archivo fuera del repositorio con `npx supabase secrets set --env-file <ruta>`. Son `FIREBASE_PROJECT_ID`, `FIREBASE_PROJECT_NUMBER`, `FIREBASE_SERVICE_ACCOUNT_B64`, `CRON_SECRET`, `ORIGENES_PERMITIDOS`, `APPCHECK_MODO` y `ADJUNTOS_BUCKET`.
6. En el editor SQL de Supabase, crear en Vault los secretos `url_proyecto` y `secreto_cron` que usan las tareas programadas, como indica `supabase/migrations/20261007120200_programacion.sql`.
7. Sembrar el catálogo de producción con la cuenta de servicio, indicada por la variable `GOOGLE_APPLICATION_CREDENTIALS` con la ruta del archivo JSON fuera del repositorio.

```bash
npm run sembrar:produccion
```

La siembra crea solo lo que falta. Con `node scripts/sembrar.mjs --produccion --forzar` reescribe el catálogo y la configuración municipal.

**Publicación**

```bash
npm run deploy
```

El comando publica en orden las reglas y los índices de Firestore, la plantilla de Remote Config, el sitio compilado en Hosting, las migraciones de Supabase y las cuatro Edge Functions. Cada parte también se publica por separado con `npm run deploy:reglas`, `npm run deploy:remoteconfig`, `npm run deploy:hosting` y `npm run deploy:supabase`.

**Comprobación**

- `curl https://qsxwsbdhlwyshqjfxaxw.supabase.co/functions/v1/tareas` responde con `"ok":true`.
- La tabla `public.ejecuciones` de Supabase registra cada corrida de las tareas programadas con su resultado.
- `npm run test:humo` recorre la dirección publicada.

## Guía de la demostración en clase

La demostración usa dos dispositivos.

- **Teléfono A, el vecino.** Android con Chrome, la aplicación instalada y las notificaciones push activadas.
- **Computadora B, el municipio.** Conectada al proyector, con la sesión iniciada en una cuenta de Google administradora.

**Antes de la clase**

1. El día anterior, entrar al panel de Supabase para que el proyecto gratuito no quede en pausa por inactividad.
2. En B, abrir el panel municipal, pestaña Simulación, y tocar "Restablecer valores iniciales".
3. En la misma pestaña, elegir 14 minutos en "Aviso de estacionamiento por vencer" y apagar "Simulador automático".
4. Si la clase es fuera del horario de cobro, apagar "Cobro de estacionamiento solo en horario".
5. Grabar un video de respaldo de los pasos siguientes.

**Recorrido**

| Paso | Dónde | Acción | Qué se ve |
|---|---|---|---|
| 1 | A | Abrir la dirección publicada e instalar la aplicación desde Mi cuenta, "Instalar la app" | La pantalla de carga aparece al instante, y el ícono queda en la pantalla de inicio |
| 2 | A | Tocar "Continuar con Google" y elegir la cuenta | El inicio muestra los siete servicios sin desplazar, cada uno con un dato actual |
| 3 | A | Abrir Bicicletas y tocar "Usar mi ubicación" | El mapa marca las estaciones, la lista se ordena por cercanía con la distancia y "Reportar" abre el reclamo con la estación cargada |
| 4 | B | En el panel, pestaña Bicicletas, sumar bicicletas a la Estación Plaza General Paz | La tarjeta de esa estación cambia en A en menos de dos segundos, sin recargar |
| 5 | A | Abrir Tributos, ver el cedulón T-1001 y pagarlo | Ya figura la notificación de vencimiento, la boleta muestra el código de pago y el pago, con el medio elegido, entrega un comprobante y pasa a Pagados |
| 6 | A | En Reclamos, cargar uno con una foto y buscarlo por su código | El reclamo aparece como Recibido con su código y su adjunto |
| 7 | B | En la pestaña Reclamos, avanzar ese reclamo a En proceso con una nota | La línea de tiempo de A cambia sola, muestra la respuesta de la Municipalidad y llega la notificación push |
| 8 | A y B | En A, seguir la zona Parque y activar "Avisarme si se activa una alarma cerca". En B, pestaña Alarmas, activar la Alarma Parque Cincuentenario | A muestra el aviso en la aplicación y, con la aplicación cerrada, la notificación push, que al tocarla abre esa alarma en el mapa |
| 9 | A | Estacionar 15 minutos en la zona Municipalidad y esperar el aviso. En B no hace falta tocar nada: "Enviar recordatorios ahora" solo envía los de cedulones | El temporizador corre y, cerca de un minuto después, llega el aviso de sesión por vencer, que envía sola la tarea programada de cada minuto con el umbral de 14 minutos de la preparación. Luego se extiende 15 minutos y se termina la sesión |
| 10 | A | En Atención al vecino, tocar "Llamar al 147" y "WhatsApp" | Se abre el marcador del teléfono y una conversación de WhatsApp con el canal municipal |
| 11 | A y B | En Notificaciones, revisar el historial y cambiar la frecuencia a Resumen diario. En B, tocar "Enviar resumen ahora" | Cada notificación lleva a su servicio, y el resumen llega a los vecinos que eligieron esa frecuencia |
| 12 | A | En Mi cuenta, tocar "Borrar mis datos" | El borrado elimina del servidor la cuenta y todos sus datos, y vuelve a la pantalla de ingreso |

**Plan B sin internet en el aula**

1. Compartir los datos móviles del teléfono A con la computadora B y seguir el recorrido normal.
2. Si tampoco hay datos móviles, abrir la aplicación instalada en A, que muestra los últimos datos guardados sin conexión.
3. Para los pasos en vivo entre A y B, reproducir el video de respaldo.

## Seguridad y datos

- No se guarda el correo del vecino ni su ubicación. Para las alarmas cercanas, el teléfono registra solo los identificadores de las alarmas próximas durante treinta minutos.
- De cada tarjeta guardada, de crédito o de débito y hasta cinco por vecino, se guardan solo el tipo, la red, los últimos cuatro dígitos, el titular y el vencimiento. El número completo y el código de seguridad se validan al cargar la tarjeta y se descartan: no llegan a Firestore, y de la tarjeta usada cada pago guarda solo el tipo, la red y los últimos cuatro dígitos.
- Las reglas de Firestore y las Edge Functions solo aceptan sesiones de Google, salvo las de las cuentas de ejemplo (uid `ejemplo-…`), que solo se abren con un token personalizado emitido con la cuenta de servicio. Las reglas limitan cada documento a su dueño, validan importes, estados y transiciones, y exigen una de esas sesiones con documento en `administradores` para toda acción municipal.
- "Borrar mis datos" elimina el perfil, los cedulones, los pagos, las tarjetas guardadas, los reclamos con sus adjuntos, los estacionamientos, su bloqueo de sesión vigente y los bloqueos de patente de todas sus sesiones, las notificaciones y los avisos leídos, los celulares registrados para las notificaciones push, los eventos de la bandeja de salida con su uid, el documento de administrador si lo tenía y el usuario de Authentication.
- La configuración web de Firebase es pública por diseño, pero no se versiona. Las claves privadas y los secretos de Supabase nunca se incluyen en el repositorio.
