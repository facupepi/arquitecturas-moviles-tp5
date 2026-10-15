# Guía del código

Para quien llega al proyecto por primera vez, sea una persona o un agente. Explica dónde está cada
cosa, cómo se conectan las partes y qué trampas ya se pisaron. Qué ofrece la aplicación y cómo
ejecutarla está en el [README](../README.md). Aquí no se repite.

## 1. Cómo leer los comentarios del código

Los comentarios están en español y citan tres tipos de referencias.

| Referencia | Significado |
|---|---|
| `B1` a `B4`, `T1` a `T4`, `R1` a `R4`, `C1` a `C3`, `A1` a `A4`, `E1` a `E4`, `N1` a `N3` | Los 26 requisitos funcionales de la consigna, uno por letra de servicio (bicicletas, tributaria, reclamos, contactos, alarmas, estacionamiento, notificaciones) |
| `WP1` a `WP6`, `WI`, `S*` | Paquetes en que se repartió la construcción original: base del proyecto, dominio compartido, datos y reglas, servicios de Firebase y PWA, interfaz base, Supabase. `WI` fue la integración final y `S*` las pantallas. Hoy no tienen otro significado |
| `sección N.N` | Apartado de [ARQUITECTURA.md](ARQUITECTURA.md), la especificación inicial. Explica por qué se diseñó así cada parte |

Cuando la especificación y el código difieren, manda el código. La sección 11 de esta guía lista las
diferencias conocidas.

## 2. Mapa de carpetas

| Carpeta | Qué contiene |
|---|---|
| `src/pantallas/` | Una pantalla por servicio (`Inicio`, `Bicicletas`, `Tributos`, `Reclamos`, `Contactos`, `Alarmas`, `Estacionamiento`, `Notificaciones`), más `Ingreso`, `Cuenta` y `PanelMunicipal`. Las piezas de cada una están en subcarpetas del mismo nombre, y `pagos/` es la pasarela simulada y sus tarjetas. `_Galeria.jsx` es una galería de componentes solo para desarrollo (`#/galeria`) |
| `src/ui/` | Componentes reutilizables: botones, campos, diálogos, mapa (Leaflet), pestañas, interruptores |
| `src/marco/` | Marco de la aplicación: encabezado, barra inferior, menú lateral, pie institucional, aviso de emergencia |
| `src/navegacion/` | Enrutador por hash (`#/tributos`, `#/reclamos/R-ABC123`), rutas y título del documento |
| `src/datos/` | Capa de datos. `almacen.js` (estado y escuchas), `repositorio*.js` (único lugar que lee y escribe en Firestore), `sesion.js`, `errores.js`, `mapeadores.js` y los ganchos `use*` |
| `src/firebase/` | Un módulo por servicio de Firebase: `auth`, `firestore`, `mensajeria` (FCM), `appCheck`, `analytics`, `rendimiento`, `configRemota` |
| `src/supabase/` | Cliente de las funciones del servidor (`llamarFuncion`) |
| `src/plataforma/` | Adaptadores del navegador: ubicación, impresión del cedulón, red, instalación, service worker, notificaciones locales |
| `src/tema/` | Colores, espacios y tipografías (`tokens.js`) |
| `src/sw.js` | Service worker: precarga la aplicación, guarda los mapas y muestra las notificaciones push |
| `shared/` | Dominio compartido en funciones puras `.mjs`: tarifas, horarios, estados, validaciones, catálogo de datos iniciales. Lo usan la aplicación, las funciones del servidor y las pruebas |
| `firestore.rules`, `firestore.indexes.json` | Reglas de seguridad e índices |
| `supabase/functions/` | Funciones de servidor en Deno: `vecino`, `adjuntos`, `despachar`, `tareas` y `_shared/` |
| `supabase/migrations/` | Depósito privado de adjuntos, tabla de ejecuciones y programación con `pg_cron` |
| `scripts/` | Emuladores, siembra, vecinos de ejemplo, presupuesto del paquete, verificación de React Native y capturas |
| `tests/` | `unidad/`, `reglas/`, `e2e/`, `humo/` y `carga/` |
| `docs/` | Esta guía, la especificación y los resultados de pruebas en producción |
| `public/` | Íconos, tipografías, pantalla de arranque estática y `robots.txt` |

## 3. Capas y reglas de dependencia

```
pantallas y ui  →  datos/almacen (ganchos)  →  datos/repositorio*  →  firebase/*  →  SDK
                                  └──────────→  supabase/funciones.js (funciones del servidor)
shared/  ← lo importan todos; no importa nada de src/ ni de supabase/
```

- **Solo componentes de React Native.** Todo lo que depende del navegador va en archivos con
  extensión `.web.js` o `.web.jsx`. `scripts/verificar-rn.mjs`, que corre con `npm test`, rechaza
  elementos del navegador en cualquier otro lado.
- **Un solo punto de acceso a Firestore.** Las pantallas no importan el SDK: usan el almacén para
  leer y el repositorio para escribir.
- **Errores con código.** `src/datos/errores.js` define `ErrorApp` con un código y un mensaje en
  español para el vecino. Las pantallas muestran ese mensaje, nunca el error crudo.
- **Presupuesto de 350 KB comprimidos** para el paquete inicial (`scripts/presupuesto.mjs`, parte
  de `npm run build`). Por eso el panel, las tarjetas y el mapa se cargan diferidos. Antes de sumar
  una dependencia hay que medir.

## 4. Modelo de datos

Firestore, base `(default)`.

| Ruta | Qué guarda | Quién escribe |
|---|---|---|
| `municipal/info`, `municipal/config` | `info` tiene los datos institucionales y el centro de los mapas. `config` tiene la configuración de la demostración (simulador, horario de cobro, umbral del aviso de estacionamiento) | Panel (administrador) |
| `estaciones/{id}`, `alarmas/{id}`, `zonasEstacionamiento/{id}`, `contactos/{id}` | Catálogo municipal. Se siembra con `scripts/sembrar.mjs` | Panel, siembra |
| `avisos/{id}` | Avisos públicos por tipo y zona | Panel, funciones |
| `eventos/{id}` | Bandeja de salida: un documento por alarma, aviso o avance de reclamo pendiente de enviar | Panel, funciones |
| `administradores/{uid}` | Marca de cuenta administradora | Solo consola o cuenta de servicio |
| `bloqueosPatente/{patente}` | `{ sesionId, fin }` sin `uid`, para que una patente tenga una sola sesión vigente | Vecino, en lote con su sesión |
| `usuarios/{uid}` | Perfil, preferencias de notificación y cercanía | Vecino, función `vecino` |
| `usuarios/{uid}/tributos` | Cedulones | Función `vecino`; el pago los marca |
| `usuarios/{uid}/pagos` | Cada pago con tarjeta enmascarada y comprobante | Vecino, en lote |
| `usuarios/{uid}/tarjetas` | Tarjetas guardadas: tipo, red, últimos cuatro dígitos, titular y vencimiento | Vecino |
| `usuarios/{uid}/estacionamiento` | Sesiones | Vecino, en lote |
| `usuarios/{uid}/bloqueoEstacionamiento/actual` | La sesión vigente del vecino, para permitir una sola a la vez | Vecino, en lote |
| `usuarios/{uid}/reclamos` | Reclamos con sus adjuntos y su línea de tiempo | Vecino; el panel cambia el estado |
| `usuarios/{uid}/notificaciones`, `avisosLeidos`, `dispositivos` | Historial personal, avisos leídos y tokens de Cloud Messaging | Funciones y vecino |

Supabase guarda además la tabla `public.ejecuciones` (registro de las tareas programadas) y el
depósito privado `adjuntos-reclamos/{uid}/{reclamoId}/…`.

## 5. Reglas de seguridad

Las reglas de `firestore.rules` son la validación de negocio: no hay servidor entre la aplicación y
la base para las operaciones del vecino.

- `conGoogle()` acepta solo sesiones de Google. Única excepción: los uid `ejemplo-…` con token
  personalizado, que solo puede emitir quien tiene la cuenta de servicio. `esDueno(uid)` y
  `esAdmin()` (documento en `administradores`) se apoyan en ella.
- **Importes y medios de pago.** El importe de un pago debe coincidir con el cedulón o con la tarifa
  por los minutos elegidos, y el medio debe ser una tarjeta de crédito o débito enmascarada.
- **Idempotencia.** El identificador de la solicitud es la clave del documento, así un reintento no
  crea un segundo pago.
- **Operaciones compuestas en un solo lote.** Pagar un cedulón, iniciar o extender un
  estacionamiento y activar una alarma escriben varios documentos juntos. Las reglas verifican con
  `getAfter` y `existsAfter` que estén todos y que coincidan.
- **Una sesión de estacionamiento por vecino** (`bloqueoEstacionamiento/actual`) y **una sesión
  vigente por patente** (`bloqueosPatente`).
- **Estados de reclamo** con transiciones permitidas: recibido, en proceso, resuelto.

Toda regla nueva lleva su prueba en `tests/reglas/`.

## 6. Funciones de Supabase

Corren en Deno, verifican el token de Firebase del usuario y escriben en Firestore con la cuenta de
servicio, por lo que no pasan por las reglas.

| Función | Rutas | Qué hace |
|---|---|---|
| `vecino` | `vecino/alta`, `vecino/baja` | El alta crea el perfil, los cedulones y los recordatorios iniciales. La baja borra todos los datos del vecino, sus adjuntos y su cuenta de ingreso |
| `adjuntos` | `adjuntos/subir`, `adjuntos/url` | Valida tipo y tamaño por el contenido del archivo, lo guarda en el depósito privado y entrega enlaces firmados de cinco minutos |
| `despachar` | `despachar` | Toma un evento pendiente, elige a los destinatarios por zona y cercanía, registra el aviso en su historial y lo envía por Cloud Messaging |
| `tareas` | `tareas` con `minuto`, `diaria`, `resumen`, `simulador` | La ejecuta `pg_cron` con un secreto compartido. Cada minuto avisa los estacionamientos por vencer, reenvía eventos pendientes y mueve el simulador; a las 9 envía los recordatorios de cedulones y a las 20 el resumen diario |

`supabase/functions/_shared/` reúne la verificación del token (`firebase-auth.ts`), el cliente REST
de Firestore (`firestore.ts`), el envío (`fcm.ts`, `entrega.ts`), los recordatorios, el simulador y el
depósito de archivos. Las migraciones no llevan secretos: la URL y el secreto del cron se cargan a
mano en Vault, como explica el comentario de `20261007120200_programacion.sql`.

## 7. Flujos principales

- **Ingreso.** `src/firebase/auth.js` abre la ventana de Google. Cuando hay sesión, `src/datos/almacen.js`
  llama a `asegurarAlta` (en `repositorio.js`), que invoca `vecino/alta` si el perfil todavía no tiene alta.
- **Pago de un cedulón.** `src/pantallas/pagos/` pide elegir una tarjeta guardada y espera 1,5 s de
  procesamiento simulado. `pagarTributo` valida y registra el pago en una transacción.
- **Estacionamiento.** `iniciarEstacionamiento`, `extenderEstacionamiento` y
  `finalizarEstacionamiento` mantienen sincronizados la sesión, el bloqueo de la patente, el
  bloqueo del vecino y el pago. El panel puede finalizar una sesión con `finalizarSesionAdmin`.
- **Alarma y aviso.** El panel llama a `cambiarAlarma`, que escribe la alarma y un evento
  pendiente en un lote y después invoca `despacharEvento`. `despachar` envía el aviso y el service
  worker lo muestra. Si falla, la tarea `minuto` reintenta.
- **Reclamo con adjuntos.** `crearReclamo` sube los archivos por `adjuntos/subir` y escribe el
  documento. El panel avanza el estado con `avanzarReclamo` y eso genera un evento.
- **Baja del vecino.** `borrarDatosEnServidor` llama a `vecino/baja`.

## 8. Pruebas

| Nivel | Comando | Con qué corre |
|---|---|---|
| Unidad | `npm test` | Node, sin red. Incluye `verificar-rn` |
| Reglas | `npm run test:reglas` | Emulador de Firestore |
| Extremo a extremo | `npm run test:e2e` | Emuladores, un simulador del servidor (`tests/e2e/edge-simulado.mjs`), Vite y Playwright en Pixel 7 y iPhone 13 |
| Humo | `npm run test:humo` | La versión publicada, en cinco navegadores |
| Carga | `npm run test:carga` | La versión publicada con red móvil lenta |
| Todo | `npm run test:todo` | Unidad, reglas, compilación con presupuesto y extremo a extremo |

Trampas ya conocidas:

- El emulador de Firestore exige **Java 21**. `scripts/emuladores.mjs` lo fuerza aunque el sistema
  tenga otro JDK. Si un emulador queda huérfano ocupa el puerto 8086 y el siguiente arranque da
  `TIMEOUT`; `node scripts/emuladores.mjs --puertos` muestra quién lo tiene.
- Con la máquina cargada fallan al azar entre dos y seis pruebas de extremo a extremo por demoras del
  emulador. Se repiten solas con `--repeat-each` para separarlas de una falla real.
- La prueba de humo y la de carga solo miran lo público: no inician sesión.
- Una prueba que deja una sesión de estacionamiento activa necesita que el formulario de inicio
  siga montado: ocultarlo desmonta el diálogo del comprobante.

## 9. Producción y operación

- Proyecto de Firebase `san-francisco-conecta-tp5` y proyecto de Supabase `qsxwsbdhlwyshqjfxaxw`.
  La aplicación se publica con `npm run deploy:hosting`, las reglas con `npm run deploy:reglas` y las
  funciones con `npm run deploy:supabase`.
- Los secretos (cuenta de servicio de Firebase y claves de Supabase) viven **fuera del
  repositorio** y nunca se versionan. El README explica qué variable apunta a cada uno.
- Los vecinos y el administrador de ejemplo se cargan con `npm run ejemplos:produccion`. Sus uid
  empiezan con `ejemplo-` y la sesión se abre con un token personalizado.
- La clave de API del navegador solo acepta los dos dominios publicados. Para desarrollar contra los
  servicios reales desde `localhost` hay que agregar ese origen a la clave en Google Cloud.
- App Check está en modo de monitoreo: registra y no bloquea. Los navegadores automatizados reciben
  `App attestation failed`, que es normal.
- Remote Config tiene cinco parámetros: `leyenda_prototipo`, `banner_emergencia`, `radio_alarma_km`,
  `intervalo_cercania_min` y `mensaje_bienvenida`.
- El horario de cobro del estacionamiento se controla desde la pestaña Simulación del panel
  (`horarioEstricto`). En producción está apagado para que las demostraciones funcionen a cualquier
  hora.

## 10. Convenciones

- Código, comentarios y mensajes en español rioplatense, con tildes. Los nombres técnicos del SDK
  quedan en su forma original.
- Cada comentario explica el motivo, no repite lo que hace el código.
- Una funcionalidad nueva suma su pantalla, su ruta y sus datos sin tocar las existentes, y lleva sus
  pruebas.
- No se guarda el número completo de una tarjeta ni el código de seguridad: se validan y se descartan
  (`shared/tarjetas.mjs`).
- Los textos de la interfaz usan ` ` (espacio duro) entre un número y su unidad para que no se
  corten en dos renglones.

## 11. Qué cambió respecto de la especificación inicial

[ARQUITECTURA.md](ARQUITECTURA.md) describe el diseño de partida. Estas decisiones posteriores lo
modifican.

- **Solo ingreso con Google.** Se eliminó el ingreso de invitados y las sesiones anónimas. La
  especificación todavía los menciona. La única excepción son las cuentas de ejemplo.
- **Medios de pago.** Los pagos se hacen solo con tarjetas de crédito o débito guardadas en Mi
  cuenta (`usuarios/{uid}/tarjetas`), con código de seguridad que se valida y se descarta.
- **Una sola sesión de estacionamiento por vecino**, además del bloqueo por patente.
- **Panel municipal** con pestañas de Pagos y Estacionamiento, y recaudación del día y del mes.
- **Hosting** sin caché en la página principal y con error 404 para archivos inexistentes.
- **Presupuesto del paquete** de 350 KB comprimidos, repartido en módulos diferidos.
- **Clave de API del navegador** restringida por dominio.
- **Cifras de pruebas** de la última corrida: 100 de unidad, 152 de reglas, 150 de extremo a extremo
  y 30 de humo.
