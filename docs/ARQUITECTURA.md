> **Nota de vigencia.** Esta es la especificación técnica con la que se reconstruyó la aplicación.
> Los comentarios del código citan sus apartados (`sección 6.8`) y sus paquetes de trabajo (`WP3`).
> Se conserva como fundamento del diseño. **Cuando difiere del código, manda el código.** La frase
> de la introducción que dice lo contrario ("gana el documento") valía mientras varios agentes
> programaban en paralelo y ya no rige. Las decisiones posteriores, como la eliminación del ingreso
> de invitados, están en la sección 11 de la [Guía del código](GUIA-DEL-CODIGO.md). Empezar por esa
> guía.

# San Francisco Conecta: especificación técnica de la versión 2

Trabajo práctico 5 de Arquitecturas Móviles, UTN FRSF. Este documento es el **contrato** entre los agentes que programan en paralelo. Nadie necesita leer el código de otro agente: los nombres de colecciones, campos, funciones del repositorio, props de componentes, rutas y códigos de error están acá. Si algo del código contradice este documento, gana el documento. Si el documento tiene un hueco, el agente decide dentro de sus archivos y lo anota en el informe de entrega de su paquete.

Las marcas **VERIFICAR** señalan APIs o límites que no comprobé contra la documentación o el plan gratuito. La sección 13 las reúne con su estado después de la revisión.

**Versión revisada.** Dos críticos (factibilidad y cobertura) revisaron la primera versión; las correcciones ya están incorporadas en cada sección y la sección 17, al final, resume qué se aceptó, qué se descartó y por qué. La versión anterior quedó en `scratchpad/tp5/ARQUITECTURA.antes-revision.md` solo como referencia: **no se programa contra ella**.

Origen del código reutilizado: commit `94369b3` de `app/` (versión heredada). Se cita como `heredado:archivo:líneas`. La versión heredada sigue disponible con `git show 94369b3:<ruta>` y en `TP5/_respaldo-version-heredada.zip`.

---

## 0. Convenciones que valen para todos

- **Idioma.** Colecciones, campos, funciones del repositorio, componentes y rutas en español, camelCase y sin tildes (`zonasEstacionamiento`, `pagadoEn`, `iniciarEstacionamiento`). Valores enumerados en minúscula con guion bajo (`en_proceso`, `resumen_diario`). Textos visibles en español rioplatense, con tildes.
- **Fechas.** En Firestore siempre `Timestamp` (escritas con `serverTimestamp()` cuando las reglas exigen `== request.time`). **En el estado del cliente, en el dominio compartido y en las Edge Functions, toda fecha es un número de milisegundos** (o `null`). Los mapeadores del repositorio y el códec REST de Supabase hacen la conversión. Zona horaria de presentación: `America/Argentina/Cordoba` (UTC−3 sin horario de verano).
- **Importes.** Enteros en pesos (`int`), sin decimales. Las tarifas por hora del estacionamiento son múltiplos de 4 para que `tarifaHora × minutos / 60` sea entero en bloques de 15 minutos.
- **Identificador de solicitud (`requestId`).** Lo genera `nuevoIdSolicitud()` de `shared/dominio.mjs` (UUID v4; respaldo con `crypto.getRandomValues` si falta `randomUUID`, hallazgo COD-16). Se genera **al abrir el diálogo de confirmación** y se reutiliza en los reintentos. Es el id del documento creado (pago, sesión, reclamo), y eso da la idempotencia que antes daba `heredado:functions/lib/service.mjs:118-178`.
- **Importaciones de plataforma sin extensión.** `import { ubicar } from '../plataforma/ubicacion'` para que Vite elija `ubicacion.web.js` antes que `ubicacion.js`. Nunca escribir `.web.js` en un import.
- **Prohibido en `src/` fuera de archivos `.web.*`:** etiquetas HTML (`div`, `span`, `button`, `input`, `select`, `a`), `document`, `window`, `navigator`, `localStorage` y CSS. Todo se escribe con `react-native`. Excepciones permitidas solo en archivos `.web.js`/`.web.jsx`, `src/index.web.js`, `src/sw.js` y `src/firebase/*` (los SDK web de Firebase). **Lo controla una máquina:** `scripts/verificar-rn.mjs` (WP1) corre dentro de `npm test` y falla si encuentra, fuera de esas excepciones, etiquetas JSX en minúscula, los identificadores `document.`, `window.`, `navigator.` o `localStorage`, o un import de `.css` que no sea `reset.css` o `leaflet/dist/leaflet.css`.
- **Commits.** Los agentes **no** ejecutan `git commit` ni `git add` (comparten un solo árbol y un solo `.git`; habría `index.lock` en conflicto y commits mezclados). El orquestador hace un commit por paquete al cerrar cada fase, con el mensaje `WPx: <resumen>` o `Sx: <resumen>`, lo que deja una historia legible para la entrega.
- **testID.** RNW traduce `testID` a `data-testid`. Toda pantalla tiene `testID="pantalla-<ruta>"` en su raíz. Los ids obligatorios para las pruebas están en cada pantalla (sección 8).
- **Sin claves en el repositorio.** La configuración web va en `.env.local` (ignorado). La cuenta de servicio de Firebase existe solo como secreto de Supabase. `.env.example`, `.env.emulador` y `.env.e2e` se versionan porque no tienen secretos.

---

## 1. Estructura de carpetas y destino de cada archivo heredado

### 1.1 Árbol final de `app/` (raíz del repositorio público)

Entre corchetes, el paquete de trabajo dueño (sección 11).

```
app/
├─ index.html                         [WP1]
├─ package.json, package-lock.json    [WP1]  único dueño; nadie más instala dependencias
├─ vite.config.mjs                    [WP1]
├─ firebase.json                      [WP1]
├─ firebase.pruebas.json              [WP1]  emuladores en 9098/8086 para pruebas (antes firebase.test.json)
├─ .firebaserc                        [WP1]  se conserva
├─ firestore.rules                    [WP3]
├─ firestore.indexes.json             [WP3]
├─ remoteconfig.template.json         [WP4]  plantilla de Remote Config versionada
├─ playwright.config.mjs              [WP1]  e2e contra Vite + emuladores
├─ playwright.humo.config.mjs         [WI]   humo contra la URL publicada
├─ .env.example  .env.emulador  .env.e2e  .gitignore   [WP1]
├─ README.md                          [WI]
├─ shared/                            [WP2]  dominio puro: navegador, Node y Deno
│   ├─ constantes.mjs
│   ├─ dominio.mjs
│   ├─ formato.mjs
│   ├─ rutas.mjs
│   ├─ catalogo.mjs
│   ├─ recordatorios.mjs
│   ├─ notificaciones.mjs
│   └─ simulador.mjs
├─ public/                            [WP1]
│   ├─ brand/municipalidad-blanco.png   (se conserva)
│   ├─ brand/README.md                  (se actualiza: ya no dice "solo localhost")
│   ├─ fonts/quicksand-latin.woff2 (descargado de Google Fonts), fonts/OFL-Quicksand.txt
│   ├─ icons/icono.svg, icono-192.png, icono-512.png, icono-maskable-512.png,
│   │        apple-touch-icon.png (180), insignia-96.png (monocromo)   (PNG generados una vez y versionados)
│   ├─ favicon.svg
│   └─ robots.txt
├─ src/
│   ├─ index.web.js                   [WP5]  entrada: registra el SW y AppRegistry.runApplication
│   ├─ App.jsx                        [WP5]
│   ├─ reset.css                      [WP5]  único CSS propio (más el de Leaflet)
│   ├─ sw.js                          [WP4]  service worker único (injectManifest)
│   ├─ tema/tokens.js, tema/servicios.js           [WP5]
│   ├─ ui/                            [WP5]  componentes compartidos (sección 7)
│   ├─ navegacion/                    [WP5]  rutas por hash y enrutador
│   ├─ marco/                         [WP5]  encabezado, menú, barra inferior, pie, leyenda
│   ├─ datos/                         [WP3]  repositorio, mapeadores, errores, almacén, sesión y hooks
│   ├─ firebase/                      [WP4]  un módulo por servicio
│   ├─ supabase/funciones.js          [WP6]  cliente de las Edge Functions
│   ├─ plataforma/                    [según la tabla 11.2]
│   └─ pantallas/                     [S1..S8] una o dos pantallas por agente
├─ supabase/                          [WP6]
│   ├─ config.toml
│   ├─ migrations/*.sql
│   └─ functions/
│       ├─ _shared/*.ts               (importan ../../../shared/*.mjs directo; despliegue con --use-api)
│       ├─ vecino/index.ts
│       ├─ adjuntos/index.ts
│       ├─ despachar/index.ts
│       └─ tareas/index.ts
├─ scripts/
│   ├─ emuladores.mjs                 [WP1]  arranca emuladores, siembra y Vite
│   ├─ con-emuladores.mjs             [WP1]  envoltorio de emulators:exec con firebase.pruebas.json
│   ├─ verificar-rn.mjs               [WP1]  falla si hay HTML, DOM o CSS fuera de los archivos .web.*
│   ├─ presupuesto.mjs                [WP1]  controla el peso del paquete inicial
│   ├─ sembrar.mjs                    [WP3]  catálogo y vecino de prueba (emulador o producción)
│   └─ capturas.mjs                   [WI]   capturas a 390 px para el informe
├─ tests/
│   ├─ unidad/                        [WP2] dominio; [WP3] mapeadores
│   ├─ reglas/                        [WP3] @firebase/rules-unit-testing
│   ├─ e2e/fixtures.mjs, e2e/edge-simulado.mjs, e2e/accesibilidad.mjs   [WP1]
│   ├─ e2e/<pantalla>.spec.mjs        [S1..S8] cada agente de pantalla escribe la suya
│   ├─ humo/publicado.spec.mjs        [WI]
│   └─ carga/medir-carga.mjs          [WI]
└─ docs/pruebas/                      [WI]  junit, carga.json, dispositivos.md, capturas de evidencia
```

### 1.2 Qué pasa con cada archivo heredado

| Archivo heredado | Destino | Qué se reutiliza |
|---|---|---|
| `functions/` completo (incluidos `functions/index.mjs`, `functions/package.json` y `functions/package-lock.json`) | **Se borra** | La lógica se reparte: validaciones a `shared/dominio.mjs`, reglas de negocio a `firestore.rules`, envío push, recordatorios y operaciones municipales a Supabase |
| `functions/lib/domain.mjs` | → `shared/dominio.mjs` | `DomainError`, `required`, `member`, `minutes`, `plate`, `parkingCost`, `distanceKm` (líneas 1-54), traducidas. `validateAttachments` (55-86) se reescribe sin `Buffer` (Uint8Array) |
| `functions/lib/seed.mjs` | → `shared/catalogo.mjs` | Institución (5-13), estaciones (68-109), tributos (110-139), reclamo de ejemplo (140-154), alarmas (155-186), zonas (187-218), contactos (220-276), aviso (277-288), preferencias (289-301). Se agregan datos (sección 2.4) |
| `functions/lib/reminders.mjs` | → `shared/recordatorios.mjs` | Umbrales de 3 días y 5 minutos y las claves deterministas con la fecha de vencimiento (líneas 6-8 y 27-30) |
| `functions/lib/service.mjs` | Se borra; se reparte | `operation` (154-178) → id de documento = requestId. `payment` (185-194) → comprobante simulado. `startParking` (445-487) y `extendParking` (488-526) → reglas. `adminAdvanceClaim` (675-710) → transiciones en reglas. `adminSetAlarm`/`publishMunicipalNotice`/`processMunicipalEvent` (768-839) → patrón de bandeja `eventos`. `publishToResidents` (733-767) y `deliverPush` (853-892) → `despachar` de Supabase, con el borrado de tokens inválidos. `subscribeNearbyAlarms` (589-616) → campo `cercania` sin coordenadas. `historyQuery`/`historyPage` (292-334) → `cargarMas` del almacén (sube el `limit` de la escucha). `processAllReminders` (663-674) → recordatorios en `vecino/alta` y en `tareas` |
| `server/` | **Se borra** | Reexportaba `functions/lib` |
| `src/screens/*.jsx` | → `src/pantallas/*.jsx`, **reescritas en React Native** | Textos de encabezados, orden de la información y flujos. Ver sección 8 |
| `src/MapView.jsx` | → `src/ui/MapaLeaflet.web.jsx` | Todo el componente: marcadores circulares, tramos, popups armados con nodos de texto y no con HTML (evita XSS), aviso de teselas caídas, `ResizeObserver`. Cambia la URL de teselas: de `{s}.tile.openstreetmap.org` (línea 17) a `https://tile.openstreetmap.org/{z}/{x}/{y}.png` con `crossOrigin: true` (sección 7.2) |
| `src/main.jsx`, `src/App.jsx` | **Se reemplazan** por `src/index.web.js` y el nuevo `src/App.jsx` (WP5) | Nada |
| `src/components.jsx` | → `src/ui/` | Medidas y colores de `Button`, `Field`, `Card` (líneas 3-55). La trampa de foco de `Confirm` (152-216) la reemplaza `Modal` de RN |
| `src/MunicipalChrome.jsx` | → `src/marco/` | Estructura del encabezado, menú y pie, y los enlaces institucionales (portal, teléfonos útiles, redes) |
| `src/MunicipalApp.jsx` | → `src/marco/Marco.jsx` y `src/navegacion/` | Navegación por hash y gestión de foco al cambiar de pantalla (líneas 43-50) |
| `src/AuthGate.jsx` | → `src/pantallas/Ingreso.jsx` | Textos de bienvenida y beneficios, botón de Google con su SVG |
| `src/firebase.js` | → `src/firebase/auth.js` | `authMessage` (mensajes por código), popup con respaldo de redirect (ahora también para vincular) |
| `src/firebaseConfig.js` | → `src/firebase/config.js` | Tal cual, más VAPID y emuladores |
| `src/firebaseData.js`, `src/repository.js`, `src/useMunicipal.js` | **Se borran** | El polling de 30 s y el patrón "escucha y vuelve a pedir todo a una Function" (COD-01) desaparecen |
| `src/services.js` | → `src/tema/servicios.js` | Nombres, descripciones y colores por servicio |
| `src/icons.js` | → `src/ui/Icono.web.jsx` | Importación por archivo de lucide para no arrastrar toda la librería |
| `src/platform.web.js` | Se divide | `locate` → `plataforma/ubicacion.web.js`; `readAttachments` → `plataforma/archivos.web.js`; `emitBill` → `plataforma/cedulon.web.js`; `money`/`date` → `shared/formato.mjs` |
| `src/push.js` | → `src/firebase/mensajeria.web.js` | Flujo de permiso, `isSupported`, `getToken` y `deleteToken` (el registro del token en Firestore pasa a `src/datos/sesion.js`) |
| `src/push-worker.js`, `public/notifications-sw.js` | → `src/sw.js` | Lista de destinos permitidos y `notificationclick` que reutiliza la ventana abierta. Se elimina el segundo service worker (ARQ-08). `sw.js` ya no usa `firebase/messaging/sw` (sección 9.2) |
| `src/notificationPolicy.js` | → `shared/notificaciones.mjs` | `shouldAlert` pasa a ser `decidirEntrega`, usada por el cliente y por Supabase |
| `src/styles.css` | **Se borra** | Solo se rescatan los colores (sección 7.1) y la regla `@font-face` (a `reset.css`) |
| `public/fonts/quicksand-variable.ttf` | **Se borra** | Se reemplaza por `quicksand-latin.woff2` descargado de Google Fonts (subconjunto latino, licencia OFL); no hace falta `pyftsubset` |
| `storage.rules`, `firestore-debug.log` | **Se borran** | Storage no se usa (exige Blaze) |
| `firebase.test.json` | → `firebase.pruebas.json` (WP1) | Los puertos 9098 y 8086 de las pruebas: la CLI no acepta puertos por bandera y `--config` necesita un archivo en disco |
| `.firebaserc` | Se conserva (dueño WP1) | Alias `default` → `san-francisco-conecta-tp5` |
| `dist/` | **Se vacía** antes de cada build (`emptyOutDir`, ignorado por git) | Hoy contiene `firebase-messaging-sw.js` y `notifications-sw.js` viejos. El Hosting nunca se publicó (la URL responde "Site Not Found"), así que no hay service workers viejos instalados en navegadores y no hace falta uno que se desregistre solo |
| `scripts/dev-firebase.mjs`, `scripts/test-firebase.mjs`, `scripts/reminder-worker.mjs` | → `scripts/emuladores.mjs`, `scripts/con-emuladores.mjs`; el tercero se borra | Selección de Java 21 en Windows (`heredado:scripts/test-firebase.mjs:11-16`) |
| `tests/domain.test.mjs`, `tests/reminders.test.mjs` | → `tests/unidad/` adaptadas | Los mismos casos con los nombres nuevos |
| `tests/firebase/*.test.mjs` | **Se borran** | Probaban callables. Sus escenarios (doble pago, patente entre cuentas, transición de estados, dueño de los datos) se reescriben como pruebas de reglas (sección 10.2) |
| `.env.test` | → `.env.emulador` | |
| `.npmrc` | Se conserva | `cache=.npm-cache` sigue ignorado |

### 1.3 Alias y extensiones (contrato de compilación)

- `react-native` → `react-native-web` (alias de Vite, ya existe en `heredado:vite.config.mjs:6`).
- Orden de resolución: `.web.jsx`, `.web.js`, `.web.mjs`, `.jsx`, `.js`, `.mjs`, `.json`.
- `shared/` se importa con ruta relativa desde `src/` (`../../shared/dominio.mjs`), siempre con la extensión `.mjs`. Desde `supabase/functions/_shared/*.ts` se importa igual (`../../../shared/dominio.mjs`): no hay copia.

---

## 2. Modelo de datos de Firestore

Base `(default)`, región la que ya tiene el proyecto `san-francisco-conecta-tp5`. "SC" = cuenta de servicio desde Supabase (no pasa por reglas). "Admin" = usuario **con cuenta de Google** (no anónimo) y documento en `administradores/{uid}`; el mismo criterio en reglas (`esAdmin()`) y en Supabase (`exigirAdmin`).

### 2.1 Catálogo público (lectura sin sesión, escritura solo admin o SC)

**`municipal/info`** (documento único)

| Campo | Tipo | Notas |
|---|---|---|
| nombre | string | "Municipalidad de San Francisco" |
| direccion | string | "Bv. 9 de Julio 1187, San Francisco, Córdoba" |
| telefono | string | "+54 3564 439111" |
| lineaVecino | string | "147" |
| whatsapp | string | "5493564336062" (canal Tana, heredado) |
| sitio | string | "https://www.sanfrancisco.gov.ar" |
| portalTributario | string | "https://drt.sanfrancisco.gov.ar" |
| centroMapa | map {lat: number, lng: number} | {-31.429, -62.082} |

**`municipal/config`** (documento único, parámetros de la demo)

| Campo | Tipo | Escribe |
|---|---|---|
| simuladorActivo | bool (inicial `false`) | Admin |
| simuladorCadaMin | int 1..30 (inicial 2) | Admin |
| horarioEstricto | bool (inicial `true`) | Admin. Si es `false`, las reglas no controlan el horario del estacionamiento (para una demo de noche) |
| avisoEstacionamientoMin | int 1..14 (inicial 5) | Admin. Minutos antes del fin en que salen el aviso local y el push de E3. **Única fuente** del umbral para el cliente y para `tareas`. En la demo se fija en 14: con la sesión mínima de 15 minutos el aviso llega alrededor de un minuto después de iniciar |
| ultimaSimulacion | timestamp o null | SC |
| actualizadoEn | timestamp | Admin |

**`estaciones/{estacionId}`** (`b1`..`b6`)

| Campo | Tipo | Notas |
|---|---|---|
| nombre, referencia | string | |
| zona | string ∈ ZONAS | |
| lat, lng | number | |
| bicicletas | int 0..capacidad | Cambia el admin o el simulador (B2) |
| capacidad | int | Anclajes libres = capacidad − bicicletas |
| estado | `operativa` \| `fuera_de_servicio` | |
| actualizadoEn | timestamp | Se muestra como "actualizado hace N min" |

**`alarmas/{alarmaId}`** (`a1`..`a4`)

| Campo | Tipo | Notas |
|---|---|---|
| nombre, referencia | string | |
| zona | string ∈ ZONAS | |
| lat, lng | number | |
| activa | bool | A2 |
| activadaEn | timestamp o null | |
| activacionId | string o null | id del `eventos/{id}` que disparó la última activación |
| actualizadoEn | timestamp | |

**`zonasEstacionamiento/{zonaId}`** (`p1`..`p3`)

| Campo | Tipo | Notas |
|---|---|---|
| nombre, referencia, direccion | string | |
| zona | string ∈ ZONAS | barrio, para suscripciones |
| lat, lng | number | |
| tramo | array de map {lat, lng} | polilínea en el mapa (E1) |
| tarifaHora | int, múltiplo de 4 | E1 |
| horario | map {dias: array<int 1..7> (1 = lunes), desde: int 0..23, hasta: int 1..24} | Validado por reglas |
| horarioTexto | string | "Lunes a viernes, 8 a 20 h" |

**`contactos/{contactoId}`** (`c01`..`c10`)

| Campo | Tipo |
|---|---|
| area, nombre, descripcion, horario, direccion | string |
| categoria | `municipal` \| `emergencias` \| `salud` |
| telefono, correo, whatsapp, sitio | string o null |
| orden | int |

**`avisos/{avisoId}`** (avisos municipales públicos, N1 y N3)

| Campo | Tipo | Notas |
|---|---|---|
| titulo | string 3..100 | |
| cuerpo | string 10..500 | |
| detalle | string 0..3000 | "más información" |
| tipo | ∈ TIPOS_AVISO (`obras`, `cortes`, `eventos`, `emergencias`, `servicios`) o `alarmas` | Los de TIPOS_AVISO los publica el panel; `alarmas` solo lo crea SC (Anexo A: `TIPOS_AVISO` no incluye `alarmas`) |
| zona | ∈ ZONAS o `todas` | |
| destino | string hash interno o null | ej. `#/alarmas/a2` (enlace a más información dentro de la app) |
| enlace | string `https://` o null | enlace externo (FUN-08) |
| creadoEn | timestamp | |
| autor | `municipalidad` \| `simulador` | |
| eventoId | string | |
| vigenteHasta | timestamp o null | para el banner de emergencia |

### 2.2 Datos por vecino: `usuarios/{uid}` y subcolecciones

**`usuarios/{uid}`** (perfil). Lee y escribe el dueño, con campos acotados. **No se guarda el correo** (corrige `heredado:service.mjs:237`, hallazgo SEG-05).

| Campo | Tipo | Escribe |
|---|---|---|
| nombre | string 0..80 | dueño o SC |
| anonimo | bool | dueño o SC |
| creadoEn, actualizadoEn | timestamp | dueño o SC |
| altaEn | timestamp | **solo SC** (`vecino/alta`) |
| preferencias | map {tipos: array<TIPO_NOTIFICACION>, zonas: array<ZONA>, frecuencia: FRECUENCIA, push: bool} | dueño (N2, A4). `push` significa "el vecino tiene **al menos un** dispositivo registrado"; no es el interruptor de un dispositivo (ese estado vive en el navegador, sección 5.8) |
| cercania | map {alarmas: array<string> (≤20), vence: timestamp (≤ ahora + 61 min)} o null | dueño (A3). Nunca coordenadas (`heredado:service.mjs:606-607`). El cliente usa como máximo 60 min para no rozar el límite de la regla |
| privacidadAceptadaEn | timestamp o null | dueño |

Subcolecciones:

| Subcolección | Campos | Crea | Modifica | Lee |
|---|---|---|---|---|
| `tributos/{tributoId}` (`T-1001`) | concepto, periodo, cuenta: string; importe: int; vence: timestamp; pagadoEn: timestamp o null; comprobante: string o null; pagoId: string o null | SC (`vecino/alta`) | dueño, solo al pagar | dueño |
| `pagos/{requestId}` | tipo: `tributo` \| `estacionamiento` \| `extension`; refId: string (tributoId o sesionId); importe: int; comprobante: string (`REC-`/`EST-`/`EXT-` + 8 alfanuméricos); proveedor: `pasarela-simulada`; creadoEn: timestamp | dueño | nadie | dueño |
| `reclamos/{requestId}` | codigo `R-XXXXXX`; categoria; direccion; descripcion; estacionId o null; adjuntos: array ≤3 de {ruta, nombre, tipo, tamano}; estado: `recibido` \| `en_proceso` \| `resuelto`; cronologia: map {recibido: ts, en_proceso?: ts, resuelto?: ts}; notaMunicipal: string o null; creadoEn, actualizadoEn: ts; ultimoEventoId: string o null | dueño | admin o SC, transición válida | dueño y admin |
| `estacionamiento/{requestId}` | patente; zonaId; zonaNombre; zona; minutos: int; importe: int; inicio, fin: ts; extensiones: int; ultimoPagoId: string; avisoPorVencer, avisoFinalizado: bool; actualizadoEn: ts | dueño | dueño (extender o finalizar antes; finalizar pone `fin` = hora del servidor, sin reintegro) y SC (avisos) | dueño |
| `notificaciones/{id}` (personales) | titulo, cuerpo; tipo ∈ TIPOS_NOTIFICACION; zona o null; destino o null; enlace o null; creadoEn: ts; leida: bool; leidaEn: ts o null; origen: `vecino` \| `servidor` | dueño (sus propias operaciones) y SC | dueño (marcar leída) | dueño |
| `avisosLeidos/{avisoId}` | leidoEn: ts | dueño | dueño (volver a marcar, idempotente) | dueño |
| `dispositivos/{idToken}` (`idToken` = primeros 32 hex de SHA-256 del token FCM) | token, plataforma: string; actualizadoEn: ts | dueño | dueño | dueño y SC |

Ids de notificaciones personales que crea SC (deterministas, sirven de idempotencia y de clave de entrega, ver `claveEntrega` en el Anexo A): `tributo-<tributoId>-<venceDia>-<etapa>` (T4), `est-<sesionId>-<finMs>-<etapa>` (E3), `reclamo-<eventoId>` (R3), `alarma-<eventoId>` (A3) y `bienvenida`.

Notas de diseño:

- `cronologia` es un **mapa** y no un array porque `serverTimestamp()` no se admite dentro de arrays, y las reglas necesitan comparar con `request.time`.
- El reclamo usa el `requestId` como id de documento y un `codigo` corto para mostrar. Así un reintento no duplica (`heredado:service.mjs:358-359` hacía lo mismo con un hash).
- Los avisos municipales **no se copian** a cada vecino como en `heredado:service.mjs:733-767`: el cliente los lee de `avisos` y los filtra con sus preferencias. Solo se crean notificaciones personales para lo que es de un vecino (tributos, estacionamiento, reclamos y alarmas cercanas fuera de sus zonas).

### 2.3 Administración y coordinación

| Ruta | Campos | Quién |
|---|---|---|
| `administradores/{uid}` | nombre: string; alta: timestamp | Se crea **a mano desde la consola de Firebase** con el uid de una cuenta **de Google** (el README explica cómo copiarlo desde Authentication). El dueño puede leer (`get`) el suyo para saber si es admin. Nadie escribe desde el cliente |
| `eventos/{eventoId}` (bandeja de salida) | tipo: `aviso` \| `alarma` \| `reclamo`; refId; uid o null; origen: `panel` \| `simulador`; estado: `pendiente` \| `procesando` \| `enviado` \| `error`; intentos: int; creadoEn: ts; procesadoEn: ts; enviados: int; error: string | Admin crea (pendiente). SC procesa y actualiza |
| `bloqueosPatente/{patente}` | sesionId: string; fin: timestamp. **Sin `uid`** | Cualquier usuario autenticado puede leer uno (`get`) para saber hasta cuándo está ocupada la patente; no puede saber de quién es. La propiedad se prueba con `exists(usuarios/{auth.uid}/estacionamiento/{sesionId})` antes del lote. Se escribe solo en el mismo lote que la sesión |

**Patrón de bandeja (outbox).** Toda acción del panel que deba avisar a vecinos (activar alarma, avanzar reclamo, publicar aviso) escribe en el mismo lote el cambio y un `eventos/{id}` pendiente. Las reglas lo exigen con `existsAfter`. Después el panel llama a `despachar` de Supabase con ese id. Si la llamada falla, la tarea programada de cada minuto barre los pendientes. Es el mismo diseño que `heredado:service.mjs:768-852` (`municipalEvents` con reintento), sin Cloud Functions.

### 2.4 Contenido del catálogo (`shared/catalogo.mjs`)

Se conserva todo lo heredado y se completa lo que pidió la auditoría (FUN-04, FUN-14: zonas Norte y Sur con datos, más áreas de contacto).

| Id | Nombre | Zona | Coordenadas | Datos |
|---|---|---|---|---|
| b1 | Estación Plaza General Paz | centro | -31.4351133, -62.0862566 | 8/14 |
| b2 | Estación Municipalidad | centro | -31.4319946, -62.0797907 | 3/12 |
| b3 | Estación Parque Cincuentenario | parque | -31.4254107, -62.0684119 | 6/10 |
| b4 | Estación Terminal | centro | -31.4297491, -62.0916357 | 2/10 |
| b5 | Estación UTN | norte | -31.4204884, -62.1110106 | 5/10 (nueva, coordenadas de `place-utn`) |
| b6 | Estación Hospital Iturraspe | parque | -31.4279816, -62.0679246 | 0/8 (nueva, para mostrar "sin bicicletas") |
| a1 | Alarma Municipalidad | centro | como b2 | |
| a2 | Alarma Parque Cincuentenario | parque | como b3 | |
| a3 | Alarma Plaza General Paz | centro | como b1 | |
| a4 | Alarma UTN | norte | como b5 | nueva |
| p1 | Municipalidad, Bv. 9 de Julio | centro | heredado | 800 $/h, lun-vie 8-20 |
| p2 | Terminal, Bv. 9 de Julio | centro | heredado | 500 $/h, lun-vie 8-18 |
| p3 | Plaza General Paz | centro | tramo ±0,0004° de longitud alrededor de b1 | 600 $/h, lun-sáb 8-13 (nueva) |

**VERIFICAR:** zona Sur sin punto de referencia verificado. Agregar una estación y una alarma en la zona Sur con coordenadas comprobadas en OpenStreetMap; hasta entonces la zona Sur existe para suscripciones y avisos (`av-corte-sur`). El tramo de `p3` también hay que contrastarlo con el mapa.

Contactos `c01`..`c10`: Atención ciudadana 147 (tel 147 y WhatsApp 5493564336062), Dirección General Tributaria (+543564439111, sitio del portal tributario), Centro de reclamos (147 y WhatsApp), Conmutador municipal (+543564439111, sitio institucional), Prensa municipal (correo prensa@sanfrancisco.gov.ar), Hospital Regional J. B. Iturraspe (+543564443718), Emergencias médicas 107, Policía 101, Bomberos 100, Defensa Civil 103. Son los teléfonos heredados y los números nacionales de emergencia; no se inventa ningún teléfono ni correo de área.

Avisos semilla: `av-obras-centro` (obras, centro, el heredado), `av-corte-sur` (cortes, sur, corte de agua programado), `av-evento-parque` (eventos, parque), `av-servicios-todas` (servicios, todas, "Nuevo canal de reclamos en línea"). Todos con `detalle` que aclara "Aviso de demostración".

Datos iniciales de cada vecino (`datosInicialesVecino(ahora)`), los escribe `vecino/alta`:

| Id | Concepto | Período | Importe | Vence | Estado |
|---|---|---|---|---|---|
| T-1001 | Tasa de servicios municipales | 10/2026 | 18500 | ahora + 2 d | por vencer |
| T-1002 | Contribución sobre inmuebles | 10/2026 | 24750 | ahora + 8 d | pendiente |
| T-0999 | Tasa de servicios municipales | 08/2026 | 18500 | ahora − 40 d | vencido (FUN-13) |
| T-1000 | Tasa de servicios municipales | 09/2026 | 18500 | ahora − 20 d | pagado ahora − 22 d, comprobante `REC-00001000`, más su `pagos/semilla-T-1000` |

Más el reclamo `semilla-reclamo-1` (`R-000001`, alumbrado, "La luminaria de la esquina no enciende por la noche.", estado `en_proceso`, cronología recibido −2 d y en proceso −1 d) y una notificación de bienvenida. Preferencias por defecto: todos los tipos, zonas `centro` y `parque`, frecuencia `inmediata`, `push: false`.

**Recordatorios inmediatos (T4 visible en clase).** `vecino/alta` aplica `recordatoriosTributos` sobre los tributos que acaba de crear y escribe en la misma llamada las notificaciones con sus claves deterministas: "Tu Tasa de servicios municipales 10/2026 vence en 2 días" (T-1001, `por_vencer`) y "Tenés un cedulón vencido" (T-0999, `vencido`). Así un vecino recién creado ya ve T4 en Notificaciones, sin esperar la tarea de las 09:00. La tarea diaria no los repite porque la clave es la misma.

### 2.5 Índices (`firestore.indexes.json` completo)

```json
{
  "indexes": [
    { "collectionGroup": "tributos", "queryScope": "COLLECTION_GROUP",
      "fields": [ { "fieldPath": "pagadoEn", "order": "ASCENDING" }, { "fieldPath": "vence", "order": "ASCENDING" } ] },
    { "collectionGroup": "reclamos", "queryScope": "COLLECTION_GROUP",
      "fields": [ { "fieldPath": "estado", "order": "ASCENDING" }, { "fieldPath": "actualizadoEn", "order": "ASCENDING" } ] },
    { "collectionGroup": "eventos", "queryScope": "COLLECTION",
      "fields": [ { "fieldPath": "estado", "order": "ASCENDING" }, { "fieldPath": "creadoEn", "order": "ASCENDING" } ] }
  ],
  "fieldOverrides": [
    { "collectionGroup": "reclamos", "fieldPath": "creadoEn", "indexes": [
      { "order": "ASCENDING", "queryScope": "COLLECTION" },
      { "order": "DESCENDING", "queryScope": "COLLECTION" },
      { "arrayConfig": "CONTAINS", "queryScope": "COLLECTION" },
      { "order": "DESCENDING", "queryScope": "COLLECTION_GROUP" } ] },
    { "collectionGroup": "estacionamiento", "fieldPath": "fin", "indexes": [
      { "order": "ASCENDING", "queryScope": "COLLECTION" },
      { "order": "DESCENDING", "queryScope": "COLLECTION" },
      { "arrayConfig": "CONTAINS", "queryScope": "COLLECTION" },
      { "order": "ASCENDING", "queryScope": "COLLECTION_GROUP" } ] }
  ]
}
```

Consultas que los usan: panel (grupo `reclamos` por `creadoEn` desc; **el filtro por estado se aplica en el cliente** sobre los 50 cargados), simulador (grupo `reclamos` por `estado ==` y `actualizadoEn <=`), recordatorios (grupo `estacionamiento` por rango de `fin`; grupo `tributos` con `pagadoEn == null` y `vence <=`), barrido de la bandeja (`eventos` por `estado in [pendiente, error]` ordenado por `creadoEn`, limit 50).

**Regla para no depender de índices no declarados** (el emulador no exige índices, así que un faltante solo aparece en producción como `FAILED_PRECONDITION`): toda consulta de la Edge Function o del cliente usa como máximo los filtros de un índice de esta lista o de un índice automático de un solo campo, y **el resto de las condiciones se filtran en el código**:

| Consulta | En Firestore | En el código |
|---|---|---|
| Bandeja de eventos | `estado in [...]`, `orderBy creadoEn`, limit 50 | `intentos < 3`, y se procesan los primeros 20 |
| Cercanos a una alarma | `usuarios` con `cercania.alarmas array-contains refId` (automático) | `cercania.vence > ahora` |
| E3 por vencer | grupo `estacionamiento` con `fin > ahora` y `fin <= ahora + 14 min` | `fin <= ahora + avisoEstacionamientoMin` y `avisoPorVencer != true` |
| E3 finalizadas | grupo `estacionamiento` con `fin > ahora − 3 min` y `fin <= ahora` | `avisoFinalizado != true` |
| Resumen diario | `usuarios` con `preferencias.frecuencia == 'resumen_diario'` (automático) | `preferencias.push == true` |
| Destinatarios de un aviso | `usuarios` con `preferencias.push == true` (automático), paginado de a 300 | `decidirEntrega` |

La prueba que lo garantiza es la corrida de las cuatro tareas contra producción en la definición de terminado de WP6 (11.4): cada una debe dejar una fila con `ok = true` en `public.ejecuciones`.

---

## 3. Reglas de seguridad (`firestore.rules`)

Las reglas son la validación de negocio, como en el TP2. Reemplazan las 17 callables. Este archivo es el que tiene que quedar; WP3 puede corregir errores de sintaxis o de límites, pero no relajar ninguna condición sin anotarlo.

**Límite de llamadas a documentos.** Hasta 10 llamadas `get`/`exists`/`getAfter`/`existsAfter` por solicitud de un documento y 20 por lote o transacción, **y el límite de 10 vale también para cada operación del lote**. La documentación solo dice que algunas llamadas repetidas "pueden" cachearse: el emulador las cachea, producción no lo garantiza. Por eso **cada documento se lee una sola vez por operación**, guardado con `let` dentro de una función, y el conteo no depende de la caché. Peor caso por operación, contando sin caché:

| Operación | Llamadas | Lote completo |
|---|---|---|
| Crear sesión de estacionamiento | 4 (zona, config, bloqueo, pago) | sesión 4 + bloqueo hasta 2 + pago 1 = 7 |
| Extender sesión | 3 (zona, pago, bloqueo) | sesión 3 + bloqueo 2 + pago 2 = 7 |
| Finalizar sesión | 2 (la zona de la rama de extensión, que falla antes de leer el pago, más el bloqueo) | sesión 2 + bloqueo 2 = 4 |
| Pagar tributo | tributo 1, pago 2 | 3 (+ notificación 0) |
| Avanzar reclamo, activar alarma, publicar aviso | 2 (admin, evento) | 2 + evento 1 = 3 |

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ===================== Utilidades =====================
    function autenticado() { return request.auth != null; }
    function esDueno(uid) { return request.auth != null && request.auth.uid == uid; }
    // Mismo criterio que exigirAdmin de Supabase (6.4): cuenta no anónima y documento en administradores.
    function esAdmin() {
      return request.auth != null
        && request.auth.token.firebase.sign_in_provider != 'anonymous'
        && exists(/databases/$(database)/documents/administradores/$(request.auth.uid));
    }
    function nuevo() { return request.resource.data; }
    function viejo() { return resource.data; }
    function claves(lista) {
      return request.resource.data.keys().hasAll(lista) && request.resource.data.keys().hasOnly(lista);
    }
    function soloCambian(lista) {
      return request.resource.data.diff(resource.data).affectedKeys().hasOnly(lista);
    }
    function texto(v, min, max) { return v is string && v.size() >= min && v.size() <= max; }
    function textoOpcional(v, max) { return v == null || (v is string && v.size() <= max); }
    function entero(v, min, max) { return v is int && v >= min && v <= max; }
    function idSolicitud(id) { return id is string && id.matches('^[A-Za-z0-9_-]{8,80}$'); }
    function destinoValido(d) { return d == null || (d is string && d.matches('^#/[a-z]+(/[A-Za-z0-9_-]+)?$')); }
    // Córdoba es UTC-3 todo el año. dayOfWeek(): 1 = lunes ... 7 = domingo (probado en el emulador).
    function ahoraLocal() { return request.time - duration.value(3, 'h'); }
    function config() { return get(/databases/$(database)/documents/municipal/config).data; }

    // Deben coincidir con shared/constantes.mjs (hay una prueba que lo controla).
    function zonas() { return ['centro', 'parque', 'norte', 'sur']; }
    function categorias() { return ['alumbrado', 'bacheo', 'limpieza', 'bicicletas', 'otros']; }
    function tiposAvisoPanel() { return ['obras', 'cortes', 'eventos', 'emergencias', 'servicios']; }
    function tiposNotificacion() {
      return ['obras', 'cortes', 'eventos', 'emergencias', 'servicios', 'alarmas',
              'tributos', 'estacionamiento', 'reclamos'];
    }
    function frecuencias() { return ['inmediata', 'resumen_diario', 'solo_historial']; }
    function tiposArchivo() { return ['image/jpeg', 'image/png', 'application/pdf']; }

    // Evento de la bandeja escrito en el mismo lote: UNA sola llamada getAfter.
    // Quien la llama comprueba antes que id sea string.
    function eventoDelLote(id, tipo, refId) {
      let e = getAfter(/databases/$(database)/documents/eventos/$(id));
      return e != null && e.data.tipo == tipo && e.data.refId == refId;
    }

    // ===================== Catálogo público =====================
    match /municipal/info {
      allow read: if true;
      allow write: if esAdmin();
    }
    match /municipal/config {
      allow read: if true;
      allow create: if esAdmin();
      allow update: if esAdmin()
        && soloCambian(['simuladorActivo', 'simuladorCadaMin', 'horarioEstricto',
                        'avisoEstacionamientoMin', 'actualizadoEn'])
        && nuevo().simuladorActivo is bool
        && nuevo().horarioEstricto is bool
        && entero(nuevo().simuladorCadaMin, 1, 30)
        && entero(nuevo().get('avisoEstacionamientoMin', 5), 1, 14)
        && nuevo().actualizadoEn == request.time;
    }
    match /estaciones/{id} {
      allow read: if true;
      allow create, delete: if esAdmin();
      allow update: if esAdmin()
        && soloCambian(['bicicletas', 'estado', 'actualizadoEn'])
        && entero(nuevo().bicicletas, 0, viejo().capacidad)
        && nuevo().estado in ['operativa', 'fuera_de_servicio']
        && nuevo().actualizadoEn == request.time;
    }
    match /alarmas/{id} {
      allow read: if true;
      allow create, delete: if esAdmin();
      allow update: if esAdmin()
        && soloCambian(['activa', 'activadaEn', 'activacionId', 'actualizadoEn'])
        && nuevo().activa is bool
        && nuevo().actualizadoEn == request.time
        && (
          nuevo().activa == false
          || (viejo().activa == false
              && nuevo().activadaEn == request.time
              && nuevo().activacionId is string
              && eventoDelLote(nuevo().activacionId, 'alarma', id))
        );
    }
    match /zonasEstacionamiento/{id} {
      allow read: if true;
      allow write: if esAdmin();
    }
    match /contactos/{id} {
      allow read: if true;
      allow write: if esAdmin();
    }
    match /avisos/{id} {
      allow read: if true;
      allow create: if esAdmin()
        && claves(['titulo', 'cuerpo', 'detalle', 'tipo', 'zona', 'destino', 'enlace',
                   'creadoEn', 'autor', 'eventoId', 'vigenteHasta'])
        && texto(nuevo().titulo, 3, 100)
        && texto(nuevo().cuerpo, 10, 500)
        && texto(nuevo().detalle, 0, 3000)
        && nuevo().tipo in tiposAvisoPanel()
        && (nuevo().zona in zonas() || nuevo().zona == 'todas')
        && destinoValido(nuevo().destino)
        && (nuevo().enlace == null || (nuevo().enlace is string && nuevo().enlace.matches('^https://.{4,300}$')))
        && nuevo().creadoEn == request.time
        && nuevo().autor == 'municipalidad'
        && (nuevo().vigenteHasta == null || nuevo().vigenteHasta is timestamp)
        && nuevo().eventoId is string
        && eventoDelLote(nuevo().eventoId, 'aviso', id);
      allow update: if esAdmin() && soloCambian(['vigenteHasta'])
        && (nuevo().vigenteHasta == null || nuevo().vigenteHasta is timestamp);
      allow delete: if esAdmin();
    }

    // ===================== Administración =====================
    match /administradores/{uid} {
      allow get: if esDueno(uid);
      allow list, write: if false;           // se edita desde la consola
    }
    match /eventos/{id} {
      allow read: if esAdmin();
      allow create: if esAdmin()
        && claves(['tipo', 'refId', 'uid', 'origen', 'estado', 'intentos', 'creadoEn'])
        && nuevo().tipo in ['aviso', 'alarma', 'reclamo']
        && texto(nuevo().refId, 1, 120)
        && (nuevo().uid == null || texto(nuevo().uid, 1, 128))
        && (nuevo().tipo != 'reclamo' || nuevo().uid is string)
        && nuevo().origen == 'panel'
        && nuevo().estado == 'pendiente'
        && nuevo().intentos == 0
        && nuevo().creadoEn == request.time;
      allow update, delete: if false;        // solo la cuenta de servicio
    }

    // ===================== Bloqueo de patente (sin uid: protección de datos) =====================
    // Libre, vencido, o de una sesión que YA existía (exists, no existsAfter) bajo el uid de quien escribe.
    function bloqueoDisponible() {
      return resource == null
        || viejo().fin <= request.time
        || (viejo().sesionId == nuevo().sesionId
            && exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)/estacionamiento/$(viejo().sesionId)));
    }
    function sesionDelLoteCoincide(sesionId, patente, fin) {
      let s = getAfter(/databases/$(database)/documents/usuarios/$(request.auth.uid)/estacionamiento/$(sesionId));
      return s != null && s.data.patente == patente && s.data.fin == fin;
    }
    match /bloqueosPatente/{patente} {
      allow get: if autenticado();
      allow list, delete: if false;
      allow create, update: if autenticado()
        && claves(['sesionId', 'fin'])
        && idSolicitud(nuevo().sesionId)
        && nuevo().fin is timestamp
        && bloqueoDisponible()
        && sesionDelLoteCoincide(nuevo().sesionId, patente, nuevo().fin);
    }

    // ===================== Datos del vecino =====================
    match /usuarios/{uid} {
      function preferenciasValidas(p) {
        return p is map
          && p.keys().hasAll(['tipos', 'zonas', 'frecuencia', 'push'])
          && p.keys().hasOnly(['tipos', 'zonas', 'frecuencia', 'push'])
          && p.tipos is list && p.tipos.size() <= 9 && p.tipos.hasOnly(tiposNotificacion())
          && p.zonas is list && p.zonas.size() <= 4 && p.zonas.hasOnly(zonas())
          && p.frecuencia in frecuencias()
          && p.push is bool;
      }
      function cercaniaValida(c) {
        return c == null || (c is map
          && c.keys().hasAll(['alarmas', 'vence']) && c.keys().hasOnly(['alarmas', 'vence'])
          && c.alarmas is list && c.alarmas.size() <= 20
          && c.vence is timestamp
          && c.vence <= request.time + duration.value(61, 'm'));
      }
      function perfilValido(d) {
        return d.keys().hasOnly(['nombre', 'anonimo', 'creadoEn', 'actualizadoEn', 'altaEn',
                                 'preferencias', 'cercania', 'privacidadAceptadaEn'])
          && texto(d.nombre, 0, 80)
          && d.anonimo is bool
          && preferenciasValidas(d.preferencias)
          && cercaniaValida(d.get('cercania', null))
          && (d.get('privacidadAceptadaEn', null) == null || d.privacidadAceptadaEn is timestamp);
      }

      allow get: if esDueno(uid);
      allow list: if false;
      allow create: if esDueno(uid) && perfilValido(nuevo())
        && !('altaEn' in nuevo())
        && nuevo().creadoEn == request.time
        && nuevo().actualizadoEn == request.time;
      allow update: if esDueno(uid) && perfilValido(nuevo())
        && soloCambian(['nombre', 'anonimo', 'preferencias', 'cercania', 'privacidadAceptadaEn', 'actualizadoEn'])
        && nuevo().actualizadoEn == request.time;
      allow delete: if false;                // la baja la hace vecino/baja (Supabase)

      function rutaPropia(col, id) {
        return /databases/$(database)/documents/usuarios/$(uid)/$(col)/$(id);
      }

      // ---------- Tributos (T1-T3) ----------
      function pagoDelTributo(tributoId, pagoId, importe, comprobante) {
        let p = getAfter(rutaPropia('pagos', pagoId));
        return p != null && p.data.tipo == 'tributo' && p.data.refId == tributoId
          && p.data.importe == importe && p.data.comprobante == comprobante;
      }
      match /tributos/{tributoId} {
        allow read: if esDueno(uid);
        allow create, delete: if false;
        allow update: if esDueno(uid)
          && viejo().pagadoEn == null
          && soloCambian(['pagadoEn', 'comprobante', 'pagoId'])
          && nuevo().pagadoEn == request.time
          && idSolicitud(nuevo().pagoId)
          && pagoDelTributo(tributoId, nuevo().pagoId, viejo().importe, nuevo().comprobante);
      }

      // ---------- Pagos (T2, E2, E4). Idempotencia: id = requestId, solo create ----------
      function pagoTributoValido(pagoId, d) {
        let antes = get(rutaPropia('tributos', d.refId));
        let despues = getAfter(rutaPropia('tributos', d.refId));
        return d.comprobante.matches('^REC-[A-Z0-9]{8}$')
          && antes != null && antes.data.pagadoEn == null
          && d.importe == antes.data.importe
          && despues.data.pagoId == pagoId;
      }
      function pagoSesionValido(pagoId, d) {
        let s = getAfter(rutaPropia('estacionamiento', pagoId));
        return d.comprobante.matches('^EST-[A-Z0-9]{8}$')
          && d.refId == pagoId
          && s != null && s.data.importe == d.importe && s.data.ultimoPagoId == pagoId;
      }
      function pagoExtensionValido(pagoId, d) {
        let antes = get(rutaPropia('estacionamiento', d.refId));
        let despues = getAfter(rutaPropia('estacionamiento', d.refId));
        return d.comprobante.matches('^EXT-[A-Z0-9]{8}$')
          && antes != null && despues != null
          && despues.data.ultimoPagoId == pagoId
          && d.importe == despues.data.importe - antes.data.importe;
      }
      match /pagos/{pagoId} {
        allow read: if esDueno(uid);
        allow update, delete: if false;
        allow create: if esDueno(uid) && idSolicitud(pagoId)
          && claves(['tipo', 'refId', 'importe', 'comprobante', 'proveedor', 'creadoEn'])
          && nuevo().proveedor == 'pasarela-simulada'
          && nuevo().creadoEn == request.time
          && entero(nuevo().importe, 1, 10000000)
          && texto(nuevo().refId, 1, 80)
          && nuevo().comprobante is string
          && (
            (nuevo().tipo == 'tributo' && pagoTributoValido(pagoId, nuevo()))
            || (nuevo().tipo == 'estacionamiento' && pagoSesionValido(pagoId, nuevo()))
            || (nuevo().tipo == 'extension' && pagoExtensionValido(pagoId, nuevo()))
          );
      }

      // ---------- Estacionamiento medido (E1-E4) ----------
      function minutosValidos(m) { return m is int && m >= 15 && m <= 240 && m % 15 == 0; }
      function zonaEst(zonaId) {
        return get(/databases/$(database)/documents/zonasEstacionamiento/$(zonaId)).data;
      }
      function finCercano(fin, m) {   // tolerancia de 2 minutos por diferencia de reloj del teléfono
        return fin is timestamp
          && fin > request.time + duration.value(m - 2, 'm')
          && fin < request.time + duration.value(m + 2, 'm');
      }
      function enHorarioZona(z, c) {
        return c.horarioEstricto == false
          || (ahoraLocal().dayOfWeek() in z.horario.dias
              && ahoraLocal().hours() >= z.horario.desde
              && ahoraLocal().hours() < z.horario.hasta);
      }
      function bloqueoTomado(sesionId, patente, fin) {
        let b = getAfter(/databases/$(database)/documents/bloqueosPatente/$(patente));
        return b != null && b.data.sesionId == sesionId && b.data.fin == fin;
      }
      function inicioValido(sesionId, d) {
        let z = zonaEst(d.zonaId);
        let c = config();
        return d.importe * 60 == z.tarifaHora * d.minutos
          && d.zonaNombre == z.nombre
          && d.zona == z.zona
          && enHorarioZona(z, c)
          && bloqueoTomado(sesionId, d.patente, d.fin)
          && existsAfter(rutaPropia('pagos', sesionId));
      }
      function extensionValida(sesionId, a, d) {
        let z = zonaEst(a.zonaId);
        return soloCambian(['minutos', 'importe', 'fin', 'extensiones', 'ultimoPagoId', 'avisoPorVencer', 'actualizadoEn'])
          && minutosValidos(d.minutos)
          && d.minutos > a.minutos
          && d.fin == a.fin + duration.value(d.minutos - a.minutos, 'm')
          && (d.importe - a.importe) * 60 == z.tarifaHora * (d.minutos - a.minutos)
          && d.extensiones == a.extensiones + 1
          && d.avisoPorVencer == false
          && idSolicitud(d.ultimoPagoId)
          && d.ultimoPagoId != a.ultimoPagoId
          && existsAfter(rutaPropia('pagos', d.ultimoPagoId))
          && bloqueoTomado(sesionId, a.patente, d.fin);
      }
      // Terminar antes de tiempo (sin reintegro): fin = hora del servidor, y el bloqueo igual.
      function finalizacionValida(sesionId, a, d) {
        return soloCambian(['fin', 'actualizadoEn'])
          && d.fin == request.time
          && bloqueoTomado(sesionId, a.patente, d.fin);
      }
      match /estacionamiento/{sesionId} {
        allow read: if esDueno(uid);
        allow delete: if false;
        allow create: if esDueno(uid) && idSolicitud(sesionId)
          && claves(['patente', 'zonaId', 'zonaNombre', 'zona', 'minutos', 'importe', 'inicio', 'fin',
                     'extensiones', 'ultimoPagoId', 'avisoPorVencer', 'avisoFinalizado', 'actualizadoEn'])
          && nuevo().patente is string
          && nuevo().patente.matches('^([A-Z]{3}[0-9]{3}|[A-Z]{2}[0-9]{3}[A-Z]{2})$')
          && texto(nuevo().zonaId, 1, 40)
          && minutosValidos(nuevo().minutos)
          && nuevo().importe is int
          && nuevo().inicio == request.time
          && nuevo().actualizadoEn == request.time
          && finCercano(nuevo().fin, nuevo().minutos)
          && nuevo().extensiones == 0
          && nuevo().ultimoPagoId == sesionId
          && nuevo().avisoPorVencer == false
          && nuevo().avisoFinalizado == false
          && inicioValido(sesionId, nuevo());
        allow update: if esDueno(uid)
          && viejo().fin > request.time
          && nuevo().actualizadoEn == request.time
          && (extensionValida(sesionId, viejo(), nuevo())
              || finalizacionValida(sesionId, viejo(), nuevo()));
      }

      // ---------- Reclamos (R1-R4) ----------
      function adjuntoValido(reclamoId, a) {
        return a is map
          && a.keys().hasAll(['ruta', 'nombre', 'tipo', 'tamano'])
          && a.keys().hasOnly(['ruta', 'nombre', 'tipo', 'tamano'])
          && a.ruta is string
          && a.ruta.matches('^' + uid + '/' + reclamoId + '/[0-2]-[a-f0-9]{12}[.](jpg|png|pdf)$')
          && texto(a.nombre, 1, 100)
          && a.tipo in tiposArchivo()
          && entero(a.tamano, 1, 2097152);
      }
      function adjuntosValidos(reclamoId, l) {
        return l is list && l.size() <= 3
          && (l.size() < 1 || adjuntoValido(reclamoId, l[0]))
          && (l.size() < 2 || adjuntoValido(reclamoId, l[1]))
          && (l.size() < 3 || adjuntoValido(reclamoId, l[2]));
      }
      function transicionValida(a, b) {
        return (a == 'recibido' && b == 'en_proceso') || (a == 'en_proceso' && b == 'resuelto');
      }
      function eventoDelReclamo(eventoId, reclamoId) {
        let e = getAfter(/databases/$(database)/documents/eventos/$(eventoId));
        return e != null && e.data.tipo == 'reclamo' && e.data.refId == reclamoId && e.data.uid == uid;
      }
      match /reclamos/{reclamoId} {
        allow read: if esDueno(uid) || esAdmin();
        allow delete: if false;
        allow create: if esDueno(uid) && idSolicitud(reclamoId)
          && claves(['codigo', 'categoria', 'direccion', 'descripcion', 'estacionId', 'adjuntos', 'estado',
                     'cronologia', 'notaMunicipal', 'creadoEn', 'actualizadoEn', 'ultimoEventoId'])
          && nuevo().codigo.matches('^R-[A-Z0-9]{6}$')
          && nuevo().categoria in categorias()
          && texto(nuevo().direccion, 5, 160)
          && texto(nuevo().descripcion, 10, 1500)
          && (nuevo().estacionId == null || texto(nuevo().estacionId, 1, 40))
          && adjuntosValidos(reclamoId, nuevo().adjuntos)
          && nuevo().estado == 'recibido'
          && nuevo().cronologia.keys().hasOnly(['recibido'])
          && nuevo().cronologia.recibido == request.time
          && nuevo().notaMunicipal == null
          && nuevo().ultimoEventoId == null
          && nuevo().creadoEn == request.time
          && nuevo().actualizadoEn == request.time;
        allow update: if esAdmin()
          && soloCambian(['estado', 'cronologia', 'notaMunicipal', 'actualizadoEn', 'ultimoEventoId'])
          && transicionValida(viejo().estado, nuevo().estado)
          && nuevo().cronologia.diff(viejo().cronologia).affectedKeys().hasOnly([nuevo().estado])
          && nuevo().cronologia[nuevo().estado] == request.time
          && textoOpcional(nuevo().notaMunicipal, 300)
          && nuevo().actualizadoEn == request.time
          && nuevo().ultimoEventoId is string
          && eventoDelReclamo(nuevo().ultimoEventoId, reclamoId);
      }

      // ---------- Notificaciones personales (N3) ----------
      match /notificaciones/{notifId} {
        allow read: if esDueno(uid);
        allow create: if esDueno(uid)
          && claves(['titulo', 'cuerpo', 'tipo', 'zona', 'destino', 'enlace', 'creadoEn', 'leida', 'leidaEn', 'origen'])
          && nuevo().tipo in ['tributos', 'estacionamiento', 'reclamos']
          && texto(nuevo().titulo, 3, 100)
          && texto(nuevo().cuerpo, 3, 500)
          && nuevo().zona == null
          && nuevo().enlace == null
          && destinoValido(nuevo().destino)
          && nuevo().creadoEn == request.time
          && nuevo().leida == false
          && nuevo().leidaEn == null
          && nuevo().origen == 'vecino';
        allow update: if esDueno(uid)
          && soloCambian(['leida', 'leidaEn'])
          && nuevo().leida == true
          && nuevo().leidaEn == request.time;
        allow delete: if esDueno(uid);
      }
      // set() sobre un documento existente se evalúa como update: se permite para que marcar sea idempotente.
      match /avisosLeidos/{avisoId} {
        allow read, delete: if esDueno(uid);
        allow create, update: if esDueno(uid) && claves(['leidoEn']) && nuevo().leidoEn == request.time;
      }
      match /dispositivos/{dispositivoId} {
        allow read, delete: if esDueno(uid);
        allow create, update: if esDueno(uid)
          && dispositivoId.matches('^[a-f0-9]{32}$')
          && claves(['token', 'plataforma', 'actualizadoEn'])
          && texto(nuevo().token, 20, 4096)
          && texto(nuevo().plataforma, 1, 40)
          && nuevo().actualizadoEn == request.time;
      }
    }

    // Lectura administrativa por grupo de colecciones (panel municipal).
    match /{ruta=**}/reclamos/{reclamoId} {
      allow read: if esAdmin();
    }
  }
}
```

Lo que cada regla demuestra (para el informe y las pruebas):

| Regla | Requisito o riesgo |
|---|---|
| `pagos` crea solo una vez con id = requestId | Idempotencia del pago (T2, E2) |
| `importe == get(tributos/…).importe` | El importe no lo decide el navegador (T2) |
| `importe * 60 == tarifaHora * minutos` con `get` sobre la zona | Importe del estacionamiento (E2) |
| `bloqueosPatente` con `getAfter` en el mismo lote y sin `uid` | Una sola sesión activa por patente entre cuentas (E2), sin exponer quién estaciona |
| `enHorarioZona` con `ahoraLocal()` y `municipal/config.horarioEstricto` | Horario de la zona (E1, SEG-04) |
| Extensión con `fin == viejo.fin + duration` y sesión no vencida | E4 y SEG-09 |
| Finalización con `fin == request.time` y bloqueo liberado en el mismo lote | Terminar antes y liberar la patente |
| Reclamo inicial `recibido` y transiciones solo de admin con evento | R3 y SEG-01 |
| Adjuntos con ruta `uid/reclamoId/...` | Nadie enlaza archivos de otro (R2) |
| `perfilValido` sin correo | Protección de datos |
| `eventoDelLote(...)` en alarmas, avisos y reclamos | Toda acción del panel deja su evento para el push |
| `esAdmin()` exige proveedor no anónimo | Mismo criterio que Supabase |
| Cada documento leído una vez con `let` | Límite de 10 llamadas por operación sin depender de la caché |

**Transacciones y fallas sin conexión.** Pagar, estacionar, extender y finalizar usan `runTransaction`, que falla sin conexión (no se encola un pago). Crear un reclamo sin adjuntos usa `writeBatch`, que **sí** se encola con la caché persistente y se envía al volver la red. Como la promesa de `commit()` no se resuelve hasta que el servidor confirma, el repositorio **no la espera sin red**: ver `crearReclamo` en 4.4.

**Comprobado en el emulador** (sonda del crítico de factibilidad, `scratchpad/sonda-reglas/`): `rutaPropia` con el `uid` del `match`; `getAfter` y `existsAfter` en lotes; `== request.time` con `serverTimestamp()`; `cronologia[nuevo().estado]`; `timestamp - duration`; `dayOfWeek()` = 1 el lunes y 7 el domingo. La prueba de reglas de estacionamiento deja fijado `dayOfWeek()` como garantía.

---

## 4. Capa de datos del cliente (`src/datos/`, WP3)

### 4.1 Archivos

| Archivo | Contenido |
|---|---|
| `src/datos/repositorio.js` | Suscripciones y comandos (tablas 4.3 y 4.4). Único módulo que importa `firebase/firestore` fuera de `src/firebase/` |
| `src/datos/mapeadores.js` | `desdeDoc(snap)` y uno por entidad. Convierte `Timestamp` a ms con `snap.data({ serverTimestamps: 'estimate' })`, agrega `id`, `pendiente` (= `snap.metadata.hasPendingWrites`, para "Pendiente de envío") y, en grupos de colecciones, `uid` (de `ref.parent.parent.id`). Puro: se prueba en Node |
| `src/datos/errores.js` | `class ErrorApp`, `CODIGOS`, `MENSAJES`, `desdeFirebase(e)`. **No importa nada**: lo usan WP4 y WP6 sin crear ciclos |
| `src/datos/almacen.js` | Almacén con `useSyncExternalStore`, `ProveedorMunicipal`, `useMunicipal(selector)` y las acciones de 4.5 |
| `src/datos/sesion.js` | Orquestación que cruza Auth, mensajería, repositorio y Supabase (4.7). Rompe el ciclo `auth → mensajeria → repositorio → auth` |
| `src/datos/useComando.js` | Hook de comandos con estado local de ocupado y error (4.6) |
| `src/datos/useAdmin.js` | Suscripciones del panel (solo se montan en `PanelMunicipal`, 4.5) |
| `src/datos/useAhora.js` | `useAhora(intervaloMs = 1000)` → ms actual, para temporizadores |
| `src/plataforma/red.web.js` y `red.js` | `useConexion()` → `{ enLinea }` con los eventos `online`/`offline`; `estaEnLinea()` (lo mismo fuera de React); `marcarListo()` pone `data-listo="true"` en `<html>`; `pestanaOculta()` → `document.hidden`. El stub nativo devuelve `{ enLinea: true }`, `true`, no hace nada y `false` |
| `src/plataforma/ubicacion.web.js` y `ubicacion.js` | `ubicar({ precision }) → Promise<{ lat, lng }>` (port de `heredado:platform.web.js:1-16`) y `seguirUbicacion(cb, alFallar) → detener` con `watchPosition`. Stub que lanza `no-soportado`. Es de WP3 porque el almacén sostiene el seguimiento de cercanía (4.5); Bicicletas y Alarmas lo usan |

### 4.2 Errores (`src/datos/errores.js`)

```js
export class ErrorApp extends Error {
  constructor(codigo, mensaje = MENSAJES[codigo], { campo = null, datos = null, causa = null } = {}) { /* … */ }
}
```

| Código | Cuándo | Mensaje por defecto |
|---|---|---|
| `sin-sesion` | No hay usuario, o Supabase responde 401 `sin-sesion` | "Ingresá para continuar." |
| `sin-conexion` | `unavailable`, `deadline-exceeded`, transacción sin red, fetch caído, adjuntos sin red | "No hay conexión. Revisá tu red e intentá de nuevo." |
| `app-check` | Supabase responde 401 `app-check` (modo `exigir`) | "No pudimos verificar la aplicación. Recargá la página." |
| `permiso` | `permission-denied` sin causa más precisa | "No se pudo validar la operación." |
| `validacion` | `ErrorDominio` (lleva `campo`) | El mensaje del dominio |
| `no-encontrado` | Documento inexistente | "No encontramos el registro." |
| `ya-pagado` | Tributo con `pagadoEn` | "Este cedulón ya está pagado." |
| `patente-ocupada` | Bloqueo vigente (lleva `datos.fin`) | "La patente ya tiene una sesión activa hasta las HH:MM." |
| `fuera-de-horario` | `enHorario` falso con `horarioEstricto` | "La zona está fuera de su horario de cobro." |
| `sesion-vencida` | Extender o finalizar una sesión terminada | "La sesión venció. Iniciá una nueva." |
| `maximo-alcanzado` | Más de 240 minutos | "El máximo por sesión es de 4 horas." |
| `adjunto-invalido` | Rechazo de `adjuntos/subir` | El mensaje del servidor |
| `cuenta-existente` | `auth/credential-already-in-use` al vincular | "Esa cuenta de Google ya tiene datos. ¿Querés entrar con ella?" |
| `popup-bloqueado` | Popup de Google bloqueado y sin redirect | "El navegador bloqueó la ventana de Google." |
| `no-soportado` | API del navegador ausente | Lo arma quien lo lanza |
| `cuota` | `resource-exhausted` o HTTP 429 | "El servicio está saturado. Probá en unos minutos." |
| `servidor` | HTTP 5xx de Supabase | "El servicio no respondió. Intentá nuevamente." |
| `desconocido` | Resto | "No se pudo completar la operación." |

`desdeFirebase(e)` recibe errores de Firestore, Auth y fetch, y devuelve un `ErrorApp`. Nunca muestra códigos crudos como `[400]` (UIX-07). Un reclamo guardado sin red **no es un error**: es un resultado con `enCola: true` (4.4).

### 4.3 Suscripciones (todas devuelven la función para cancelar)

Firma común: `suscribirX(...args, alCambiar(datos, meta), alFallar(errorApp)) → () => void`, con `meta = { desdeCache, pendientes }` tomado de `snapshot.metadata` (`includeMetadataChanges: true` en las colecciones donde el vecino escribe, para ver "Pendiente de envío").

| Función | Consulta | Entrega |
|---|---|---|
| `suscribirMunicipal` | docs `municipal/info` y `municipal/config` | `{ info, config }` cuando llegan los dos |
| `suscribirEstaciones` | `estaciones` | `Estacion[]` ordenadas por nombre en el cliente |
| `suscribirAlarmas` | `alarmas` | `Alarma[]` |
| `suscribirZonasEstacionamiento` | `zonasEstacionamiento` | `ZonaEstacionamiento[]` |
| `suscribirContactos` | `contactos` | `Contacto[]` ordenados por `orden` |
| `suscribirAvisos(limite = 50)` | `avisos` orderBy `creadoEn` desc | `Aviso[]` |
| `suscribirPerfil(uid)` | doc `usuarios/{uid}` | `Perfil \| null` |
| `suscribirEsAdmin(uid)` | doc `administradores/{uid}` | `boolean` |
| `suscribirTributos(uid)` | `tributos` orderBy `vence` asc | `Tributo[]` |
| `suscribirPagos(uid, limite = 20)` | `pagos` orderBy `creadoEn` desc | `Pago[]` |
| `suscribirReclamos(uid, limite = 20)` | `reclamos` orderBy `creadoEn` desc | `Reclamo[]` (con `pendiente`) |
| `suscribirEstacionamiento(uid, limite = 20)` | `estacionamiento` orderBy `inicio` desc | `Sesion[]` |
| `suscribirNotificaciones(uid, limite = 50)` | `notificaciones` orderBy `creadoEn` desc | `Notificacion[]` |
| `suscribirAvisosLeidos(uid)` | `avisosLeidos` limit 300 | `Set<string>` |
| `suscribirReclamosAdmin(limite = 50)` | grupo `reclamos` orderBy `creadoEn` desc | `Reclamo[]` con `uid` |
| `suscribirEventos(limite = 20)` | `eventos` orderBy `creadoEn` desc | `Evento[]` |

**Paginación** (R4, N3 y T3 más allá de la primera página; hallazgos FUN-15 y SEG-13): no hay `getDocs` con cursor. La acción `cargarMas(coleccion)` del almacén (4.5) sube en 20 el `limit` de la escucha de esa colección y la vuelve a abrir; así los elementos viejos siguen en tiempo real y no hay duplicados. `hayMas[coleccion] = items.length === limite`. Las lecturas extra quedan acotadas porque solo se pagina a pedido.

### 4.4 Comandos

Todos leen el `uid` de `auth.currentUser` (si falta, `sin-sesion`) y validan primero con `shared/dominio.mjs`, lanzando `validacion` con `campo` antes de tocar la red. **Los comandos que tocan `usuarios/{uid}`** (`guardarPreferencias`, `actualizarCercania`, `aceptarPrivacidad`, `registrarDispositivo`, `eliminarDispositivo`) esperan antes `altaLista(uid)`, la promesa memorizada de `asegurarAlta`, para no hacer `update` sobre un perfil que todavía no existe.

| Función | Firma | Documentos que toca | Devuelve | Errores |
|---|---|---|---|---|
| `asegurarAlta` | `(usuario, perfil) → Promise<{ creado }>` | Memoriza una promesa por `uid` y `anonimo` (`altaLista(uid)` devuelve la última). Llama `vecino/alta` **solo** si `!perfil?.altaEn` o `perfil.anonimo !== usuario.anonimo` (vínculo reciente). Si la llamada falla y el perfil no existe, crea `usuarios/{uid}` con preferencias por defecto; la promesa se resuelve igual | `{ creado }` | `sin-conexion`, `servidor` (no bloquean la app) |
| `guardarPreferencias` | `(preferencias) → Promise<void>` | update `usuarios/{uid}` {preferencias, actualizadoEn} | | `validacion`, `permiso` |
| `actualizarCercania` | `(alarmaIds: string[] \| null, minutos) → Promise<void>` | update `usuarios/{uid}.cercania` = {alarmas, vence: ahora + `min(minutos, 60)`} o null | | `validacion` |
| `aceptarPrivacidad` | `() → Promise<void>` | update `privacidadAceptadaEn` | | |
| `crearReclamo` | `({ categoria, direccion, descripcion, estacionId, archivos }, requestId, { alProgreso }) → Promise<{ id, codigo, enCola }>` | Con `archivos`: sin red lanza `sin-conexion`; con red, `adjuntos/subir` **un archivo por llamada** (`alProgreso(i, total)` para "Subiendo archivos (1 de 3)"). Después `writeBatch`: set `reclamos/{requestId}` y `notificaciones/recibido-{requestId}` "Reclamo recibido". **No espera el `commit` sin red:** si `!estaEnLinea()`, o si el `commit` no resolvió en 2,5 s, devuelve `{ id, codigo, enCola: true }` y deja la promesa corriendo. Si el `commit` falla con `permission-denied`, lee `reclamos/{requestId}`: si existe (reintento), lo devuelve; si no, lanza `permiso` | `{ id, codigo, enCola }` | `validacion` (campo), `adjunto-invalido`, `sin-conexion` (solo con adjuntos), `permiso` |
| `urlAdjunto` | `(uid, ruta) → Promise<{ url, venceEn }>` | `adjuntos/url` | URL firmada por 5 min | `permiso`, `no-encontrado` |
| `pagarTributo` | `(tributoId, requestId) → Promise<Pago>` | `runTransaction`: lee `tributos/{id}` y `pagos/{requestId}` (si existe, lo devuelve); crea `pagos/{requestId}`, actualiza el tributo {pagadoEn, comprobante, pagoId} y crea la notificación personal `pago-{requestId}` "Pago registrado" | `Pago` | `ya-pagado`, `no-encontrado`, `sin-conexion`, `permiso` |
| `iniciarEstacionamiento` | `({ zonaId, patente, minutos }, requestId) → Promise<Sesion>` | `runTransaction`: lee `bloqueosPatente/{patente}` (vigente → `patente-ocupada` con `datos.fin`), `zonasEstacionamiento/{zonaId}` y `municipal/config`; crea `estacionamiento/{requestId}` con `fin = Date.now() + minutos`, set `bloqueosPatente/{patente}` = {sesionId, fin} y crea `pagos/{requestId}` tipo `estacionamiento` | `Sesion` | `validacion` (campos `patente` y `minutos`), `fuera-de-horario`, `patente-ocupada`, `sin-conexion`, `permiso` |
| `extenderEstacionamiento` | `(sesionId, minutosExtra, requestId) → Promise<Sesion>` | `runTransaction`: lee la sesión (vencida → `sesion-vencida`; total mayor a 240 → `maximo-alcanzado`) y la zona; actualiza la sesión {minutos, importe, fin, extensiones + 1, ultimoPagoId, avisoPorVencer: false, actualizadoEn}, el bloqueo {sesionId, fin} y crea `pagos/{requestId}` tipo `extension` | `Sesion` | los anteriores |
| `finalizarEstacionamiento` | `(sesionId) → Promise<void>` | `runTransaction`: lee la sesión (vencida → `sesion-vencida`); update de la sesión {fin: serverTimestamp, actualizadoEn: serverTimestamp} y del bloqueo {sesionId, fin: serverTimestamp}. Sin reintegro. El aviso `finalizado` lo genera la tarea `minuto` | | `sesion-vencida`, `sin-conexion`, `permiso` |
| `marcarLeida` | `(notificacion) → Promise<void>` | Si ya está leída, no hace nada. Si `fuente === 'aviso'`: set `avisosLeidos/{id}`. Si no: update `notificaciones/{id}` {leida, leidaEn} | | |
| `marcarTodasLeidas` | `(notificaciones) → Promise<void>` | Solo las no leídas, en lotes de hasta 400 operaciones | | |
| `registrarDispositivo` | `(token, tokenAnterior?) → Promise<void>` | set `dispositivos/{sha256(token) 32 hex}`, borra el del `tokenAnterior` si cambió y pone `preferencias.push = true` | | |
| `eliminarDispositivo` | `(token) → Promise<void>` | delete del dispositivo; lista `dispositivos` y pone `preferencias.push = false` **solo si no queda ninguno** | | |
| `borrarDatosEnServidor` | `() → Promise<void>` | `vecino/baja` (Supabase), que borra también el usuario de Auth. La orquestación completa está en `sesion.js` | | `sin-conexion`, `servidor` |
| **Admin** `avanzarReclamo` | `({ uid, reclamoId, estadoActual, nota }, requestId) → Promise<void>` | Lote: update del reclamo {estado siguiente, `cronologia.<estado>`: serverTimestamp, notaMunicipal, actualizadoEn, ultimoEventoId: `ev-${requestId}`} y create `eventos/ev-${requestId}` {tipo 'reclamo', refId, uid}. Después `despacharEvento` sin esperar | | `permiso`, `validacion` |
| **Admin** `cambiarAlarma` | `({ alarmaId, activa }, requestId) → Promise<void>` | Activar: lote alarma {activa, activadaEn, activacionId: `ev-${requestId}`, actualizadoEn} + `eventos/ev-${requestId}`; luego `despacharEvento`. Desactivar: solo la alarma | | |
| **Admin** `cambiarBicicletas` | `({ estacionId, bicicletas, estado }) → Promise<void>` | update `estaciones/{id}` | | `validacion` |
| **Admin** `publicarAviso` | `({ titulo, cuerpo, detalle, tipo, zona, destino, enlace, vigenteHoras }, requestId) → Promise<{ id }>` | Lote: set `avisos/${requestId}` (eventoId `ev-${requestId}`) + `eventos/ev-${requestId}`; luego `despacharEvento` | | `validacion` |
| **Admin** `configurarDemo` | `({ simuladorActivo, simuladorCadaMin, horarioEstricto, avisoEstacionamientoMin }) → Promise<void>` | update `municipal/config` | | `validacion` |
| **Admin** `restablecerDemo` | `() → Promise<void>` | Updates permitidos: bicicletas al valor de `shared/catalogo.mjs`, todas las alarmas inactivas y `config` a sus valores iniciales | | |
| **Admin** `ejecutarTarea` | `(tarea: 'simulador' \| 'diaria' \| 'resumen') → Promise<Cambios \| Resumen>` | `tareas` con `{ tarea }` | `Cambios` para `simulador`; `{ notificaciones, push }` para las otras | `servidor`, `permiso` |
| `despacharEvento` | `(eventoId) → Promise<void>` | `despachar` con `{ eventoId }`; registra el error y no lo propaga | | |

`Cambios = { cambios: Array<{ tipo: 'bicicletas' | 'reclamo', id: string, uid?: string, antes: number | string, despues: number | string }> }` (el simulador ya no toca alarmas, 6.8).

Comprobantes: `comprobante(prefijo, requestId)` de `shared/dominio.mjs` (`REC`, `EST` o `EXT` más 8 caracteres del requestId en mayúscula), equivalente al adaptador `payment` de `heredado:service.mjs:185-194`. La pasarela es simulada y la interfaz lo dice ("Pago simulado, sin cargos reales", FUN-11).

### 4.5 Almacén y hook (reemplaza `heredado:src/useMunicipal.js`, sin polling)

`<ProveedorMunicipal usuario={usuario}>` abre todas las suscripciones de catálogo y del vecino al montarse y las cierra al desmontarse o al cambiar el uid. Cada `alCambiar` actualiza una porción del estado. No hay `setInterval` ni relecturas completas. **Cada vez que cambia el uid o `usuario.anonimo`** (ingreso, vínculo, cambio de cuenta) y cuando llega el perfil, llama `asegurarAlta(usuario, perfil)`.

```ts
type EstadoMunicipal = {
  listo: boolean;                 // catálogo (estaciones + municipal) y perfil recibidos al menos una vez
  desdeCache: boolean;            // el último snapshot del perfil salió de la caché
  errores: Record<string, ErrorApp>;   // por porción: 'catalogo', 'perfil', 'tributos'…
  usuario: Usuario;               // de useSesion()
  esAdmin: boolean;
  info: Info | null; config: ConfigDemo | null;   // config.avisoEstacionamientoMin con respaldo 5
  estaciones: Estacion[]; alarmas: Alarma[]; zonas: ZonaEstacionamiento[];
  contactos: Contacto[]; avisos: Aviso[];
  perfil: Perfil | null;
  preferencias: Preferencias;     // perfil.preferencias o PREFERENCIAS_POR_DEFECTO
  tributos: (Tributo & { estado: 'pagado' | 'vencido' | 'por_vencer' | 'pendiente' })[];
  pagos: Pago[]; reclamos: Reclamo[]; sesiones: Sesion[];
  notificaciones: NotificacionUnida[];   // personales + avisos visibles, desc por creadoEn
  noLeidas: number;
  hayMas: { reclamos: boolean; notificaciones: boolean; pagos: boolean; estacionamiento: boolean };
  cercania: { activa: boolean; siguiendo: boolean; error: ErrorApp | null };  // activa = perfil.cercania.vence > ahora
  alerta: { id: string; titulo: string; cuerpo: string; destino: string | null; tono: 'info' | 'alerta' } | null;
};
type NotificacionUnida = {
  id: string; fuente: 'aviso' | 'personal';   // "fuente" para no confundir con el campo origen del documento
  titulo: string; cuerpo: string; detalle: string | null;
  tipo: string; zona: string | null; destino: string | null; enlace: string | null;
  creadoEn: number; leida: boolean; clave: string;   // clave = claveEntrega (Anexo A)
};
```

Acciones exportadas (funciones del módulo, no del estado): `cargarMas(coleccion)`, `activarCercania()`, `desactivarCercania()`, `descartarAlerta()`, `registrarEntrega(clave) → boolean`.

- `useMunicipal(selector = s => s)` usa `useSyncExternalStore`. Las pantallas seleccionan solo lo que necesitan para no volver a dibujar todo con cada cambio. Lanza un error claro si se usa fuera del proveedor.
- Derivados memorizados en el almacén: `tributos[].estado` con `estadoTributo`, y `notificaciones`/`noLeidas` con `unirNotificaciones` de `shared/notificaciones.mjs`.
- **Cercanía (A3) vive en el almacén, no en la pantalla.** `activarCercania()` pide la ubicación con `seguirUbicacion` de `plataforma/ubicacion`, calcula `alarmasCercanas(alarmas, pos, radioAlarmaKm)` (`radio_alarma_km` de `leerConfig()`), llama `actualizarCercania(ids, intervaloCercaniaMin)` cuando cambia el conjunto o cada `intervaloCercaniaMin / 2` minutos y guarda la posición solo en memoria. `desactivarCercania()` detiene el seguimiento y llama `actualizarCercania(null)`. El estado `cercania.activa` se deriva de `perfil.cercania.vence > ahora`, así que sobrevive al cambio de pantalla y a la recarga; si está activa al recargar, el almacén retoma el seguimiento.
- **Alertas en vivo y deduplicación.** El almacén es el **único dueño** del conjunto de claves ya mostradas. Después de la primera carga, cuando llega un documento nuevo que no sale de la caché (en `notificaciones`, en `avisos`, una alarma que pasa a activa, un reclamo con `ultimoEventoId` nuevo o una sesión que entra en el umbral `config.avisoEstacionamientoMin`), calcula su `claveEntrega` y llama `registrarEntrega(clave)`. Solo si devuelve `true` (clave nueva) evalúa `decidirEntrega(...)` con la posición en memoria; si corresponde aviso inmediato publica `alerta` (el marco muestra el aviso flotante y la limpia con `descartarAlerta()`) y, si `pestanaOculta()` y hay permiso, llama `mostrarNotificacionLocal({ ..., tag: clave })`. Como el push del servidor usa la misma clave como `tag`, el sistema operativo muestra una sola notificación por clave. Las claves que llegan con la primera carga se registran sin alertar.
- Al quedar `listo` por primera vez llama `registrarInicioConDatos({ desdeCache })` y `marcarListo()`.

`useAdmin()` (`src/datos/useAdmin.js`) → `{ reclamos: Reclamo[] (con uid, últimos 50), eventos: Evento[] (últimos 20), cargando: boolean, error: ErrorApp | null }`. El panel filtra `reclamos` por estado en el cliente.

### 4.6 `useComando` (errores locales por operación; corrige COD-03 y UIX-04)

```js
const aviso = useAvisoFlotante();                    // lo importa la pantalla, no el hook
const pago = useComando(repositorio.pagarTributo, {
  alExito: (resultado) => aviso.mostrar('Pago registrado'),   // opcional
  evento: EVENTOS.TRIBUTO_PAGADO,    // analytics (opcional)
  traza: TRAZAS.PAGO_TRIBUTO,        // performance (opcional)
});
pago.ejecutar(...args)   // → Promise<resultado | null>; nunca lanza
pago.ocupado             // boolean
pago.error               // ErrorApp | null
pago.errorDe('patente')  // string | null: mensaje del campo para mostrarlo debajo del Campo
pago.limpiar()
```

Evita la doble ejecución mientras `ocupado` es verdadero (como el candado de `heredado:useMunicipal.js:72-73`). Llama `alExito(resultado)` si se pasó y registra `error_operacion` si falla. El error queda en el comando y en la pantalla que lo usa: no hay cartel de error global. `useComando` **no importa nada de WP5**.

### 4.7 Orquestación de sesión y push (`src/datos/sesion.js`)

Es el único lugar que combina `src/firebase/auth.js`, `src/firebase/mensajeria*.js`, el repositorio y `llamarFuncion`. Así el grafo de imports queda sin ciclos: `firebase/*` no importa nada de `datos/` salvo `errores.js`.

| Función | Hace |
|---|---|
| `activarPush()` | `obtenerTokenPush()` (pide permiso y token, 5.8) → `registrarDispositivo(token, tokenAnterior)` → `guardarTokenLocal(token)`. Lanza `no-soportado` o `permiso` |
| `desactivarPush()` | `borrarTokenPush()` (devuelve el token borrado) → `eliminarDispositivo(token)` → `guardarTokenLocal(null)` |
| `refrescarPush()` | Al iniciar, si `estadoPushLocal().activo`: vuelve a pedir el token (reemplaza el manejo de `pushsubscriptionchange` que hacía el SDK en el service worker) y, si cambió, `registrarDispositivo(nuevo, anterior)`. No pide permiso |
| `salir()` | `desactivarPush()` si está activo en este dispositivo (sin propagar errores) → `cerrarSesionFirebase()` |
| `borrarCuentaYSalir()` | `desactivarPush()` local → `borrarDatosEnServidor()` (borra Firestore, adjuntos y el usuario de Auth) → `cerrarSesionFirebase()`. Si `vecino/baja` falla, no cierra la sesión y lanza el error |
| `vincular()` | `vincularConGoogle()` (popup, con respaldo de redirect) → `getIdToken(true)`. El cambio de `usuario.anonimo` hace que el almacén vuelva a llamar `asegurarAlta`, que sincroniza `nombre` y `anonimo` (4.5) |
| `cambiarACuentaExistente(credencial)` | Para el invitado que eligió entrar con una cuenta de Google que ya tenía datos: `desactivarPush()` → `borrarDatosEnServidor()` del invitado (datos y usuario anónimo) → `ingresarConCredencial(credencial)`. Así el teléfono no sigue recibiendo los push del invitado y no quedan datos huérfanos |

---

## 5. Servicios de Firebase (`src/firebase/`, WP4)

### 5.1 Módulos y orden de inicialización

| Módulo | Exporta | Cuándo se inicializa |
|---|---|---|
| `config.js` | `firebaseConfig`, `USAR_EMULADORES`, `MODO_E2E`, `PUERTOS`, `VAPID_KEY`, `RECAPTCHA_SITE_KEY`, `SUPABASE_URL` | Constantes sin efectos ni `window` |
| `app.js` | `app` | Al importar |
| `appCheck.js` | `appCheck` (o null), `obtenerTokenAppCheck()` | **Al importar y antes que Firestore**: `firestore.js` lo importa primero. Con emuladores no se inicializa |
| `auth.js` | ver 5.2 | Al importar, con `initializeAuth` (sin resolvedor de popup) |
| `firestore.js` | `db` | Al importar, con caché persistente |
| `analytics.js` | `registrarEvento`, `EVENTOS`, `iniciarAnalytics` | Diferido |
| `rendimiento.js` | `TRAZAS`, `medir`, `registrarInicioConDatos`, `iniciarRendimiento` | Diferido; guarda las mediciones hasta que el SDK carga |
| `configRemota.js` | `VALORES_POR_DEFECTO`, `useConfigRemota`, `leerConfig`, `iniciarConfigRemota` | Diferido; hasta entonces devuelve los valores por defecto |
| `mensajeria.web.js` y `mensajeria.js` | `soportaPush`, `obtenerTokenPush`, `borrarTokenPush`, `estadoPushLocal`, `guardarTokenLocal` (5.8) | Cuando el vecino activa los avisos, o en `refrescarPush()` al iniciar |
| `diferidos.js` | `iniciarServiciosDiferidos()` | Lo llama `App.jsx` una sola vez con `requestIdleCallback` (respaldo `setTimeout(…, 1500)`) después del primer `listo`; también llama `refrescarPush()` de `src/datos/sesion.js` mediante el parámetro `alTerminar` que le pasa `App.jsx` (así `firebase/` no importa `datos/`) |

Cada SDK diferido se carga con `import()` dinámico para quedar fuera del paquete inicial. Si no está soportado (bloqueadores, navegación privada), el módulo queda inactivo sin error. El único import de `src/datos/` permitido dentro de `src/firebase/` es `errores.js`.

`src/plataforma/registroSW.web.js` y `registroSW.js` (WP4) registran el service worker **desde `src/index.web.js`, antes del ingreso** (sección 9.1): `registrarServiceWorker()` usa `registerSW({ immediate: true, onNeedRefresh })` de `virtual:pwa-register`; `alHaberActualizacion(cb) → cancelar`; `aplicarActualizacion()` (`updateSW(true)`); `registroListo(ms = 5000) → Promise<ServiceWorkerRegistration>` que rechaza con `no-soportado` si `navigator.serviceWorker.ready` no resuelve a tiempo. El stub nativo no hace nada y `registroListo` rechaza.

### 5.2 Autenticación (`auth.js`)

```js
export const auth;    // initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] })
                      // SIN popupRedirectResolver: no carga el iframe /__/auth/iframe al arrancar.
                      // languageCode 'es'.
export function useSesion();                          // { usuario: Usuario | null, listo: boolean }
//   escucha onIdTokenChanged (no onAuthStateChanged): se dispara también al vincular, porque el uid no cambia
//   pero sí el token. Compara campos para no volver a dibujar con cada renovación horaria.
export async function ingresarComoInvitado();         // signInAnonymously
export async function ingresarConGoogle();            // signInWithPopup(auth, proveedor, browserPopupRedirectResolver);
//   con 'auth/popup-blocked' o en la PWA instalada de iOS → signInWithRedirect (marca 'conecta:redireccion' en sessionStorage)
export async function vincularConGoogle();            // linkWithPopup(auth.currentUser, proveedor, resolvedor);
//   popup bloqueado o PWA de iOS → linkWithRedirect.
//   'auth/credential-already-in-use' → throw new ErrorApp('cuenta-existente', undefined,
//     { datos: { credencial: GoogleAuthProvider.credentialFromError(e) } })
export async function completarRedireccion();         // solo si existe la marca de sessionStorage:
//   getRedirectResult(auth, resolvedor); procesa tanto un ingreso como un VÍNCULO (operationType 'link');
//   si el vínculo falla con credential-already-in-use devuelve { cuentaExistente: credencial }.
//   Llama getIdToken(true) después de un vínculo. Devuelve { tipo: 'ingreso' | 'vinculo' | null, cuentaExistente? }
export async function ingresarConCredencial(credencial);  // signInWithCredential (lo orquesta sesion.js)
export async function cerrarSesionFirebase();          // signOut (lo orquesta sesion.js)
export async function obtenerTokenId(forzar = false);
export function mensajeDeError(e);                    // tabla de heredado:src/firebase.js:43-59 más anónimo y vínculo
// Usuario = { uid, nombre, email, anonimo, proveedor: 'anonymous' | 'google.com' }
```

`browserPopupRedirectResolver` se pasa como tercer argumento solo en las funciones de Google. La ganancia real de `initializeAuth` es no cargar el iframe de Auth en cada arranque; el peso del resolvedor lo decide la medición de WP1 (10.5).

Con `USAR_EMULADORES`, `connectAuthEmulator(auth, 'http://127.0.0.1:' + PUERTOS.auth)`. **Solo con `MODO_E2E`** (`import.meta.env.MODE === 'e2e'`) se expone `globalThis.__conectaE2E = { ingresarGoogleFalso(sub, nombre) }`, que llama `signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub, email, name, email_verified: true })))`; el emulador de Auth acepta ese token sin firma. Lo usa el fixture `admin` (10.3). En el build de producción no existe.

`authDomain`:
- Producción (`.env.local`, que Vite carga en todos los modos): **`san-francisco-conecta-tp5.web.app`**, mismo origen que el Hosting, para que popup y redirect funcionen con el particionado de almacenamiento y dentro de la PWA instalada. La guía "redirect best practices" de Firebase lo admite para subdominios de `web.app`. Paso manual: agregar `https://san-francisco-conecta-tp5.web.app/__/auth/handler` a los URI de redirección del cliente OAuth web en Google Cloud. El handler ya responde 200.
- Desarrollo (`.env.development.local`, ignorado por git, que pisa solo esa variable en `vite` dev): `san-francisco-conecta-tp5.firebaseapp.com`. Desde `localhost` el iframe de Auth es de otro origen; así no depende de que el Hosting aplique o no `X-Frame-Options` a `/__/auth/iframe`.
- Dominios autorizados en Authentication: `localhost`, `127.0.0.1`, `san-francisco-conecta-tp5.web.app` y `san-francisco-conecta-tp5.firebaseapp.com`.

### 5.3 Firestore (`firestore.js`)

```js
import './appCheck.js';   // garantiza App Check antes de la primera petición
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
if (USAR_EMULADORES) connectFirestoreEmulator(db, '127.0.0.1', PUERTOS.firestore);
```

Sin `try/catch`: si falta IndexedDB, el SDK no lanza, cae solo a caché en memoria y lo avisa por consola (`@firebase/firestore`, "Falling back to memory cache"). Un segundo `initializeFirestore` lanzaría "already been called".

### 5.4 App Check (`appCheck.js`)

- Proveedor `ReCaptchaV3Provider(RECAPTCHA_SITE_KEY)` con `isTokenAutoRefreshEnabled: true`. El secreto ya está registrado (script `scratchpad/tp5/configurar-firebase.cjs`). Se mantiene v3 por decisión del usuario, aunque Firebase recomienda Enterprise para integraciones nuevas.
- **TTL del token: 3600 s** (consola, App Check, la app web, reCAPTCHA v3; paso manual de WP4). Cada renovación es una evaluación de reCAPTCHA; una hora es el equilibrio entre cuota y seguridad.
- En desarrollo contra producción: si existe `VITE_APPCHECK_DEBUG_TOKEN`, antes de inicializar se asigna `self.FIREBASE_APPCHECK_DEBUG_TOKEN`. La prueba de humo usa otro token de depuración inyectado con `page.addInitScript` (10.4), porque un navegador sin interfaz puede sacar un puntaje bajo.
- Con emuladores no se inicializa: los emuladores no exigen App Check. Tampoco con `VITE_APPCHECK_DESACTIVADO=true`, que solo usa el build de medición de carga (10.5).
- `obtenerTokenAppCheck()` → `string | null` con `getToken(appCheck, false)`. Lo usa `src/supabase/funciones.js` para el encabezado `X-Firebase-AppCheck`.
- Aplicación obligatoria en Firestore: **en modo monitor** durante el desarrollo, la prueba de humo y hasta medir; se activa en la consola cuando las métricas muestran más del 95 % de solicitudes verificadas. El costo de carga se mide con App Check encendido y apagado (10.5).

### 5.5 Analytics (`analytics.js`)

`registrarEvento(nombre, parametros)` encola hasta que el SDK carga. No se inicializa con emuladores. Ningún parámetro lleva datos personales (ni nombre, ni patente, ni dirección).

| Constante `EVENTOS.*` | Evento | Parámetros | Lo dispara |
|---|---|---|---|
| LOGIN | `login` | method: `anonimo` \| `google` | Ingreso |
| VINCULAR | `vincular_cuenta` | | Cuenta |
| PANTALLA | `screen_view` | firebase_screen | Enrutador, al cambiar de ruta |
| RECLAMO_CREADO | `reclamo_creado` | categoria, adjuntos, en_cola | Reclamos |
| TRIBUTO_PAGADO | `tributo_pagado` | estado_previo | Tributos |
| CEDULON_EMITIDO | `cedulon_emitido` | | Tributos |
| ESTACIONAMIENTO_INICIADO | `estacionamiento_iniciado` | zona, minutos | Estacionamiento |
| ESTACIONAMIENTO_EXTENDIDO | `estacionamiento_extendido` | minutos | Estacionamiento |
| ESTACIONAMIENTO_FINALIZADO | `estacionamiento_finalizado` | | Estacionamiento |
| ESTACIONES_CERCANAS | `estaciones_cercanas` | | Bicicletas |
| PROBLEMA_BICI | `problema_bici_reportado` | | Bicicletas |
| ZONA_SUSCRIPTA | `zona_suscripta` | zona, activa | Alarmas, Notificaciones |
| CERCANIA_ACTIVADA | `cercania_activada` | | Alarmas |
| PUSH_HABILITADO | `push_habilitado` | | Notificaciones, Alarmas |
| PREFERENCIAS_GUARDADAS | `preferencias_guardadas` | frecuencia | Notificaciones |
| CONTACTO_USADO | `contacto_usado` | canal: `telefono` \| `correo` \| `whatsapp` \| `sitio` | Contactos |
| AVISO_ABIERTO | `aviso_abierto` | tipo | Notificaciones |
| PWA_INSTALADA | `pwa_instalada` | | Cuenta (`appinstalled`) |
| PANEL_ACCION | `panel_accion` | accion | Panel |
| ERROR_OPERACION | `error_operacion` | codigo | `useComando` |

### 5.6 Performance Monitoring (`rendimiento.js`)

El SDK mide solo la carga de página y las solicitudes de red. Aunque se inicialice en diferido, la carga de página se registra: el SDK lee las mediciones de navegación del navegador al ocultar la página (`@firebase/performance`, comprobado), así que los datos aparecen después de cerrar la pestaña. Trazas propias (`TRAZAS.*`):

| Traza | Mide | Atributos |
|---|---|---|
| `inicio_con_datos` | Desde `performance.timeOrigin` hasta `listo`. Se registra con `trace.record(inicio, duracion, { attributes })` | desde_cache, autenticado |
| `alta_vecino` | Llamada a `vecino/alta` | creado |
| `alta_reclamo` | Desde confirmar hasta el documento escrito, con adjuntos | adjuntos |
| `pago_tributo` | Transacción del pago | |
| `inicio_estacionamiento` | Transacción de la sesión | |
| `carga_mapa` | Desde montar el mapa hasta la primera tesela | pantalla |

`medir(traza, fn)` envuelve una promesa y registra su duración.

### 5.7 Remote Config (`configRemota.js`)

| Parámetro | Tipo | Valor por defecto | Uso |
|---|---|---|---|
| `leyenda_prototipo` | string | "Prototipo académico UTN FRSF, sin vínculo oficial con la Municipalidad de San Francisco" | Leyenda del marco. Si llega vacía o con menos de 20 caracteres se usa el valor por defecto: la leyenda no se puede quitar |
| `banner_emergencia` | string (JSON `{"texto","nivel":"alerta"\|"peligro","destino"}` o vacío) | "" | Banner del marco (FUN-09) |
| `radio_alarma_km` | number | 1 | A3 |
| `intervalo_cercania_min` | number | 30 | Vigencia de `cercania`; el cliente la limita a 60 |
| `mensaje_bienvenida` | string | "Tu ciudad, a un toque." | Título de Inicio |

Ya no existen `panel_demo_visible` (el documento de `administradores` decide quién ve el panel) ni `minutos_aviso_estacionamiento` (el umbral vive en `municipal/config.avisoEstacionamientoMin`).

**Cambios en vivo para la demo:** `onConfigUpdate(remoteConfig, { next: () => activate(remoteConfig) })` (existe en el SDK 12.19: `@firebase/remote-config/dist/remote-config-public.d.ts:316`), así un cambio publicado en la consola llega en segundos sin recargar. Respaldo si la escucha falla: `minimumFetchIntervalMillis` de 300 000 en producción (60 000 en desarrollo) y `fetchAndActivate` al volver la pestaña al frente. `useConfigRemota()` devuelve `{ leyendaPrototipo, bannerEmergencia, radioAlarmaKm, intervaloCercaniaMin, mensajeBienvenida }` ya convertidos (el banner como objeto o null). `leerConfig()` da lo mismo fuera de React.

**Plantilla versionada:** `remoteconfig.template.json` (WP4) con los cinco parámetros y sus valores por defecto, declarada en `firebase.json` (`"remoteconfig": { "template": "remoteconfig.template.json" }`) y publicada con `npm run deploy:remoteconfig` (`firebase deploy --only remoteconfig`).

### 5.8 Cloud Messaging (`mensajeria.web.js`)

`mensajeria` **solo obtiene o borra el token** y no toca Firestore (eso lo hace `src/datos/sesion.js`, 4.7).

```js
export async function soportaPush();          // isSupported() && 'Notification' in window && 'serviceWorker' in navigator
export async function obtenerTokenPush();     // pide permiso si hace falta (denegado → ErrorApp('permiso'));
                                              // getToken(messaging, { vapidKey: VAPID_KEY,
                                              //   serviceWorkerRegistration: await registroListo() }) → token
export async function borrarTokenPush();      // deleteToken; devuelve el token que había (o null)
export function estadoPushLocal();            // { soportado, permiso: Notification.permission, activo, token }
                                              // activo = permiso 'granted' y hay token guardado en este navegador
export function guardarTokenLocal(token | null); // localStorage 'conecta:token-push'
```

`mensajeria.js` (sin `.web`) exporta lo mismo: `soportaPush()` devuelve `false` y `estadoPushLocal()` `{ soportado: false, ... }`.

- **No se usa `onMessage` ni `firebase/messaging/sw`.** `getToken` en la ventana solo usa el `pushManager` de la registración que se le pasa, así que funciona con el service worker propio. Los push los recibe siempre el `push` de `sw.js` (9.2), que **siempre** muestra una notificación visible (WebKit revoca la suscripción si un push no termina en una notificación). Con la app abierta, la alerta dentro de la app llega por `onSnapshot` (4.5); las dos comparten la `claveEntrega` como `tag`.
- El interruptor "Avisos en este dispositivo" refleja `estadoPushLocal()`, no `preferencias.push` (que es del usuario y vale para todos sus dispositivos).
- Los mensajes son **solo de datos** (`data: { id, titulo, cuerpo, destino, tipo }`, con `id` = `claveEntrega`).
- Paso manual: generar el par de claves Web Push propio en la consola (Cloud Messaging, Configuración web) y guardarlo como `VITE_FIREBASE_VAPID_KEY`. El SDK funciona con la clave por defecto, pero recomienda una propia porque algunos servicios push la exigen.

### 5.9 Notificaciones locales (`plataforma/notificacionesLocales.web.js`, WP4)

`mostrarNotificacionLocal({ titulo, cuerpo, destino, tag })` usa `(await registroListo()).showNotification(...)` y corrige `heredado:notificationPolicy.js:28-33`, que registraba un segundo service worker. Sirve para A3, E3 y los avisos con la pestaña oculta. **`tag` es siempre la `claveEntrega`** (Anexo A): para E3, `est-<sesionId>-<finMs>-por_vencer`, la misma que usa el push del servidor como `data.id`, así la segunda reemplaza a la primera en lugar de duplicarla. Solo la llama el almacén. El archivo `.js` es un stub vacío.

---

## 6. Supabase (plan gratuito, solo lo que necesita un servidor; WP6)

Proyecto `qsxwsbdhlwyshqjfxaxw`, región `sa-east-1`, URL `https://qsxwsbdhlwyshqjfxaxw.supabase.co`, estado `ACTIVE_HEALTHY` (comprobado con `npx supabase projects list`, CLI 2.120.0). El usuario confirmó que el proyecto quedó listo. Hoy está vinculado desde `TP5/supabase/.temp` (fuera del repositorio): hay que volver a ejecutar `npx supabase link --project-ref qsxwsbdhlwyshqjfxaxw` **desde `app/`**. Tiene las dos clases de claves (legacy `anon`/`service_role` y `sb_publishable`/`sb_secret` `default`).

**La identidad es siempre Firebase Auth.** Supabase no tiene usuarios propios. Ninguna tabla ni bucket es accesible con la clave pública: todo pasa por cuatro Edge Functions que verifican el ID token de Firebase y escriben con la cuenta de servicio. El cliente **no** manda ninguna clave de Supabase: con `verify_jwt = false` la pasarela deja pasar la solicitud sin `apikey` (comprobado: un `GET` sin encabezados llega al runtime).

### 6.1 Qué hace Supabase y qué no

| Necesidad | Por qué no alcanza Firebase Spark | Pieza de Supabase |
|---|---|---|
| Adjuntos de reclamos (R2) | Cloud Storage exige Blaze en buckets nuevos | Bucket privado `adjuntos-reclamos` + función `adjuntos` |
| Datos tributarios iniciales del vecino (T1, API tributaria simulada) y sus recordatorios inmediatos (T4) | Un vecino no puede escribir sus propios importes | Función `vecino` (`/alta`) |
| Push con la app cerrada (N1, A3, R3, E3, T4) | Enviar FCM necesita credenciales de servidor | Función `despachar` y tarea `minuto` |
| Recordatorios T4 y E3, simulador municipal, resumen diario | No hay tareas programadas sin Functions | `pg_cron` + `pg_net` → función `tareas` (también a pedido del admin) |
| Borrar mis datos, incluido el usuario de Auth | El cliente no puede borrar tributos ni pagos, y `deleteUser` exige ingreso reciente | Función `vecino` (`/baja`) con Identity Toolkit |

### 6.2 Estructura

```
supabase/
├─ config.toml
├─ migrations/
│   ├─ 20261007120000_adjuntos.sql
│   ├─ 20261007120100_ejecuciones.sql
│   └─ 20261007120200_programacion.sql
└─ functions/
    ├─ _shared/
    │   ├─ cors.ts            encabezados y respuesta a OPTIONS, lista de orígenes desde ORIGENES_PERMITIDOS
    │   ├─ respuesta.ts       ok(datos), falla(ErrorHttp) → JSON { ok, datos?, error?: { codigo, mensaje } }
    │   ├─ firebase-auth.ts   verificarUsuario, verificarAppCheck, verificarCron, exigirAdmin (6.4)
    │   ├─ google-token.ts    token OAuth2 de la cuenta de servicio, con caché (6.5)
    │   ├─ firestore.ts       cliente REST mínimo con códec de valores (6.6)
    │   ├─ identidad.ts       borrarUsuarioAuth(uid) por Identity Toolkit (6.8, vecino/baja)
    │   ├─ fcm.ts             envío por FCM HTTP v1 (6.7)
    │   ├─ entrega.ts         procesar un evento de la bandeja (lógica de despachar)
    │   ├─ recordatorios.ts   tributos (T4) y estacionamiento (E3)
    │   ├─ simulacion.ts      aplica el plan de shared/simulador.mjs
    │   ├─ almacenamiento.ts  supabase-js con la clave secreta, solo Storage
    │   └─ registro.ts        inserta en public.ejecuciones
    ├─ vecino/index.ts
    ├─ adjuntos/index.ts
    ├─ despachar/index.ts
    └─ tareas/index.ts
```

`_shared/*.ts` importa el dominio **directo** desde `../../../shared/*.mjs`. El despliegue usa `--use-api` (empaquetado en el servidor de Supabase, sin Docker), que admite archivos fuera de `supabase/` (changelog 33613 de Supabase) con un límite de 5 MB por función empaquetada. **Plan B** si el primer despliegue de WP6 no resuelve esos imports: WP6 agrega `scripts/copiar-shared.mjs` (de su propiedad) que copia `shared/` a `supabase/functions/_shared/compartido/` (ignorado por git) antes de desplegar, y cambia los imports. No hay prueba de sincronización ni `sync:shared` en el build. Las dependencias se importan con especificadores explícitos: `npm:jose@6.2.12` y `npm:@supabase/supabase-js@2`.

### 6.3 Contrato HTTP común

- URL: `${VITE_SUPABASE_URL}/functions/v1/<funcion>/<accion>`.
- Encabezados del cliente: `Authorization: Bearer <ID token de Firebase>`, `X-Firebase-AppCheck: <token>` (si hay) y `Content-Type`. Nada más.
- `config.toml` declara `verify_jwt = false` en las cuatro funciones: la verificación de la plataforma solo entiende JWT de Supabase, así que la desactiva y valida la función.
- Respuesta siempre JSON: `{ "ok": true, "datos": … }` o `{ "ok": false, "error": { "codigo": "…", "mensaje": "…" } }` con 400, 401, 403, 404, 409, 413, 429 o 500. Los códigos coinciden con los de `ErrorApp` (sección 4.2), incluido `app-check`.
- CORS: `Access-Control-Allow-Origin` solo para los orígenes de `ORIGENES_PERMITIDOS`; `Access-Control-Allow-Headers: authorization, content-type, x-client-info, x-firebase-appcheck`; `OPTIONS` responde 204.
- App Check: con `APPCHECK_MODO=exigir`, sin token válido responde 401 `app-check`. Con `monitor` solo registra.

### 6.4 Verificación del token de Firebase en Deno (`_shared/firebase-auth.ts`)

```ts
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.2.12";

const PROYECTO = Deno.env.get("FIREBASE_PROJECT_ID")!;          // san-francisco-conecta-tp5
const NUMERO = Deno.env.get("FIREBASE_PROJECT_NUMBER")!;        // 864192049474
const MODO_APPCHECK = Deno.env.get("APPCHECK_MODO") ?? "monitor";

// Claves públicas de securetoken@system.gserviceaccount.com en formato JWK (con kid; comprobado).
// jose las guarda en memoria y respeta el tiempo de enfriamiento entre descargas.
const CLAVES_ID = createRemoteJWKSet(new URL(
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const CLAVES_APPCHECK = createRemoteJWKSet(new URL("https://firebaseappcheck.googleapis.com/v1/jwks"));

export class ErrorHttp extends Error {
  constructor(public estado: number, public codigo: string, mensaje: string) { super(mensaje); }
}
export type Identidad = {
  uid: string; anonimo: boolean; proveedor: string; nombre: string | null;
};

function leerToken(req: Request): string {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1] ?? "";
  if (!token) throw new ErrorHttp(401, "sin-sesion", "Falta la sesión de Firebase.");
  return token;
}

export async function verificarUsuario(req: Request): Promise<Identidad> {
  const token = leerToken(req);
  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(token, CLAVES_ID, {
      issuer: `https://securetoken.google.com/${PROYECTO}`,
      audience: PROYECTO,
      algorithms: ["RS256"],
      clockTolerance: 30,          // segundos; jose ya controla exp e iat
    }));
  } catch {
    throw new ErrorHttp(401, "sin-sesion", "La sesión no es válida o venció.");
  }
  const ahora = Math.floor(Date.now() / 1000);
  const sub = payload.sub;
  if (typeof sub !== "string" || sub.length === 0 || sub.length > 128)
    throw new ErrorHttp(401, "sin-sesion", "La sesión no es válida.");
  if (typeof payload.auth_time !== "number" || payload.auth_time > ahora + 30)
    throw new ErrorHttp(401, "sin-sesion", "La sesión no es válida.");
  const firebase = (payload.firebase ?? {}) as { sign_in_provider?: string };
  return {
    uid: sub,
    anonimo: firebase.sign_in_provider === "anonymous",
    proveedor: firebase.sign_in_provider ?? "desconocido",
    nombre: typeof payload.name === "string" ? payload.name : null,
  };
}

export async function verificarAppCheck(req: Request): Promise<void> {
  const token = req.headers.get("x-firebase-appcheck");
  try {
    if (!token) throw new Error("sin token");
    await jwtVerify(token, CLAVES_APPCHECK, {
      issuer: `https://firebaseappcheck.googleapis.com/${NUMERO}`,
      audience: `projects/${NUMERO}`,
      algorithms: ["RS256"],
    });
  } catch (e) {
    if (MODO_APPCHECK === "exigir") throw new ErrorHttp(401, "app-check", "Aplicación no verificada.");
    console.warn("App Check no verificado (modo monitor):", (e as Error).message);
  }
}

export function verificarCron(req: Request): boolean {
  const recibido = req.headers.get("x-cron-secret") ?? "";
  const esperado = Deno.env.get("CRON_SECRET") ?? "";
  if (!esperado || recibido.length !== esperado.length) return false;
  let dif = 0;                                     // comparación en tiempo constante
  for (let i = 0; i < esperado.length; i++) dif |= recibido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return dif === 0;
}

// Admin = cuenta no anónima con administradores/{uid} en Firestore. MISMO criterio que esAdmin() de las reglas.
export async function exigirAdmin(id: Identidad, firestore: { obtener(r: string): Promise<unknown> }) {
  if (id.anonimo || !(await firestore.obtener(`administradores/${id.uid}`)))
    throw new ErrorHttp(403, "permiso", "Esta operación corresponde al personal municipal.");
}
```

### 6.5 Token de la cuenta de servicio (`_shared/google-token.ts`)

```ts
import { importPKCS8, SignJWT } from "npm:jose@6.2.12";
const cuenta = JSON.parse(atob(Deno.env.get("FIREBASE_SERVICE_ACCOUNT_B64")!));
const ALCANCES = [
  "https://www.googleapis.com/auth/datastore",            // Firestore REST
  "https://www.googleapis.com/auth/firebase.messaging",   // FCM HTTP v1
  "https://www.googleapis.com/auth/identitytoolkit",      // borrar el usuario de Auth (vecino/baja)
].join(" ");
let cache: { token: string; vence: number } | null = null;

export async function tokenGoogle(): Promise<string> {
  if (cache && cache.vence - 60_000 > Date.now()) return cache.token;
  const clave = await importPKCS8(cuenta.private_key, "RS256");
  const ahora = Math.floor(Date.now() / 1000);
  const asercion = await new SignJWT({ scope: ALCANCES })
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: cuenta.private_key_id })
    .setIssuer(cuenta.client_email).setSubject(cuenta.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(ahora).setExpirationTime(ahora + 3600)
    .sign(clave);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: asercion }),
  });
  if (!r.ok) throw new Error(`OAuth de Google respondió ${r.status}`);
  const j = await r.json();
  cache = { token: j.access_token, vence: Date.now() + j.expires_in * 1000 };
  return cache.token;
}
```

La cuenta es la `firebase-adminsdk-…` del proyecto (consola de Firebase, Configuración, Cuentas de servicio, Generar nueva clave privada). Su rol `roles/firebase.sdkAdminServiceAgent` ya incluye `datastore.entities.*`, `cloudmessaging.messages.create` y `firebaseauth.users.delete`: no hay que agregar roles. Se guarda **solo** como secreto de Supabase, en base64, y el archivo descargado se borra del disco.

### 6.6 Firestore por REST (`_shared/firestore.ts`)

Base: `https://firestore.googleapis.com/v1/projects/${PROYECTO}/databases/(default)/documents`. No hay modo emulador: las pruebas e2e usan `edge-simulado` (10.3).

```ts
export const HORA_SERVIDOR: unique symbol;      // marcador → updateTransforms REQUEST_TIME
export function aValor(v: unknown): Value;       // null, boolean, int (integerValue), double, string,
                                                 // Date o { ms } → timestampValue, array, objeto → mapValue
export function desdeValor(v: Value): unknown;   // timestampValue → número en ms (contrato de fechas)
export async function obtener(ruta: string): Promise<Doc | null>;          // Doc = { ruta, id, datos, actualizado }
export async function consultar(q: StructuredQuery, padre = ""): Promise<Doc[]>;  // :runQuery; allDescendants para grupos
export async function listar(rutaColeccion: string, tamano = 300): Promise<Doc[]>; // pagina con pageToken
export type Escritura =
  | { tipo: "set"; ruta: string; datos: Record<string, unknown>; soloSiNoExiste?: boolean }
  | { tipo: "update"; ruta: string; datos: Record<string, unknown>; campos: string[]; siActualizado?: string }
  | { tipo: "borrar"; ruta: string };
// Atómico: POST …/documents:commit. SOLO para reclamar un evento con la precondición updateTime.
export async function confirmar(escrituras: Escritura[]): Promise<void>;
// No atómico: POST …/documents:batchWrite (máx. 500). Para todo lo demás, en especial las creaciones
// idempotentes: devuelve un estado por escritura, y ALREADY_EXISTS / FAILED_PRECONDITION de una
// escritura con soloSiNoExiste cuenta como "ya existía", no como error.
export async function escribirLote(escrituras: Escritura[]): Promise<Array<"ok" | "ya-existia" | "error">>;
```

`soloSiNoExiste` → `currentDocument: { exists: false }`. `siActualizado` → `currentDocument: { updateTime }` (evita que dos ejecuciones procesen el mismo evento). Los campos con `HORA_SERVIDOR` se convierten en `updateTransforms` con `setToServerValue: "REQUEST_TIME"`. Quien llama a `escribirLote` envía push **solo** por las notificaciones que devolvieron `"ok"` (recién creadas).

### 6.7 Push por FCM HTTP v1 (`_shared/fcm.ts`)

```ts
export async function enviarPush(token: string, datos: {
  id: string; titulo: string; cuerpo: string; destino: string; tipo: string;   // id = claveEntrega
}): Promise<"ok" | "invalido" | "error"> {
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${PROYECTO}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${await tokenGoogle()}`, "content-type": "application/json" },
    body: JSON.stringify({ message: { token, data: datos,
      webpush: { headers: { TTL: "3600", Urgency: "high" } } } }),
  });
  if (r.ok) return "ok";
  const e = await r.json().catch(() => ({}));
  const detalles = (e?.error?.details ?? []) as Array<Record<string, unknown>>;
  const codigo = detalles.find((d) => d.errorCode)?.errorCode ?? e?.error?.status;
  const culpaDelToken = detalles.some((d) =>
    (d.fieldViolations as Array<{ field?: string }> | undefined)?.some((f) => f.field === "message.token"));
  // INVALID_ARGUMENT también cubre errores del contenido del mensaje: solo se borra el token
  // si el error apunta a message.token. Un error de programación no debe vaciar los dispositivos.
  if (r.status === 404 || codigo === "UNREGISTERED" || (codigo === "INVALID_ARGUMENT" && culpaDelToken))
    return "invalido";
  console.error("FCM", r.status, codigo);
  return "error";
}
export async function enviarAVecino(uid: string, datos): Promise<number>;
// lista usuarios/{uid}/dispositivos, envía de a 20 en paralelo y borra los "invalido"
// (como heredado:service.mjs:881-890). Si después no queda ningún dispositivo, pone preferencias.push = false.
```

Mensajes solo de datos y todos los valores string. FCM HTTP v1 no exige plan pago y la API `fcm` ya está habilitada en el proyecto.

### 6.8 Edge Functions

**`vecino`**

| Acción | Entrada | Autorización | Hace | Salida |
|---|---|---|---|---|
| `POST /vecino/alta` | sin cuerpo | `verificarUsuario` + `verificarAppCheck` | **Idempotente.** Lee `usuarios/{uid}`. Si existe: `update` de `nombre` (del token, o "Vecino"), `anonimo` y, si falta, `altaEn = HORA_SERVIDOR`. Si no existe: lo crea con preferencias por defecto y `altaEn`. Después, `escribirLote` con `soloSiNoExiste` de los 4 tributos, `pagos/semilla-T-1000`, el reclamo de ejemplo, la notificación `bienvenida` y las notificaciones de `recordatoriosTributos(tributos, ahora)` (T-1001 por vencer y T-0999 vencido, 2.4). Como `batchWrite` no es atómico, un documento que ya existía no impide crear los demás | `{ creado: boolean, tributos: number, recordatorios: number }` |
| `POST /vecino/baja` | sin cuerpo | `verificarUsuario` (no exige ingreso reciente) | Borra todas las subcolecciones de `usuarios/{uid}` (las de 2.2), los `bloqueosPatente/{patente}` de sus sesiones vigentes cuyo `sesionId` coincida, los archivos `adjuntos-reclamos/{uid}/…`, el perfil y, al final, **el usuario de Auth** con `POST https://identitytoolkit.googleapis.com/v1/projects/{PROYECTO}/accounts:delete` `{ localId: uid }` y el token de la cuenta de servicio. Así no depende de `deleteUser` del cliente, que falla con `auth/requires-recent-login` en cuentas de Google, y al recargar no se vuelve a sembrar nada | `{ borrados: number }` |

**`adjuntos`** (R2)

| Acción | Entrada | Autorización | Hace | Salida |
|---|---|---|---|---|
| `POST /adjuntos/subir` | `multipart/form-data`: `reclamoId` (requestId), `indice` (0..2), `archivo` (**un archivo por solicitud**) | `verificarUsuario` + App Check | Hasta 2 MiB; tipo detectado por la firma de los bytes con `tipoPorFirma` (JPEG, PNG o PDF; reescribe `validateAttachments` de `heredado:domain.mjs:55-86`); nombre saneado y **recortado a 100 caracteres** (lo que exige la regla). Sube a `adjuntos-reclamos/{uid}/{reclamoId}/{indice}-{sha256[0..12]}.{jpg\|png\|pdf}` con `upsert: true` (un reintento sobrescribe el mismo archivo) | `{ adjunto: { ruta, nombre, tipo, tamano } }` (la `ruta` es relativa al bucket y cumple el patrón de las reglas) |
| `POST /adjuntos/url` | `{ ruta }` | `verificarUsuario`; la ruta debe empezar con `{uid}/`, o el usuario ser admin (`exigirAdmin`) | `createSignedUrl(ruta, 300)` | `{ url, venceEn }` |

Errores: 413 `adjunto-invalido` si se excede el tamaño, 400 `adjunto-invalido` si el contenido no coincide con el tipo. Un archivo por solicitud deja el cuerpo por debajo de 2,1 MB: la página oficial de límites no publica un máximo de cuerpo y no conviene apoyarse en los 10 MB de fuentes secundarias.

**`despachar`**

| Acción | Entrada | Autorización | Salida |
|---|---|---|---|
| `POST /despachar` | `{ eventoId? }` | Admin (`verificarUsuario` + `exigirAdmin`) o `verificarCron` | `{ procesados, enviados }` |

Procesa el evento indicado o, sin `eventoId`, la consulta de bandeja de 2.5 (`estado in [pendiente, error]` por `creadoEn`, limit 50) filtrada en el código por `intentos < 3`, hasta 20. Para cada uno: pasa a `procesando` con `confirmar` y precondición `updateTime` (si otra ejecución lo tomó, lo saltea) y según `tipo`:

- `aviso`: lee `avisos/{refId}`. Destinatarios: `usuarios` con `preferencias.push == true` (paginado de a 300) filtrados con `decidirEntrega(aviso, preferencias).push`. No crea copias del aviso. `data.id` = `eventoId`.
- `alarma`: lee `alarmas/{refId}`. Si no existe `avisos/alarma-{eventoId}`, lo crea (tipo `alarmas`, zona de la alarma, destino `#/alarmas/{refId}`, autor según `origen`, `eventoId`), así queda en el historial de quienes siguen esa zona. Destinatarios: los de la zona como en `aviso`, más `usuarios` con `cercania.alarmas array-contains refId`, filtrados en el código por `cercania.vence > ahora`. A los cercanos que no siguen la zona les crea `notificaciones/alarma-{eventoId}` con `escribirLote` (sin coordenadas: solo ids, como `heredado:service.mjs:745-751`). `data.id` = `eventoId` para todos.
- `reclamo`: lee `usuarios/{uid}/reclamos/{refId}`, crea `usuarios/{uid}/notificaciones/reclamo-{eventoId}` ("Tu reclamo R-XXXXXX pasó a En proceso") con `escribirLote` y `soloSiNoExiste`, y envía push con `data.id` = `eventoId` si se creó y `decidirEntrega` lo permite.

Al final, `estado: enviado`, `procesadoEn`, `enviados`. Ante una excepción, `estado: error`, `intentos + 1` y `error` (mensaje corto).

**`tareas`**

| Acción | Entrada | Autorización |
|---|---|---|
| `GET /tareas` | | Pública. Devuelve `{ ok: true, version }` (lo usa la prueba de humo) |
| `POST /tareas` | `{ tarea: 'minuto' }` | `verificarCron` |
| `POST /tareas` | `{ tarea: 'diaria' }` | `verificarCron` **o admin** (botón "Enviar recordatorios ahora" del panel) |
| `POST /tareas` | `{ tarea: 'resumen' }` | `verificarCron` **o admin** (botón "Enviar resumen ahora") |
| `POST /tareas` | `{ tarea: 'simulador' }` | `verificarCron` o admin |

- **`minuto`**: (1) E3: lee `municipal/config.avisoEstacionamientoMin` (respaldo 5). Grupo `estacionamiento` con `fin > ahora` y `fin <= ahora + 14 min`; en el código, los que tienen `fin <= ahora + avisoEstacionamientoMin` y `avisoPorVencer != true` reciben la notificación `est-{sesionId}-{finMs}-por_vencer` (`escribirLote`, `soloSiNoExiste`), push con ese mismo `data.id` y `avisoPorVencer = true`. Grupo con `fin > ahora − 3 min` y `fin <= ahora`, y en el código `avisoFinalizado != true`: lo mismo con `finalizado` (incluye las sesiones finalizadas antes de tiempo). (2) Barre la bandeja de eventos (misma lógica que `despachar`). (3) Si `municipal/config.simuladorActivo` y pasaron `simuladorCadaMin` minutos desde `ultimaSimulacion`, ejecuta un paso del simulador.
- **`diaria`** (09:00 de Córdoba, o a pedido del admin): T4. Grupo `tributos` con `pagadoEn == null` y `vence <= ahora + 3 días`; para cada uno, `recordatoriosTributos` arma la clave `tributo-{id}-{venceDia}-{etapa}` (`por_vencer` o `vencido`, umbrales de `heredado:reminders.mjs:6-8`), crea la notificación con `escribirLote` y `soloSiNoExiste` y, si se creó, envía push con ese `data.id`. Devuelve `{ notificaciones, push }`.
- **`resumen`** (20:00 de Córdoba, o a pedido del admin): `usuarios` con `preferencias.frecuencia == 'resumen_diario'`, filtrados en el código por `push == true`; cuenta los avisos visibles y notificaciones de las últimas 24 h sin leer y envía un push "Tenés N novedades hoy" con destino `#/notificaciones` y `data.id` = `resumen-{uid}-{díaCórdoba}`. Devuelve `{ notificaciones: 0, push }`.
- **`simulador`**: lee estaciones, `config` y reclamos candidatos (grupo `reclamos` con `estado == 'recibido'` y `actualizadoEn <= ahora − 2 min`, y `en_proceso` con `actualizadoEn <= ahora − 5 min`, hasta 3 de cada uno), llama `planificarPaso(...)` de `shared/simulador.mjs` y aplica el plan: bicicletas ±1 o ±2 en 1 o 2 estaciones y avance de reclamos con su evento; actualiza `ultimaSimulacion`. **No toca alarmas**: se activan solo desde el panel, para no mandar push de alarma a teléfonos reales durante la clase. Después procesa en el momento los eventos que creó. Devuelve `Cambios` (4.4).

Cada ejecución inserta una fila en `public.ejecuciones` (tarea, duración, resultado y si salió bien), que sirve de evidencia para el informe y para detectar un índice faltante en producción.

### 6.9 Migraciones

`20261007120000_adjuntos.sql` (única declaración del bucket; `config.toml` no lo repite)

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adjuntos-reclamos', 'adjuntos-reclamos', false, 2097152,
        array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
-- Sin políticas sobre storage.objects para este bucket: solo la clave secreta
-- (las Edge Functions) puede leer o escribir. Las descargas usan URLs firmadas de 5 minutos.
```

`20261007120100_ejecuciones.sql`

```sql
create table if not exists public.ejecuciones (
  id bigint generated always as identity primary key,
  tarea text not null,
  inicio timestamptz not null default now(),
  duracion_ms integer,
  ok boolean not null,
  resultado jsonb
);
alter table public.ejecuciones enable row level security;   -- sin políticas: solo la clave secreta
```

`20261007120200_programacion.sql`

```sql
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
create extension if not exists pg_net with schema extensions;

-- Los secretos NO están en esta migración. Se cargan una vez desde el editor SQL:
--   select vault.create_secret('https://qsxwsbdhlwyshqjfxaxw.supabase.co', 'url_proyecto');
--   select vault.create_secret('<mismo valor que CRON_SECRET>', 'secreto_cron');
create or replace function public.llamar_tarea(tarea text) returns void
language sql security definer set search_path = '' as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'url_proyecto')
           || '/functions/v1/tareas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'secreto_cron')),
    body := jsonb_build_object('tarea', tarea),
    timeout_milliseconds := 20000);
$$;
revoke execute on function public.llamar_tarea(text) from public, anon, authenticated;

select cron.schedule('conecta-minuto',  '* * * * *',  $$ select public.llamar_tarea('minuto') $$);
select cron.schedule('conecta-diaria',  '0 12 * * *', $$ select public.llamar_tarea('diaria') $$);   -- 09:00 Córdoba
select cron.schedule('conecta-resumen', '0 23 * * *', $$ select public.llamar_tarea('resumen') $$);  -- 20:00 Córdoba
select cron.schedule('conecta-limpieza', '30 3 * * *', $$
  delete from cron.job_run_details where end_time < now() - interval '3 days';
  delete from public.ejecuciones where inicio < now() - interval '14 days';
$$);
```

Confirmado: `cron.schedule` con un nombre existente reemplaza el trabajo (`on conflict … do update` en `pg_cron`), y el patrón de `vault.decrypted_secrets` dentro del trabajo es el de la guía oficial "schedule-functions".

### 6.10 `config.toml` (lo relevante)

```toml
project_id = "san-francisco-conecta-tp5"

[functions.vecino]
verify_jwt = false
[functions.adjuntos]
verify_jwt = false
[functions.despachar]
verify_jwt = false
[functions.tareas]
verify_jwt = false
```

### 6.11 Secretos y variables

| Secreto (Supabase) | Valor | Notas |
|---|---|---|
| `FIREBASE_PROJECT_ID` | `san-francisco-conecta-tp5` | |
| `FIREBASE_PROJECT_NUMBER` | `864192049474` | Del appId `1:864192049474:web:…` |
| `FIREBASE_SERVICE_ACCOUNT_B64` | JSON de la cuenta en base64 | Nunca en disco dentro del repositorio |
| `CRON_SECRET` | 32 bytes aleatorios en hex | El mismo valor va a Vault como `secreto_cron` |
| `ORIGENES_PERMITIDOS` | `https://san-francisco-conecta-tp5.web.app,https://san-francisco-conecta-tp5.firebaseapp.com,http://localhost:5175,http://127.0.0.1:5175` | CORS |
| `APPCHECK_MODO` | `monitor` (después `exigir`) | |
| `ADJUNTOS_BUCKET` | `adjuntos-reclamos` | |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEYS`, `SUPABASE_SERVICE_ROLE_KEY` | Los inyecta Supabase | `almacenamiento.ts` usa `JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')).default` y, si falta, `SUPABASE_SERVICE_ROLE_KEY` (las claves legacy dejan de tener soporte a fines de 2026). Una clave `sb_` nunca va en `Authorization` |

Cliente (`.env.local`): solo `VITE_SUPABASE_URL=https://qsxwsbdhlwyshqjfxaxw.supabase.co`. No hace falta ninguna clave de Supabase en el navegador.

### 6.12 Despliegue con la CLI (desde `app/`)

```bash
npx supabase link --project-ref qsxwsbdhlwyshqjfxaxw
npx supabase db push                                  # migraciones: bucket, tabla, cron
# Una vez, en el editor SQL del panel: los dos vault.create_secret de 6.9
npx supabase secrets set --env-file supabase/.secretos.env   # archivo ignorado por git; se borra después
npx supabase functions deploy vecino adjuntos despachar tareas --use-api
curl https://qsxwsbdhlwyshqjfxaxw.supabase.co/functions/v1/tareas   # → {"ok":true,…}
```

`--use-api` empaqueta en el servidor: no depende de Docker (que está instalado, pero la ruta del proyecto tiene espacios y está en OneDrive) ni de Deno local. El código TypeScript no se ejecuta en local; la lógica que importa vive en `shared/` y se prueba en Node.

### 6.13 Cliente de las funciones (`src/supabase/funciones.js`, WP6)

```js
export async function llamarFuncion(ruta, { cuerpo, formulario, metodo = 'POST', esperaMs = 20000 } = {});
// ruta: 'vecino/alta' | 'vecino/baja' | 'adjuntos/subir' | 'adjuntos/url' | 'despachar' | 'tareas'
// Agrega Authorization (obtenerTokenId) y X-Firebase-AppCheck (obtenerTokenAppCheck). Ninguna clave de Supabase.
// Devuelve `datos`; si { ok: false } lanza ErrorApp(error.codigo, error.mensaje); si fetch falla, ErrorApp('sin-conexion').
// Corta con AbortController a los esperaMs (adjuntos/subir usa 60000).
```

Importa solo `src/firebase/auth.js`, `src/firebase/appCheck.js`, `src/firebase/config.js` y `src/datos/errores.js`.

---

## 7. Sistema de componentes en React Native (WP5)

Todo se escribe con `View`, `Text`, `Pressable`, `ScrollView`, `TextInput`, `FlatList`, `Image`, `StyleSheet`, `ActivityIndicator`, `Linking`, `Modal`, `useWindowDimensions` y `AccessibilityInfo` de `react-native`. RNW 0.21.2 admite React 19 (su `peerDependencies` declara `^18 || ^19`) y las props `role` y `aria-*`, que se usan en lugar de las viejas `accessibilityRole`.

### 7.1 Tema (`src/tema/tokens.js`)

Colores tomados del CSS heredado y de `heredado:public/brand/README.md` (contraste ya revisado allí).

```js
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
  cuerpo:  { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  chico:   { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  antetitulo: { fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  numero:  { fontSize: 32, lineHeight: 38, fontWeight: '700', fontVariant: ['tabular-nums'] },
};
export const espacio = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };
export const radios = { chico: 10, medio: 12, grande: 18, pildora: 999 };
export const sombras = { tarjeta: { shadowColor: '#1e2939', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } } };
export const medidas = { toqueMinimo: 48, anchoMaximo: 1120, margenLateral: 16, anchoMenu: 260 };
export const cortes = { tableta: 600, escritorio: 900 };   // useWindowDimensions().width
```

`src/tema/servicios.js` reproduce `heredado:src/services.js`: `SERVICIOS = [{ ruta, nombre, corto, descripcion, icono, fondo, acento, tinta }]` para los 7 servicios en el orden bicicletas, tributos, reclamos, contactos, alarmas, estacionamiento, notificaciones, más `NAVEGACION = [inicio, ...SERVICIOS, cuenta]`.

`src/reset.css` (único CSS propio): `@font-face` de Quicksand desde `/fonts/quicksand-latin.woff2` con `font-display: swap`; `html, body, #root { height: 100% }`; `body { margin: 0; background: #f4f7fa; -webkit-text-size-adjust: 100% }`; foco visible `:focus-visible { outline: 3px solid #0077ae; outline-offset: 3px }`; `@media print` que oculta `[data-no-imprimir]`; `@media (prefers-reduced-motion: reduce)` sin animaciones. El CSS de Leaflet lo importa solo `MapaLeaflet.web.jsx`.

### 7.2 Componentes compartidos (`src/ui/`, exportados desde `src/ui/index.js`)

| Componente | Props (contrato) | Comportamiento |
|---|---|---|
| `Pantalla` | `titulo`, `bajada?`, `antetitulo?` (por defecto "TUS SERVICIOS MUNICIPALES"), `accion?` (nodo), `children`, `desplazable = true`, `testID` | `ScrollView` con ancho máximo 1120, margen lateral 16, fondo `colores.fondo`; dibuja `Encabezado`. Fija el título del documento con `useTituloDocumento` de `navegacion` |
| `Encabezado` | `antetitulo?`, `titulo`, `bajada?`, `accion?` | Título de página con `role="heading"` y `aria-level={1}` |
| `Seccion` | `titulo`, `accion?`, `children` | Subtítulo nivel 2 y separación |
| `Tarjeta` | `children`, `titulo?`, `accion?`, `tono = 'normal' \| 'destacada' \| 'alerta' \| 'peligro'`, `onPress?`, `etiquetaAccesible?`, `testID?`, `estilo?` | Con `onPress` es un `Pressable` con `role="button"` |
| `Boton` | `titulo`, `onPress?`, `variante = 'primario' \| 'secundario' \| 'texto' \| 'peligro'`, `icono?` (nombre de `Icono`), `cargando = false`, `deshabilitado = false`, `href?`, `externo?`, `ancho = 'auto' \| 'completo'`, `etiquetaAccesible?`, `testID?` | Alto mínimo 48. Con `cargando` muestra `ActivityIndicator` y queda deshabilitado. Con `href` abre con `abrirEnlace(href)` de `plataforma/enlaces` |
| `Campo` | `etiqueta`, `valor`, `onCambio`, `error?`, `ayuda?`, `placeholder?`, `multilinea = false`, `modoTeclado? ('text' \| 'numeric' \| 'tel' \| 'email')`, `mayusculas = false`, `maxLargo?`, `id`, `testID?` | Etiqueta visible arriba (no solo placeholder, UIX-06). **El error se dibuja debajo del campo** con `role="alert"`, y el campo recibe `aria-invalid` y borde `peligro`. `ayuda` va debajo cuando no hay error |
| `Selector` | `etiqueta`, `valor` (string, o array si `multiple`), `opciones: [{ valor, etiqueta, deshabilitada? }]`, `onCambio`, `multiple = false`, `variante = 'chips' \| 'lista'`, `error?`, `testID?` | `chips`: `Pressable` con `role="radio"` o `"checkbox"` y `aria-checked`. `lista`: botón que abre un `Dialogo` con `FlatList` |
| `Pestanas` | `opciones: [{ valor, etiqueta, contador? }]`, `valor`, `onCambio`, `testID?` | `role="tablist"` y `"tab"` con `aria-selected` |
| `EtiquetaEstado` | `texto`, `tono = 'exito' \| 'alerta' \| 'peligro' \| 'info' \| 'neutro'`, `icono?` | Píldora con texto, nunca solo color |
| `Aviso` | `tono`, `titulo?`, `mensaje`, `accion?: { titulo, onPress }`, `onCerrar?`, `rol = 'status' \| 'alert'` | Banner dentro de la página |
| `AvisoFlotante` + `ProveedorAvisos` + `useAvisoFlotante()` | `mostrar(mensaje, tono = 'exito', destino?)` | Toast abajo, 5 s, `role="status"`; se limpia al navegar (UIX-12) |
| `Vacio` | `icono`, `titulo`, `mensaje?`, `accion?: { titulo, onPress }` | Estado vacío |
| `Cargando` | `mensaje = 'Cargando…'`, `lineas?` | `ActivityIndicator` o esqueleto de `lineas` barras |
| `ErrorCarga` | `error: ErrorApp`, `onReintentar?` | "Reintentar" solo si el código es `sin-conexion` o `servidor` (UIX-05) |
| `Dialogo` | `visible`, `titulo`, `children`, `onCerrar`, `acciones: [{ titulo, onPress, variante, cargando, deshabilitado, testID }]`, `cerrable = true`, `testID?` | `Modal` transparente con `onRequestClose` (Escape en web), `role="dialog"`, `aria-modal`; el foco vuelve al disparador |
| `Mapa` | `puntos: PuntoMapa[]`, `seleccionado?`, `onSeleccionar?`, `ubicacion?: { lat, lng }`, `alto = 300`, `etiqueta` (descripción accesible), `testID?` | Envoltorio con `React.lazy` de `./MapaLeaflet` y `Cargando` de respaldo. Debajo del mapa muestra el nombre del punto seleccionado (como `heredado:MapView.jsx:91-95`) |
| `MapaLeaflet.web.jsx` | las mismas | Port de `heredado:src/MapView.jsx`. Leaflet se monta sobre un `View` de RN (en RNW su `ref` es el nodo DOM) con **alto explícito** (`alto`) y **sin hijos de React adentro**. Teselas `L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { crossOrigin: true, attribution })` (sin `{s}`: el servidor ya responde `access-control-allow-origin: *`, y con CORS el service worker puede guardar respuestas no opacas), `circleMarker` (evita el problema de las imágenes de marcador con el empaquetador), `polyline` para `tramo`, popups con nodos de texto, aviso "No se pudo cargar parte del mapa" ante `tileerror`, `ResizeObserver`, `scrollWheelZoom: false`. Importa `leaflet/dist/leaflet.css`. Registra la traza `carga_mapa` |
| `MapaLeaflet.jsx` | las mismas | Stub nativo: lista de los puntos |
| `Icono.web.jsx` / `Icono.jsx` | `nombre`, `tamano = 20`, `color = colores.texto`, `etiquetaAccesible?` | Web: lucide importado por archivo (`lucide-react/dist/esm/icons/<x>.js`, patrón de `heredado:src/icons.js`). Stub: `Text` vacío. Nombres: `inicio, bicicleta, tributo, reclamo, telefono, alarma, estacionamiento, campana, menu, cerrar, check, checkCirculo, chevron, reloj, descargar, correo, ubicacion, navegar, mas, buscar, ajustes, externo, mensaje, usuario, salir, panel, alerta, info, sinConexion, adjunto, imprimir, actualizar, instalar` |
| `Insignia` | `cantidad` | Contador de no leídas ("9+") |
| `FilaDato` | `etiqueta`, `valor` | Par etiqueta-valor |
| `Interruptor` | `etiqueta`, `valor`, `onCambio`, `deshabilitado?` | `role="switch"` |

`PuntoMapa = { id, lat, lng, titulo, detalles: string[], tono: 'normal' | 'activo' | 'alerta' | 'neutro', tramo?: { lat, lng }[] }`. Colores: normal `accion`, seleccionado `alertaAcento`, activo `peligro`, neutro `textoSuave` (como `heredado:MapView.jsx:37-43`).

`src/plataforma/enlaces.js` (WP5, **un solo archivo, React Native puro**): `abrirEnlace(url)` llama `Linking.openURL(url, '_self')` para `tel:`, `mailto:` y `sms:` y `Linking.openURL(url)` para `https:` (C2 y C3). En RNW 0.21, `openURL` con un solo argumento abre `_blank` con `noopener`, y para `mailto:`/`sms:` eso dejaría una pestaña en blanco; con `'_self'` se evita. React Native nativo ignora el segundo argumento. No hace falta un `enlaces.web.js`.

`src/pantallas/_Galeria.jsx` (WP5, solo en desarrollo, ruta `#/galeria`): muestra cada componente con sus variantes para revisarlos sin las pantallas.

### 7.3 Navegación por hash con enlaces profundos (`src/navegacion/`, WP5)

Formato: `#/<ruta>[/<id>][?clave=valor]`. Rutas (`RUTAS` de `shared/rutas.mjs`): `inicio`, `bicicletas`, `tributos`, `reclamos`, `contactos`, `alarmas`, `estacionamiento`, `notificaciones`, `cuenta`, `panel`, `galeria` (solo desarrollo).

| Enlace profundo | Abre |
|---|---|
| `#/bicicletas/b3` | Bicicletas con la estación b3 seleccionada |
| `#/tributos/T-1001` | Tributos con ese cedulón abierto |
| `#/reclamos/nuevo?estacion=b2` | Formulario de reclamo con categoría Bicicletas y la estación precargada (B4) |
| `#/reclamos/<id>` | Detalle de un reclamo |
| `#/alarmas/a1` | Alarma seleccionada en el mapa |
| `#/estacionamiento/p1` | Zona seleccionada |
| `#/notificaciones/<id>` | Notificación abierta y marcada como leída |

- `parsearHash(hash) → { nombre, id, params }` acepta también el formato heredado `#tributos` (los push viejos).
- `useRuta()` → `{ ruta, navegar(nombre, id?, params?), volver() }`. `navegar` cambia el hash y el enrutador escucha `hashchange`, siempre mediante `plataforma/hash.web.js` (`escucharHash(cb) → detener`, `leerHash()`, `escribirHash(h)`, `fijarTitulo(t)`, `subirAlInicio()`); `hash.js` es el stub nativo en memoria.
- `Enrutador.jsx` carga cada pantalla con `React.lazy` desde `src/pantallas/<Nombre>.jsx` (default export, prop `ruta`). `panel` exige `esAdmin` (del almacén); si no, redirige a `inicio`. Ruta desconocida → `inicio`.
- Al cambiar de ruta: desplaza arriba, mueve el foco al título (como `heredado:MunicipalApp.jsx:43-50`), registra `screen_view` y limpia el aviso flotante.
- `useTituloDocumento(titulo)` llama `fijarTitulo(titulo + ' · San Francisco Conecta')` de `plataforma/hash.web.js` (el único lugar que toca `document.title`).

Contrato de nombres de archivo de pantallas para el enrutador: `Inicio`, `Bicicletas`, `Tributos`, `Reclamos`, `Contactos`, `Alarmas`, `Estacionamiento`, `Notificaciones`, `Cuenta`, `PanelMunicipal`, más `Ingreso` (fuera del enrutador).

### 7.4 Marco, encabezado y pie institucional (`src/marco/`, WP5)

| Archivo | Contenido |
|---|---|
| `Marco.jsx` | Disposición: encabezado fijo arriba; en ancho ≥ 900 `MenuLateral` fijo a la izquierda; en < 900 `BarraInferior` y menú en `Modal`. Monta `ProveedorAvisos`, `BannerEmergencia`, `IndicadorConexion`, `ActualizacionDisponible` y muestra `alerta` del almacén como aviso flotante con botón "Ver" que navega a su `destino` |
| `EncabezadoInstitucional.jsx` | Logo `/brand/municipalidad-blanco.png` (`Image`), marca "Conecta · San Francisco", acceso a "Atención 147", campana con `Insignia` de `noLeidas` (`testID="boton-notificaciones"`), menú de cuenta |
| `LeyendaPrototipo.jsx` | **Siempre visible** debajo del encabezado en todas las pantallas, también en Ingreso: texto de `useConfigRemota().leyendaPrototipo` con su respaldo. `testID="leyenda-prototipo"`. Fondo `avisoFondo`, texto `aviso`, 13 px |
| `MenuLateral.jsx` | Las rutas de `NAVEGACION`, contador en Notificaciones, "Panel municipal" si corresponde, acceso 147 y cerrar sesión |
| `BarraInferior.jsx` | Inicio, Reclamos, Estacionar, Avisos (con insignia) y Menú. `role="tablist"` |
| `PieInstitucional.jsx` | Móvil: corto (leyenda, 147, portal municipal) para no alargar la página (UIX-13). Escritorio: las tres columnas de `heredado:MunicipalChrome.jsx:193-298` y la leyenda |
| `BannerEmergencia.jsx` | Muestra `bannerEmergencia` de Remote Config, o el aviso más reciente de tipo `emergencias` con `vigenteHasta > ahora` |
| `IndicadorConexion.jsx` | Sin red: "Sin conexión. Estás viendo los últimos datos guardados." |
| `ActualizacionDisponible.jsx` | **No registra el service worker** (eso pasa en `index.web.js`). Solo escucha `alHaberActualizacion` de `plataforma/registroSW` y muestra "Hay una versión nueva" → `aplicarActualizacion()`. Es RN puro: no necesita variante `.web` |

`App.jsx`: `useSesion()`. Mientras `!listo` muestra `Cargando`. Al montar llama `completarRedireccion()`; si devuelve `cuentaExistente`, la pasa a Cuenta (ruta `#/cuenta?vinculo=existente`) para ofrecer `cambiarACuentaExistente`. Sin usuario muestra `Ingreso`. Con usuario: `<ProveedorMunicipal usuario><Marco><Enrutador /></Marco></ProveedorMunicipal>` (el almacén se encarga de `asegurarAlta` cada vez que cambia el uid, 4.5) y, cuando el almacén queda `listo`, `iniciarServiciosDiferidos({ alTerminar: refrescarPush })`.

`src/index.web.js`:

```js
import './reset.css';
import './firebase/appCheck';          // antes que cualquier uso de Firestore
import { registrarServiceWorker } from './plataforma/registroSW';
import { AppRegistry } from 'react-native';
import App from './App';
registrarServiceWorker();              // desde la primera visita, también en Ingreso (instalación y uso sin red)
AppRegistry.registerComponent('SanFranciscoConecta', () => App);
AppRegistry.runApplication('SanFranciscoConecta', { rootTag: document.getElementById('root') });
```

---

## 8. Pantallas (fase 2, un agente por fila de la tabla 11.2)

Reglas comunes:

- Raíz `Pantalla` con `testID="pantalla-<ruta>"`. Datos de `useMunicipal(selector)`; comandos con `useComando(repositorio.x)`.
- **Cargando:** mientras `!listo`, `Cargando` con esqueleto. Si hay datos de la caché, se muestran enseguida (no se espera la red).
- **Vacío:** `Vacio` con un texto útil y, si aplica, la acción para salir del vacío.
- **Error:** errores de suscripción con `ErrorCarga` en la sección afectada; errores de comando junto al botón o al campo, nunca arriba de la página.
- Validación en el cliente con las mismas funciones de `shared/dominio.mjs` que replican las reglas, para mostrar el error antes de enviar.
- Toda operación con dinero pasa por un `Dialogo` de confirmación con el importe, el texto "Pago simulado, sin cargos reales" y el `requestId` generado al abrirlo.

### 8.1 Ingreso (`Ingreso.jsx`, S1)

- **Muestra:** marca y textos de bienvenida de `heredado:AuthGate.jsx:44-89`, los cuatro beneficios, botón "Entrar como invitado" (`testID="ingresar-invitado"`), "Continuar con Google" (`testID="ingresar-google"`, con el SVG heredado), aviso de privacidad breve (qué se guarda, que la ubicación nunca se guarda, Analytics anónimo, derecho a borrar los datos, Ley 25.326) y la leyenda.
- **Cubre:** protección de datos y usabilidad (el docente entra sin cuenta).
- **Usa:** `ingresarComoInvitado`, `ingresarConGoogle`, `mensajeDeError`; evento `login`. (`completarRedireccion` lo llama `App.jsx`.)
- **Estados:** botones con `cargando`; error de ingreso como `Aviso` debajo de los botones.

### 8.2 Cuenta (`Cuenta.jsx`, S1)

- **Muestra:** nombre y tipo de cuenta (se actualiza solo al vincular, porque `useSesion` escucha `onIdTokenChanged`); si es invitado, "Vincular con Google" (conserva el uid y los datos; `sesion.vincular()`), y ante `cuenta-existente` (del popup, o de `#/cuenta?vinculo=existente` después de un redirect) un `Dialogo` que ofrece entrar con esa cuenta avisando que **se borran** los datos del invitado (`sesion.cambiarACuentaExistente(credencial)`); "Instalar la app" (`plataforma/instalacion`: `beforeinstallprompt`, y en iOS la instrucción "Compartir, Agregar a inicio"); privacidad completa; "Borrar mis datos" con confirmación (`sesion.borrarCuentaYSalir()`); "Cerrar sesión"; versión de la app.
- **Invitado que cierra sesión:** no puede volver a entrar a esa cuenta anónima. "Cerrar sesión" abre un `Dialogo` que lo explica y ofrece solo "Vincular con Google" o "Borrar mis datos y salir" (`borrarCuentaYSalir`), para no dejar datos huérfanos. Con cuenta de Google, `sesion.salir()`.
- **Usa:** `sesion.vincular`, `sesion.cambiarACuentaExistente`, `sesion.salir`, `sesion.borrarCuentaYSalir`, `repositorio.aceptarPrivacidad`; eventos `vincular_cuenta`, `pwa_instalada`.
- `testID`: `vincular-google`, `cerrar-sesion`, `borrar-datos`, `confirmar-borrado`, `dialogo-invitado-salir`.
- `src/plataforma/instalacion.web.js` (S1): `useInstalacion()` → `{ disponible, esIOS, instalada, instalar() }`; `instalacion.js` stub.

### 8.3 Inicio (`Inicio.jsx`, S2)

- **Muestra:** título de `mensajeBienvenida`; la grilla de los 7 servicios **visible completa a 360 × 740 sin desplazar** (UIX-08), cada uno con un dato vivo (bicicletas disponibles en total, cedulones pendientes y vencidos, reclamos en seguimiento, alarmas activas, sesión de estacionamiento activa con el tiempo restante, no leídas); debajo, el último aviso visible y, si hay, el banner de emergencia.
- **Cubre:** navegación a todos los requisitos; B2, T3, R3, A2, E3 y N3 en resumen.
- **Usa:** solo `useMunicipal`.
- **Vacío:** "Estás al día" en avisos.
- `testID`: `servicio-<ruta>` en cada acceso.

### 8.4 Contactos (`Contactos.jsx`, S2)

- **Muestra:** `Selector` de categoría (Todas, Municipal, Emergencias, Salud), tarjetas por área con dirección y horario, y botones Llamar (`tel:`), Correo (`mailto:` con asunto), WhatsApp (`https://wa.me/<n>?text=` con un saludo) y Sitio. Arriba, una tarjeta destacada del 147 y el canal Tana.
- **Cubre:** C1, C2, C3.
- **Usa:** `contactos`; evento `contacto_usado`. Funciona sin conexión con la caché.
- **Vacío:** "No hay contactos en esta categoría".
- `testID`: `contacto-<id>`, `llamar-<id>`, `correo-<id>`, `whatsapp-<id>`.

### 8.5 Bicicletas (`Bicicletas.jsx`, S3)

- **Muestra:** `Mapa` con las estaciones (tono `neutro` si no hay bicicletas, `alerta` si está fuera de servicio), botón "Usar mi ubicación" (`plataforma/ubicacion`), lista ordenada por cercanía con la distancia (`ordenarPorCercania`), buscador por nombre, en cada tarjeta bicicletas y anclajes libres en números grandes, "actualizado hace N min" (`tiempoRelativo`), "Ver en mapa" y "Reportar problema" → `navegar('reclamos', 'nuevo', { estacion: id })`.
- **Cubre:** B1, B2 (cambia sola cuando el panel o el simulador mueven bicicletas), B3, B4.
- **Usa:** `estaciones`; eventos `estaciones_cercanas` y `problema_bici_reportado`. No escucha alarmas (COD-04).
- **Error:** permiso de ubicación denegado → `Aviso` con "Elegí una estación en el mapa" (texto de `heredado:platform.web.js:11-13`).
- `testID`: `estacion-<id>`, `bicicletas-<id>`, `usar-ubicacion`, `reportar-<id>`.
- Usa `ubicar` de `src/plataforma/ubicacion` (de WP3, 4.1).

### 8.6 Alarmas (`Alarmas.jsx`, S3)

- **Muestra:** `Mapa` con las alarmas (activa = tono `activo`), chips de zonas que sigue el vecino (A4; cambian `preferencias.zonas`), tarjetas con `EtiquetaEstado` "Activada"/"Desactivada" y "actualizada hace N min" (corrige el texto fijo de COD-13), e `Interruptor` "Avisarme si se activa una alarma cerca" (A3): su valor es `cercania.activa` del almacén (sobrevive al cambio de pantalla); al prenderlo llama `activarCercania()` y al apagarlo `desactivarCercania()` (el seguimiento y las escrituras los hace el almacén, 4.5). Muestra `cercania.error` si se negó la ubicación. Si el push no está activo en este dispositivo (`estadoPushLocal().activo`), ofrece activarlo con `sesion.activarPush()`.
- **Cubre:** A1, A2, A3, A4.
- **Usa:** `alarmas`, `preferencias`, `cercania`, `guardarPreferencias`, `activarCercania`, `desactivarCercania`, `sesion.activarPush`; eventos `zona_suscripta`, `cercania_activada` y `push_habilitado`.
- **Texto de privacidad:** "Tu ubicación no se guarda. Solo registramos qué alarmas están cerca durante 30 minutos."
- `testID`: `alarma-<id>`, `estado-alarma-<id>`, `zona-<zona>`, `interruptor-cercania`.

### 8.7 Tributos (`Tributos.jsx`, S4)

- **Muestra:** resumen "Total pendiente" (incluye vencidos); `Pestanas` Pendientes / Pagados; tarjetas con concepto, período, vencimiento y `EtiquetaEstado` (Vencido en `peligro`, Por vencer en `alerta` con "vence en N días", Pendiente, Pagado en `exito`); botones "Ver cedulón" y "Pagar". El cedulón se abre en un `Dialogo` con todos los datos, el código de pago (`codigoPagoTributo`) y "Imprimir o guardar PDF". El pago abre la confirmación (checkout simulado) y después muestra el comprobante. En Pagados, el historial de `pagos` de tipo tributo con "Cargar más" (T3).
- **Cubre:** T1 (consulta y emisión), T2 (pago), T3 (historial y estado), T4 (estado "por vencer" en la pantalla; las notificaciones de vencimiento las crea `vecino/alta` en el momento y la tarea diaria después, con push).
- **Usa:** `tributos`, `pagos`, `pagarTributo`, `cargarMas('pagos')` del almacén; eventos `tributo_pagado` y `cedulon_emitido`; traza `pago_tributo`.
- **Vacío:** "No tenés cedulones pendientes" con check. Mientras `vecino/alta` no terminó: "Consultando tus obligaciones…".
- **Errores:** `ya-pagado` (otra pestaña pagó) y `sin-conexion` dentro del diálogo.
- `testID`: `tributo-<id>`, `pagar-<id>`, `confirmar-pago`, `comprobante`, `ver-cedulon-<id>`.
- `src/plataforma/cedulon.web.js` (S4): `imprimirCedulon(tributo, info)` arma un HTML escapado (función `esc` de `heredado:platform.web.js:41-55`) con la leyenda de prototipo, lo carga en un `iframe` oculto y llama `print()`; si falla, abre la vista en una pestaña. Ya no descarga un `.html` (FUN-10, UIX-10). **VERIFICAR** la impresión desde `iframe` en Safari iOS.

### 8.8 Reclamos (`Reclamos.jsx` + `src/pantallas/reclamos/*`, S5)

- **Muestra:** formulario (R1) con categoría (`Selector` de chips), ubicación, descripción, adjuntos (R2: hasta 3; imágenes comprimidas en el cliente a 1600 px y JPEG 0,8; PDF de hasta 2 MiB; vista previa con miniatura o nombre y botón quitar) y "Enviar reclamo". Los errores van debajo de cada campo (UIX-04). Con `?estacion=b2` precarga la categoría Bicicletas y la ubicación con el nombre de la estación. Debajo, "Mis reclamos" con buscador por código, dirección o descripción (R4) sobre lo cargado y "Cargar más"; cada tarjeta con código, estado, categoría y dirección. El detalle (`#/reclamos/<id>`) muestra la línea de tiempo de `cronologia` (R3: recibido, en proceso, resuelto con fecha y hora), la nota municipal y los adjuntos con "Ver" (`urlAdjunto`).
- **Cubre:** R1, R2, R3 (en vivo: el panel o el simulador lo avanzan y la pantalla cambia sola), R4.
- **Usa:** `reclamos`, `crearReclamo` (con `alProgreso`), `urlAdjunto`, `cargarMas('reclamos')` del almacén; evento `reclamo_creado`; traza `alta_reclamo`.
- **Estados:** progreso "Subiendo archivos (1 de 3)…" (un archivo por solicitud); resultado con `enCola: true` → `Aviso` informativo "Sin conexión: tu reclamo se enviará cuando vuelvas a estar en línea", y la tarjeta muestra "Pendiente de envío" mientras `reclamo.pendiente` sea verdadero; con adjuntos y sin red, error `sin-conexion` junto al botón; vacío "Todavía no hiciste reclamos".
- `testID`: `campo-categoria`, `campo-direccion`, `campo-descripcion`, `adjuntar`, `enviar-reclamo`, `reclamo-<codigo>`, `buscar-reclamos`, `estado-reclamo-<codigo>`.
- `src/plataforma/archivos.web.js` (S5): `elegirArchivos({ maximo: 3 }) → Promise<ArchivoLocal[]>` con un `<input type="file">` creado en el momento y `accept="image/jpeg,image/png,application/pdf"` (en el celular ofrece la cámara); `prepararArchivo(archivo) → Promise<ArchivoLocal>` comprime con `canvas` y valida tipo y peso (`validarArchivo` de `shared/dominio.mjs`). `ArchivoLocal = { nombre, tipo, tamano, blob, vistaPrevia? }`. `archivos.js` stub.

### 8.9 Estacionamiento (`Estacionamiento.jsx`, S6)

- **Muestra:** `Mapa` con los tramos (E1) coloreados por zona; selector de zona con tarifa y `horarioTexto` y la etiqueta "En horario"/"Fuera de horario" (`enHorario`); campo patente (en mayúscula, error debajo); minutos con chips 15, 30, 60, 90, 120, 180 y 240; importe calculado con `costoEstacionamiento` en vivo; "Iniciar estacionamiento" → confirmación con importe y patente (E2). Sesiones activas: temporizador grande `HH:MM:SS` (`useAhora(1000)`, `role="timer"`), hora de fin, aviso visual cuando faltan menos de `config.avisoEstacionamientoMin` minutos (E3; la notificación local la dispara el almacén, no la pantalla), "Extender 15 min" y "Extender 30 min" con su importe (E4) y "Terminar ahora" con confirmación ("No se reintegra el tiempo no usado"). Historial de sesiones terminadas con "Cargar más".
- **Cubre:** E1, E2, E3, E4.
- **Usa:** `zonas`, `config.horarioEstricto`, `config.avisoEstacionamientoMin`, `sesiones`, `iniciarEstacionamiento`, `extenderEstacionamiento`, `finalizarEstacionamiento`, `cargarMas('estacionamiento')` del almacén; eventos `estacionamiento_iniciado`, `estacionamiento_extendido` y `estacionamiento_finalizado`; traza `inicio_estacionamiento`.
- **Errores:** `patente-ocupada` con la hora de fin; `fuera-de-horario`; `maximo-alcanzado`; `sesion-vencida`.
- **Vacío:** "Tu próximo lugar te espera" (texto heredado).
- `testID`: `zona-<id>`, `campo-patente`, `minutos-<n>`, `importe`, `iniciar-estacionamiento`, `confirmar-estacionamiento`, `temporizador-<sesionId>`, `extender-15-<sesionId>`, `finalizar-<sesionId>`, `confirmar-finalizar`, `aviso-por-vencer`.

### 8.10 Notificaciones (`Notificaciones.jsx`, S7)

- **Muestra:** `Pestanas` Todas / No leídas / Avisos de la ciudad / Mis trámites; "Marcar todas como leídas"; lista de `notificaciones` unidas con tipo, zona, fecha y punto de no leída; al abrir una (o con `#/notificaciones/<id>`) se marca leída y se ve el detalle con "Ir al servicio" (`destino`) y "Más información" (`enlace`) (N3). Interruptor "Ver todos los avisos de la ciudad" (sin filtrar por preferencias). Tarjeta de preferencias (N2): tipos (chips múltiples), zonas, frecuencia (Inmediata, Resumen diario, Solo historial) y "Avisos en este dispositivo" (`sesion.activarPush`/`sesion.desactivarPush`), cuyo valor sale de `estadoPushLocal()` (permiso del navegador y token guardado en este navegador), no de `preferencias.push`; con estado del permiso y explicación si el navegador no lo admite (en iOS, solo con la app instalada).
- **Cubre:** N1 (recibir push y verlo), N2, N3; también A4 (zonas compartidas con Alarmas).
- **Usa:** `notificaciones` (campo `fuente`), `noLeidas`, `preferencias`, `marcarLeida`, `marcarTodasLeidas`, `guardarPreferencias`, `cargarMas('notificaciones')` del almacén, `soportaPush`, `estadoPushLocal`, `sesion.activarPush`, `sesion.desactivarPush`; eventos `aviso_abierto`, `preferencias_guardadas`, `push_habilitado`.
- **Vacío:** "Estás al día. No hay avisos pendientes de lectura."
- `testID`: `notificacion-<id>`, `marcar-todas`, `tipo-<tipo>`, `frecuencia`, `interruptor-push`.

### 8.11 Panel municipal (`PanelMunicipal.jsx` + `src/pantallas/panel/*`, S8)

Visible solo si `esAdmin` (cuenta de Google con documento en `administradores`). Encabezado "Panel municipal de demostración" con la aclaración de que simula los sistemas municipales.

| Pestaña | Muestra | Usa |
|---|---|---|
| Reclamos | Últimos 50 reclamos de todos los vecinos (grupo de colecciones), filtro por estado **en el cliente**, botón "Pasar a En proceso" / "Marcar resuelto" con nota opcional | `useAdmin().reclamos`, `avanzarReclamo` |
| Alarmas | Lista con `Interruptor` activa/inactiva (única forma de activar una alarma en la demo) | `alarmas`, `cambiarAlarma` |
| Bicicletas | Por estación, botones − y + y "Fuera de servicio" | `estaciones`, `cambiarBicicletas` |
| Avisos | Formulario: título, cuerpo, detalle, tipo, zona (o todas), destino interno, enlace externo, vigencia en horas | `publicarAviso` |
| Demo | `Interruptor` simulador automático (bicicletas y reclamos) y cada cuántos minutos; `Interruptor` horario estricto; selector "Aviso de estacionamiento a los N minutos del fin" (1 a 14; 14 para la clase); "Ejecutar un paso del simulador ahora"; **"Enviar recordatorios ahora"** (T4) y **"Enviar resumen ahora"** (N2); "Restablecer valores de demo"; los últimos 20 eventos con estado y cantidad de push enviados | `config`, `configurarDemo`, `ejecutarTarea('simulador' \| 'diaria' \| 'resumen')`, `restablecerDemo`, `useAdmin().eventos` |

Cada acción registra `panel_accion`. Objetivo de la demo: el celular del vecino cambia en menos de 2 s sin recargar.

`testID`: `panel-pestana-<x>`, `avanzar-<reclamoId>`, `alarma-panel-<id>`, `mas-<estacionId>`, `menos-<estacionId>`, `publicar-aviso`, `simulador-ahora`, `recordatorios-ahora`, `resumen-ahora`, `aviso-estacionamiento-min`.

---

## 9. Service worker, manifiesto y PWA

### 9.1 `vite.config.mjs` (WP1)

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const extensiones = ['.web.jsx', '.web.js', '.web.mjs', '.jsx', '.js', '.mjs', '.json'];

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt',
      injectRegister: false,              // lo registra src/plataforma/registroSW.web.js, llamado desde index.web.js
      manifest: MANIFIESTO,               // 9.3
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,webmanifest}'],
        globIgnores: ['**/brand/README.md'],
        maximumFileSizeToCacheInBytes: 3_000_000,
      },
      devOptions: { enabled: mode === 'development', type: 'module' },
    }),
  ],
  resolve: { alias: { 'react-native': 'react-native-web' }, extensions: extensiones },
  optimizeDeps: { esbuildOptions: { resolveExtensions: extensiones, loader: { '.js': 'jsx' } } },
  define: { __DEV__: JSON.stringify(mode !== 'production') },
  server: { host: '127.0.0.1', port: 5175, strictPort: true },
  preview: { host: '127.0.0.1', port: 4175, strictPort: true },
  build: {
    target: 'es2022',
    emptyOutDir: true,                    // borra los service workers viejos de dist/
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@firebase/firestore') || id.includes('node_modules/firebase/firestore')) return 'firestore';
          if (id.includes('node_modules/@firebase/auth')) return 'auth';
          if (id.includes('node_modules/react-native-web')) return 'rnw';
          // leaflet NO va acá: queda en el chunk diferido del mapa (UIX-03)
        },
      },
    },
  },
}));
```

El modo `emulador` (`vite --mode emulador`) carga `.env.emulador`; `e2e` carga `.env.e2e`. Confirmado: vite-plugin-pwa 2.0.0 compila `sw.js` con la configuración de Vite (`mode`, `envDir`, `define`, `resolve`), así que `import.meta.env.VITE_*` funciona, y la salida por defecto (`es` con `inlineDynamicImports`, sin `import`) sirve como service worker clásico.

### 9.2 `src/sw.js` (WP4), único service worker

```js
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { rutaSegura } from '../shared/rutas.mjs';

self.addEventListener('message', (e) => { if (e.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/__\//] }));
// Teselas pedidas con crossOrigin (7.2): respuestas CORS con estado 200, nunca opacas
// (una opaca ocupa unos 7 MB de cuota en Chrome y CacheFirst no la guarda sin este plugin).
registerRoute(({ url }) => url.hostname === 'tile.openstreetmap.org',
  new CacheFirst({ cacheName: 'teselas-osm', plugins: [
    new CacheableResponsePlugin({ statuses: [200] }),
    new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 7 * 86400 }),
  ] }));

// Push de FCM sin el SDK firebase/messaging/sw: con una ventana visible ese SDK reenvía el mensaje
// a la página y no muestra nada, y WebKit revoca la suscripción si un push no termina en una
// notificación visible. Este manejador SIEMPRE muestra la notificación.
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data?.json()?.data ?? {}; } catch { /* cuerpo no JSON: se usan los textos por defecto */ }
  event.waitUntil(self.registration.showNotification(d.titulo || 'San Francisco Conecta', {
    body: d.cuerpo || 'Tenés un aviso nuevo.',
    tag: d.id || undefined,               // claveEntrega: reemplaza a la notificación local con la misma clave
    icon: '/icons/icono-192.png', badge: '/icons/insignia-96.png',
    data: { destino: rutaSegura(d.destino) },
  }));
});

// Lista de destinos permitidos y reutilización de la ventana: heredado:src/push-worker.js:4-35
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL('/' + rutaSegura(event.notification.data?.destino), self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (ventanas) => {
    const abierta = ventanas.find((c) => new URL(c.url).origin === self.location.origin);
    if (abierta) { await abierta.navigate(url); return abierta.focus(); }
    return clients.openWindow(url);
  }));
});
```

`rutaSegura(destino)` devuelve un hash válido (`#/…` con ruta en `RUTAS`) o `#/notificaciones`. Las rutas `/__/` (handler de Auth en el Hosting) quedan fuera de la navegación del service worker. `sw.js` ya no importa Firebase: es más liviano y no depende de la configuración web. La renovación de la suscripción (`pushsubscriptionchange`, que antes atendía el SDK) la cubre `refrescarPush()` al iniciar la app (4.7). Definición de terminado de WP4: comprobar en un teléfono real que `getToken` con esta registración entrega push con la app cerrada y con la app abierta.

### 9.3 Manifiesto

```js
const MANIFIESTO = {
  name: 'San Francisco Conecta (prototipo)',
  short_name: 'SF Conecta',
  description: 'Servicios al vecino de San Francisco. Prototipo académico UTN FRSF, sin vínculo oficial con la Municipalidad.',
  lang: 'es-AR', dir: 'ltr',
  start_url: '/#/inicio', scope: '/', id: '/',
  display: 'standalone', orientation: 'portrait',
  background_color: '#f4f7fa', theme_color: '#009ee2',
  categories: ['government', 'utilities'],
  icons: [
    { src: '/icons/icono-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icono-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  shortcuts: [
    { name: 'Nuevo reclamo', url: '/#/reclamos/nuevo' },
    { name: 'Estacionar', url: '/#/estacionamiento' },
    { name: 'Bicicletas', url: '/#/bicicletas' },
  ],
};
```

El ícono de la app es propio (una "C" blanca sobre `#009ee2`, como la marca de `heredado:AuthGate.jsx:91`), no el logo municipal. WP1 dibuja `public/icons/icono.svg`, genera los PNG **una sola vez** con la herramienta que tenga a mano y los versiona; no hay script de generación en el repositorio.

### 9.4 `index.html` (WP1)

`lang="es-AR"`, `viewport` con `viewport-fit=cover`, `theme-color`, descripción, `apple-touch-icon`, `favicon.svg`, `preload` de la fuente woff2. Dentro de `#root`, una pantalla de inicio estática en HTML y estilos en línea (marca "Conecta", la leyenda de prototipo y "Cargando…") para que el primer pintado no espere al JavaScript; RNW la reemplaza al montar. Esa pantalla es el elemento del LCP en frío (10.5). `<noscript>` con el 147. Entrada: `<script type="module" src="/src/index.web.js">`.

### 9.5 `firebase.json` y `firebase.pruebas.json` (WP1)

```json
{
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
  "remoteconfig": { "template": "remoteconfig.template.json" },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }],
    "headers": [
      { "source": "/assets/**", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
      { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
      { "source": "/index.html", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
      { "source": "/manifest.webmanifest", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
      { "source": "**", "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "geolocation=(self), camera=(self), microphone=()" },
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
        { "key": "Content-Security-Policy-Report-Only", "value": "default-src 'self'; script-src 'self' https://www.google.com https://www.gstatic.com https://apis.google.com https://www.googletagmanager.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://firebaseinstallations.googleapis.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.supabase.co; img-src 'self' data: blob: https://tile.openstreetmap.org https://lh3.googleusercontent.com https://*.supabase.co https://*.google-analytics.com; frame-src 'self' https://www.google.com https://san-francisco-conecta-tp5.firebaseapp.com; style-src 'self' 'unsafe-inline'; font-src 'self'" }
      ]}
    ]
  },
  "emulators": {
    "auth": { "host": "127.0.0.1", "port": 9099 },
    "firestore": { "host": "127.0.0.1", "port": 8085 },
    "ui": { "enabled": true, "host": "127.0.0.1", "port": 4005 },
    "hub": { "host": "127.0.0.1", "port": 4405 },
    "logging": { "host": "127.0.0.1", "port": 4505 },
    "singleProjectMode": true
  }
}
```

`firebase.pruebas.json` es igual en `firestore` y declara solo `emulators.auth` en 9098, `emulators.firestore` en 8086, `ui` deshabilitada y hub y logging en 4406 y 4506. `scripts/con-emuladores.mjs` lo pasa con `--config firebase.pruebas.json` (la CLI no acepta puertos por bandera).

Las URLs reservadas `/__/…` del Hosting se sirven antes que las reescrituras. `X-Frame-Options: SAMEORIGIN` no molesta en producción porque `authDomain` es el mismo origen, y en desarrollo `authDomain` es `firebaseapp.com` (5.2); igual, después del primer despliegue WI corre `curl -I https://san-francisco-conecta-tp5.web.app/__/auth/iframe` y lo anota. La política de contenido empieza en modo `Report-Only`: WI revisa las violaciones en la consola del navegador antes de pasarla a obligatoria.

### 9.6 Notificaciones y enlaces profundos, de punta a punta

1. El vecino activa "Avisos en este dispositivo": `sesion.activarPush()` → `obtenerTokenPush()` → `dispositivos/{id}`, `preferencias.push = true` y token guardado en el navegador.
2. El panel activa la alarma a2: lote alarma (`activacionId = ev-X`) + `eventos/ev-X` → `despachar`.
3. `despachar` crea `avisos/alarma-ev-X` (con `eventoId = ev-X`), elige los destinatarios con `decidirEntrega` y la cercanía, y envía FCM con `data.id = 'ev-X'` y `destino: '#/alarmas/a2'`.
4. El evento `push` de `sw.js` **siempre** muestra la notificación con `tag = 'ev-X'`, con la app abierta o cerrada. Al tocarla abre o enfoca la ventana en `/#/alarmas/a2`.
5. Si la app está abierta, el almacén recibe por `onSnapshot` la alarma activa, el aviso y, si corresponde, la notificación personal: las tres tienen `claveEntrega = 'ev-X'`, así que `registrarEntrega` deja pasar solo la primera y se ve **un** aviso flotante con "Ver". Si la pestaña está oculta, la notificación local usa el mismo `tag` y el sistema operativo la fusiona con la del push.
6. E3: con la sesión dentro del umbral, el almacén muestra el aviso y la notificación local con `tag = est-<sesionId>-<finMs>-por_vencer`; un minuto después como máximo la tarea `minuto` manda el push con ese mismo `data.id`, que la reemplaza.

---

## 10. Estrategia de pruebas

| Nivel | Herramienta | Archivos | Script | Dueño |
|---|---|---|---|---|
| Dominio | `node --test` | `tests/unidad/dominio.test.mjs`, `recordatorios.test.mjs`, `notificaciones.test.mjs`, `rutas.test.mjs`, `catalogo.test.mjs`, `simulador.test.mjs`, `formato.test.mjs` | `npm test` | WP2 |
| Mapeadores y errores | `node --test` | `tests/unidad/mapeadores.test.mjs`, `errores.test.mjs` | `npm test` | WP3 |
| React Native de verdad | Node | `scripts/verificar-rn.mjs` | dentro de `npm test` | WP1 |
| Reglas | `@firebase/rules-unit-testing` 5.0.1 contra el emulador de Firestore | `tests/reglas/*.test.mjs` | `npm run test:reglas` | WP3 |
| Extremo a extremo | Playwright contra Vite (`--mode e2e`) + emuladores de Auth y Firestore + `edge-simulado` | `tests/e2e/<pantalla>.spec.mjs` | `npm run test:e2e` | WP1 la infraestructura; S1..S8 sus specs |
| Accesibilidad | `@axe-core/playwright` dentro de cada spec de pantalla | `tests/e2e/accesibilidad.mjs` (ayudante) | `npm run test:e2e` | WP1 el ayudante; S1..S8 lo llaman |
| Humo | Playwright contra `https://san-francisco-conecta-tp5.web.app` | `tests/humo/publicado.spec.mjs` | `npm run test:humo` | WI |
| Carga | Playwright con red y CPU limitadas | `tests/carga/medir-carga.mjs` | `npm run test:carga` | WI |
| Peso del paquete | Node + gzip | `scripts/presupuesto.mjs` | dentro de `npm run build` | WP1 |
| Dispositivos reales | Manual, con planilla | `docs/pruebas/dispositivos.md` | | WI |

### 10.1 Dominio (`tests/unidad/`)

- `dominio.test.mjs`: los casos de `heredado:tests/domain.test.mjs` con los nombres nuevos (tarifa proporcional y bloques, patentes válidas e inválidas, distancia, firmas de archivo con `Uint8Array`) más `enHorario` (lunes 8:00 y 19:59 sí, 20:00 no, sábado no en p1, sábado 9:00 sí en p3, con la hora de Córdoba), `estadoTributo` (pagado, vencido, por vencer a 3 días, pendiente), `siguienteEstadoReclamo`, `codigoReclamo`, `comprobante` (cumple la expresión de las reglas), `codigoPagoTributo` (dígito verificador Luhn), `validarPreferencias`, `recortarNombreArchivo` (100 caracteres).
- `recordatorios.test.mjs`: los casos de `heredado:tests/reminders.test.mjs` (umbral, sin duplicados por clave, vencido, pago, umbral de minutos configurable de 1 a 14, al finalizar, después de extender y después de finalizar antes de tiempo).
- `notificaciones.test.mjs`: los casos de `shouldAlert` heredados con `decidirEntrega`, más emergencias que ignoran la zona, `resumen_diario`, `solo_historial`, `unirNotificaciones` (orden, leídas por `avisosLeidos`, filtro por preferencias, campo `fuente`) y `claveEntrega` (alarma, aviso y notificaciones `alarma-`/`reclamo-` de un mismo evento dan la misma clave; E3 y T4 dan su id).
- `catalogo.test.mjs`: ids únicos; tarifas múltiplo de 4; coordenadas dentro de San Francisco (lat −31,47 a −31,39; lng −62,14 a −62,04); zonas y categorías válidas; los valores de las listas de las reglas coinciden con `shared/constantes.mjs` (lee `firestore.rules` como texto y compara).
- `simulador.test.mjs`: `planificarPaso` con un generador aleatorio con semilla: nunca sale de `[0, capacidad]`, **no devuelve cambios de alarmas**, avanza reclamos solo un paso y respeta los máximos.

### 10.2 Reglas (`tests/reglas/`)

`scripts/con-emuladores.mjs "node --test --test-concurrency=1 tests/reglas/"` arranca solo el emulador de Firestore con `firebase.pruebas.json` (puerto 8086, proyecto `demo-conecta-tp5`, Java 21 como en `heredado:scripts/test-firebase.mjs:11-16`). Cada archivo usa `initializeTestEnvironment({ firestore: { rules: readFileSync('firestore.rules', 'utf8') } })`, siembra con `withSecurityRulesDisabled` y prueba con `assertSucceeds`/`assertFails`. Los usuarios de prueba llevan `firebase.sign_in_provider` en el token (`anonymous` o `google.com`). Los escenarios de `tests/firebase/*.test.mjs` heredados se reescriben aquí.

| Archivo | Casos mínimos |
|---|---|
| `catalogo.test.mjs` | Lectura pública sin sesión; vecino no escribe; admin cambia bicicletas válidas; bicicletas mayores que la capacidad se rechazan; activar alarma sin evento en el lote se rechaza y con evento pasa; desactivar sin evento pasa; aviso del admin con evento pasa y sin evento no; aviso con tipo `alarmas` desde el cliente se rechaza; **un admin anónimo (con documento en `administradores`) se rechaza** |
| `vecino.test.mjs` | Dueño crea y lee su perfil; otro no lo lee; campos extra (`email`, `altaEn`) se rechazan; preferencias con zona o tipo inválido se rechazan; `cercania.vence` a más de 61 min se rechaza; nadie hace `list` de `usuarios` |
| `tributos.test.mjs` | Pago correcto en lote (pago + tributo) pasa; importe distinto se rechaza; pagar un tributo pagado se rechaza; repetir el mismo `requestId` se rechaza (idempotencia); pagar el tributo de otro se rechaza; actualizar el tributo sin el pago en el lote se rechaza |
| `estacionamiento.test.mjs` | Inicio con importe = tarifa × minutos / 60 pasa; importe distinto, minutos no múltiplo de 15 o mayor que 240 se rechazan; con `horarioEstricto` fuera de horario se rechaza y sin él pasa (se controla sembrando el horario de la zona con todos los días y horas, o ninguno); `dayOfWeek()` del lunes vale 1; patente bloqueada por otro vecino se rechaza y vencida pasa; **otro vecino que crea una sesión con el mismo `sesionId` del bloqueo ajeno no lo toma**; el bloqueo no tiene `uid`; sesión sin bloqueo o sin pago en el lote se rechaza; extensión válida pasa; extensión de sesión vencida, que supera 240 o con importe mal calculado se rechaza; **finalizar con `fin = serverTimestamp` y el bloqueo en el mismo lote pasa; finalizar sin el bloqueo, con otro `fin` o sobre una sesión vencida se rechaza; después de finalizar, otro vecino toma la patente** |
| `reclamos.test.mjs` | Crear válido pasa; estado inicial distinto de `recibido` se rechaza; adjunto con ruta de otro uid se rechaza; 4 adjuntos se rechazan; nombre de adjunto de 101 caracteres se rechaza; el vecino no cambia el estado; admin pasa `recibido → en_proceso` con evento; saltar a `resuelto` se rechaza; admin lista el grupo `reclamos`, el vecino no |
| `notificaciones.test.mjs` | Crear una personal válida de tipo `tributos` pasa y de tipo `obras` no; marcar leída pasa; cambiar el título no; **marcar dos veces el mismo aviso en `avisosLeidos` pasa** (idempotente); `avisosLeidos` y `dispositivos` solo del dueño, con id de 32 hex |
| `admin.test.mjs` | `administradores` no se escribe desde el cliente; el dueño lee el suyo; `eventos` no se actualiza ni borra; `municipal/config` solo cambia los campos permitidos; `avisoEstacionamientoMin` fuera de 1..14 se rechaza |

### 10.3 Extremo a extremo (`tests/e2e/`)

- `playwright.config.mjs` (WP1): proyectos **`Pixel 7` (Chromium) e `iPhone 13` (WebKit)**; Desktop Firefox solo corre en la prueba de humo. `webServer` con `node scripts/emuladores.mjs --e2e`, que levanta Auth (9098) y Firestore (8086) con `firebase.pruebas.json`, siembra con `scripts/sembrar.mjs --emulador --e2e` (catálogo con `horarioEstricto: false`), arranca `tests/e2e/edge-simulado.mjs` (puerto 8787) y `vite --mode e2e` (puerto 5176). `reporter: [['list'], ['junit', { outputFile: 'docs/pruebas/e2e-junit.xml' }]]`.
- `tests/e2e/fixtures.mjs` (WP1) exporta: `test` extendido con `vecino` (entra como invitado y espera `html[data-listo="true"]`), `admin` (usuario **Google** del emulador creado con `globalThis.__conectaE2E.ingresarGoogleFalso('admin-e2e', 'Admin E2E')` de 5.2, al que se le crea `administradores/{uid}` con el Admin SDK), `adminDb` (firebase-admin contra el emulador), `sembrarVecino(uid)`, `geolocalizar(context, { lat, lng })` y `adelantarReloj(page, ms)`, que usa **`page.clock.setSystemTime`** (no `clock.install()`, que reemplaza los temporizadores y rompe el SDK de Firestore). **Después de adelantar el reloj no se escribe**: las reglas comparan con el `request.time` real y la escritura fallaría en `finCercano`. Para E3 la prueba fija antes `avisoEstacionamientoMin = 14` con `adminDb` y adelanta 61 s.
- `tests/e2e/edge-simulado.mjs` (WP1): servidor Node que implementa el contrato HTTP de 6.3 para `vecino/alta` (con `datosInicialesVecino`, los recordatorios inmediatos y firebase-admin contra el emulador), `vecino/baja` (incluye borrar el usuario del emulador de Auth), `adjuntos/subir` (un archivo; valida con `shared/dominio.mjs` y guarda en una carpeta temporal), `adjuntos/url`, `despachar` (marca el evento como enviado) y `tareas` (`diaria` y `resumen` devuelven conteos). No verifica la firma del token (el emulador no firma), pero **decodifica el payload y aplica el mismo criterio de `exigirAdmin`** (rechaza anónimos con 403), así la diferencia entre reglas y Supabase aparece en las pruebas.
- `tests/e2e/accesibilidad.mjs` (WP1): `revisarAccesibilidad(page, nombre)` corre `@axe-core/playwright` con las etiquetas `wcag2a` y `wcag2aa` y falla con violaciones de impacto `serious` o `critical`. Cada spec de pantalla la llama una vez por pantalla.
- Specs por agente y lo que prueban como mínimo:

| Spec | Dueño | Prueba |
|---|---|---|
| `ingreso.spec.mjs` | S1 | Leyenda visible; entrar como invitado; datos semilla visibles; las notificaciones de vencimiento de T-1001 y T-0999 aparecen sin esperar; axe |
| `cuenta.spec.mjs` | S1 | Invitado que toca "Cerrar sesión" ve el diálogo; "Borrar mis datos y salir" vuelve a Ingreso y el usuario ya no existe en el emulador de Auth; axe |
| `inicio.spec.mjs` | S2 | Los 7 accesos visibles a 360 × 740 sin desplazar; sin desborde horizontal a 320 px; enlace profundo `#/tributos`; axe |
| `contactos.spec.mjs` | S2 | Con `window.open` espiado por `addInitScript`, Correo abre `mailto:` con `_self` y WhatsApp `https://wa.me/…`; el botón Llamar tiene el número en su etiqueta accesible; filtro por categoría; axe |
| `bicicletas.spec.mjs` | S3 | Marcadores en el mapa; con geolocalización simulada el orden cambia; el admin cambia bicicletas y la tarjeta cambia en menos de 2 s; "Reportar problema" abre el reclamo precargado; axe |
| `alarmas.spec.mjs` | S3 | Activar una alarma desde `adminDb` cambia la etiqueta en vivo y muestra **un solo** aviso flotante; seguir una zona guarda la preferencia; la cercanía guarda ids y no coordenadas y sigue activa al volver de otra pantalla; axe |
| `tributos.spec.mjs` | S4 | Estados vencido, por vencer y pagado; pagar muestra el comprobante y pasa a Pagados; el cedulón se abre; axe |
| `reclamos.spec.mjs` | S5 | Errores junto al campo con el formulario vacío; reclamo con un PNG aparece como Recibido; sin red (`context.setOffline(true)`) un reclamo sin adjuntos devuelve el control en menos de 3 s y aparece "Pendiente de envío", y al volver la red pasa a Recibido; búsqueda; avance del admin visible en la línea de tiempo; axe |
| `estacionamiento.spec.mjs` | S6 | Patente inválida con error junto al campo; inicio con importe correcto; con umbral 14 y `adelantarReloj` aparece el aviso por vencer; extender suma el tiempo; "Terminar ahora" cierra la sesión y otro vecino puede usar la patente; la misma patente desde otro vecino con la sesión activa da `patente-ocupada`; axe |
| `notificaciones.spec.mjs` | S7 | Un aviso creado por el admin aparece; marcar leída baja el contador; marcar todas dos veces no falla; cambiar la frecuencia se guarda; filtro por preferencias; axe |
| `panel.spec.mjs` | S8 | Sin admin la ruta redirige; un invitado con documento de admin no ve el panel; con admin Google: avanzar un reclamo, activar una alarma, mover bicicletas, publicar un aviso, "Enviar recordatorios ahora"; axe |
| `pwa.spec.mjs` | WI | Sobre `vite preview` (build): manifiesto válido; service worker activo **ya en la pantalla de Ingreso**; recarga sin red con datos de la caché |

### 10.4 Humo contra la URL publicada (WI)

`playwright.humo.config.mjs` con `baseURL: 'https://san-francisco-conecta-tp5.web.app'`, proyectos Pixel 7, iPhone 13 y Desktop Firefox. Un `page.addInitScript` asigna `self.FIREBASE_APPCHECK_DEBUG_TOKEN = process.env.APPCHECK_TOKEN_HUMO` (token de depuración registrado en la consola, nunca versionado), porque un navegador sin interfaz puede sacar un puntaje bajo de reCAPTCHA. `publicado.spec.mjs`: responde 200 con HTTPS; leyenda visible; `link[rel=manifest]` presente; service worker activo; entrar como invitado; ver estaciones, tributos y las notificaciones de vencimiento; `GET /functions/v1/tareas` devuelve `ok`; sin errores de consola; al final "Borrar mis datos". App Check se mantiene en modo monitor hasta pasar esta prueba y medir (5.4). La corrida de las tareas programadas contra producción (índices) es de WP6 (11.4).

### 10.5 Medición de carga (WI) y presupuesto (WP1)

`tests/carga/medir-carga.mjs`: Chromium a 390 × 844, red emulada por CDP (150 ms de latencia, 1,6 Mbps de bajada, 750 kbps de subida) y CPU ×4. Cinco corridas de visita en frío (contexto nuevo) y cinco de visita repetida (mismo contexto, con service worker y caché de Firestore), **cada serie con App Check encendido y apagado** (`VITE_APPCHECK_DESACTIVADO=true` en un build de medición). Mide el LCP (`PerformanceObserver`) y el tiempo hasta `html[data-listo="true"]`. Escribe la mediana y el percentil 90 en `docs/pruebas/carga.json`.

**Criterio del requisito "carga en menos de 3 s"** (los dos obligatorios):
1. **Visita en frío:** LCP por debajo de 3 s. El elemento del LCP es la pantalla estática de `index.html` (9.4), que no espera al JavaScript.
2. **Visita repetida:** `data-listo` por debajo de 3 s (service worker y caché de Firestore).
El tiempo hasta `data-listo` en frío se informa como dato, junto con la traza `inicio_con_datos` de Performance Monitoring en celulares reales.

`scripts/presupuesto.mjs`: falla el build si el JavaScript que carga `index.html` antes del primer pintado supera el presupuesto, o si `leaflet` aparece en él. **El presupuesto lo fija WP1 en la fase 0** midiendo un esqueleto con los SDK reales (React, react-dom, RNW con los componentes de 7.2, `firebase/app`, App Check, Auth con `initializeAuth` y Firestore). Las mediciones del crítico dan unos 293 KB con gzip antes del código propio (Firestore 129,8; React y react-dom 62,7; RNW 54,7; Auth 32,2; app y App Check 13,0), así que el **valor inicial es 340 KB con gzip** y WP1 lo reemplaza por la medición del esqueleto más 40 KB para el código propio. Se acepta porque el requisito se cumple con la pantalla estática en frío y con el service worker en la visita repetida.

### 10.6 Scripts de `package.json` (WP1)

```json
{
  "dev": "vite",
  "dev:emuladores": "node scripts/emuladores.mjs",
  "build": "vite build && node scripts/presupuesto.mjs",
  "preview": "vite preview",
  "test": "node scripts/verificar-rn.mjs && node --test tests/unidad/",
  "test:reglas": "node scripts/con-emuladores.mjs \"node --test --test-concurrency=1 tests/reglas/\"",
  "test:e2e": "playwright test --config playwright.config.mjs",
  "test:humo": "playwright test --config playwright.humo.config.mjs",
  "test:carga": "node tests/carga/medir-carga.mjs",
  "test:todo": "npm test && npm run test:reglas && npm run build && npm run test:e2e",
  "sembrar:emulador": "node scripts/sembrar.mjs --emulador",
  "sembrar:produccion": "node scripts/sembrar.mjs --produccion",
  "capturas": "node scripts/capturas.mjs",
  "deploy:reglas": "firebase deploy --only firestore",
  "deploy:remoteconfig": "firebase deploy --only remoteconfig",
  "deploy:hosting": "npm run build && firebase deploy --only hosting",
  "deploy:supabase": "supabase db push && supabase functions deploy vecino adjuntos despachar tareas --use-api",
  "deploy": "npm run deploy:reglas && npm run deploy:remoteconfig && npm run deploy:hosting && npm run deploy:supabase"
}
```

`scripts/sembrar.mjs --produccion` usa firebase-admin con `GOOGLE_APPLICATION_CREDENTIALS` apuntando a un archivo fuera del repositorio; crea el catálogo y `municipal/*` solo si faltan (`--forzar` los reescribe, incluido `avisoEstacionamientoMin`).

---

## 11. Reparto de trabajo para agentes en paralelo

### 11.1 Fases

| Fase | Paquetes | Condición para empezar | Duración relativa |
|---|---|---|---|
| 0. Arranque | WP1 (primera parte: dependencias del Anexo B, `vite.config.mjs`, borrar lo heredado, carpetas vacías, **medición del esqueleto con los SDK reales y presupuesto fijado**) | Ninguna | Corta; los demás esperan solo a `npm install` |
| 1. Cimientos | WP1 (resto), WP2, WP3, WP4, WP5, WP6 en paralelo | Fase 0 | La más larga |
| 2. Pantallas | S1 a S8 en paralelo | Fase 1 terminada y `npm test`, `npm run test:reglas` y `npm run build` en verde | Media |
| 3. Integración | WI | Fase 2 | Corta |

En la fase 1 cada agente programa contra los contratos de este documento, no contra el código de los otros. Si necesita algo de otro paquete que todavía no existe, crea un doble de prueba **dentro de sus propios archivos de prueba**, nunca en archivos ajenos.

**Protocolo de commits.** Ningún agente ejecuta `git add` ni `git commit`. Al cerrar cada fase, el orquestador revisa que cada paquete tocó solo sus archivos (`git status` contra la tabla 11.2) y hace **un commit por paquete** (`WP3: reglas, repositorio y almacén`), con la línea de coautoría que corresponda. Así la historia del repositorio público queda legible y no hay conflictos de `index.lock`.

### 11.2 Paquetes y archivos de los que es dueño cada uno

| Paquete | Dueño exclusivo de | Lee los contratos de |
|---|---|---|
| **WP1 Base del proyecto** | `package.json`, `package-lock.json`, `.npmrc`, `vite.config.mjs`, `index.html`, `firebase.json`, `firebase.pruebas.json`, `.firebaserc`, `.gitignore`, `.env.example`, `.env.emulador`, `.env.e2e`, `playwright.config.mjs`, `public/**`, `scripts/emuladores.mjs`, `scripts/con-emuladores.mjs`, `scripts/verificar-rn.mjs`, `scripts/presupuesto.mjs`, `tests/e2e/fixtures.mjs`, `tests/e2e/edge-simulado.mjs`, `tests/e2e/accesibilidad.mjs`. Borra lo marcado en 1.2 | 0, 2.4 y Anexo A (para `edge-simulado`), 5.2 (`__conectaE2E`), 6.3, 6.8, 9, 10 |
| **WP2 Dominio compartido** | `shared/*.mjs`, `tests/unidad/{dominio,recordatorios,notificaciones,rutas,catalogo,simulador,formato}.test.mjs` | 2, 3 (constantes de las reglas), Anexo A |
| **WP3 Datos y reglas** | `firestore.rules`, `firestore.indexes.json`, `src/datos/**` (`repositorio`, `mapeadores`, `errores`, `almacen`, `sesion`, `useComando`, `useAdmin`, `useAhora`), `src/plataforma/red*.js`, `src/plataforma/ubicacion*.js`, `scripts/sembrar.mjs`, `tests/reglas/**`, `tests/unidad/{mapeadores,errores}.test.mjs` | 2, 3, 4, Anexo A, 5.1 a 5.9 (`db`, `auth`, mensajería, `mostrarNotificacionLocal`, `leerConfig`, `registrarEvento`, `medir`), 6.13 (`llamarFuncion`) |
| **WP4 Servicios de Firebase y PWA** | `src/firebase/**`, `src/sw.js`, `src/plataforma/notificacionesLocales*.js`, `src/plataforma/registroSW*.js`, `remoteconfig.template.json` | 4.2 (`ErrorApp`), 5, 9.2, 9.6, Anexo A (`rutaSegura`) |
| **WP5 Interfaz base** | `src/index.web.js`, `src/App.jsx`, `src/reset.css`, `src/tema/**`, `src/ui/**`, `src/navegacion/**`, `src/marco/**`, `src/plataforma/enlaces.js`, `src/plataforma/hash*.js`, `src/pantallas/_Galeria.jsx` | 4.5 (`useMunicipal`, `ProveedorMunicipal`, `descartarAlerta`), 4.7 (`refrescarPush`), 5.1 (`iniciarServiciosDiferidos`, `registroSW`), 5.2 (`useSesion`, `completarRedireccion`), 5.7 (`useConfigRemota`), 7 |
| **WP6 Supabase** | `supabase/**`, `src/supabase/funciones.js` y, solo si hace falta el plan B de 6.2, `scripts/copiar-shared.mjs` | 2, 4.2 (códigos de error), 5.2 (`obtenerTokenId`), 5.4 (`obtenerTokenAppCheck`), 6, Anexo A |
| **S1 Ingreso y Cuenta** | `src/pantallas/Ingreso.jsx`, `src/pantallas/Cuenta.jsx`, `src/pantallas/cuenta/**`, `src/plataforma/instalacion*.js`, `tests/e2e/{ingreso,cuenta}.spec.mjs` | 4, 5.2, 7, 8.1, 8.2 |
| **S2 Inicio y Contactos** | `src/pantallas/Inicio.jsx`, `src/pantallas/Contactos.jsx`, `tests/e2e/{inicio,contactos}.spec.mjs` | 4, 7, 8.3, 8.4 |
| **S3 Bicicletas y Alarmas** | `src/pantallas/Bicicletas.jsx`, `src/pantallas/Alarmas.jsx`, `src/pantallas/{bicicletas,alarmas}/**`, `tests/e2e/{bicicletas,alarmas}.spec.mjs` | 4, 5.8, 7, 8.5, 8.6 |
| **S4 Tributos** | `src/pantallas/Tributos.jsx`, `src/pantallas/tributos/**`, `src/plataforma/cedulon*.js`, `tests/e2e/tributos.spec.mjs` | 4, 7, 8.7 |
| **S5 Reclamos** | `src/pantallas/Reclamos.jsx`, `src/pantallas/reclamos/**`, `src/plataforma/archivos*.js`, `tests/e2e/reclamos.spec.mjs` | 4, 7, 8.8 |
| **S6 Estacionamiento** | `src/pantallas/Estacionamiento.jsx`, `src/pantallas/estacionamiento/**`, `tests/e2e/estacionamiento.spec.mjs` | 4, 7, 8.9 |
| **S7 Notificaciones** | `src/pantallas/Notificaciones.jsx`, `src/pantallas/notificaciones/**`, `tests/e2e/notificaciones.spec.mjs` | 4, 5.8, 7, 8.10 |
| **S8 Panel municipal** | `src/pantallas/PanelMunicipal.jsx`, `src/pantallas/panel/**`, `tests/e2e/panel.spec.mjs` | 4 (comandos admin, `useAdmin`), 7, 8.11 |
| **WI Integración** | `README.md` (con el guion de la demo de la sección 16), `playwright.humo.config.mjs`, `tests/humo/**`, `tests/carga/**`, `tests/e2e/pwa.spec.mjs`, `scripts/capturas.mjs`, `docs/pruebas/**` (incluida `dispositivos.md`). Puede corregir cualquier archivo **solo** para arreglar una incompatibilidad entre paquetes, y lo anota | Todo |

Dueño de cada archivo de `src/plataforma/` (para que no haya dudas): `red` y `ubicacion` WP3; `notificacionesLocales` y `registroSW` WP4; `enlaces` y `hash` WP5; `instalacion` S1; `cedulon` S4; `archivos` S5. Cada uno con su variante `.web.js` y su stub `.js`, salvo `enlaces.js`, que es uno solo.

Archivos que nadie debe tocar salvo su dueño: `package.json` (pedirle a WP1 cualquier dependencia que falte; la lista completa ya está en el Anexo B), `firestore.rules` y `shared/`. Ningún paquete crea archivos fuera de su lista; si necesita uno nuevo dentro de su carpeta (`src/pantallas/<suya>/**`, `src/ui/**` para WP5), puede.

### 11.3 Dependencias entre paquetes (qué contrato usa cada uno)

```
WP2 shared ─────────────────────► todos (funciones puras, sin dependencias)
src/datos/errores.js (WP3) ─────► WP4, WP6 (no importa nada)
WP4 firebase/*, registroSW ─────► WP3, WP5, WP6
WP6 llamarFuncion ──────────────► WP3 (repositorio y sesion)
WP3 repositorio, almacén, sesión ► WP5 (App, Marco), S*
WP5 ui, navegación, marco ──────► S*
WP1 base, e2e ──────────────────► S* (fixtures), WI
```

Grafo de imports **sin ciclos** a nivel de archivo: `src/firebase/*` importa solo los SDK, `config.js`, `src/datos/errores.js` y `src/plataforma/registroSW`; `src/supabase/funciones.js` importa `firebase/{auth,appCheck,config}` y `errores.js`; `src/datos/*` importa `firebase/*`, `supabase/funciones.js`, `shared/` y `plataforma/{red,ubicacion,notificacionesLocales}`; `src/datos/useComando.js` ya no importa nada de WP5 (recibe `alExito`); WP5 importa `datos/` y `firebase/`. `diferidos.js` llama `refrescarPush` mediante el parámetro `alTerminar` que le pasa `App.jsx`, no por import.

### 11.4 Definición de terminado por paquete

- **WP1:** `npm install` limpio; presupuesto fijado con la medición del esqueleto y anotado en `scripts/presupuesto.mjs`; `npm run dev` abre la pantalla de inicio estática; `npm run build` genera `dist/sw.js` y `manifest.webmanifest` con `dist/` vaciado antes; `npm test` corre `verificar-rn.mjs` (con un caso que falla a propósito comprobado a mano y descartado); `npm run dev:emuladores` arranca; los íconos PNG y el woff2 están versionados; lo heredado marcado está borrado.
- **WP2:** `npm test` en verde, sin `Buffer`, `window` ni `Deno` en `shared/`.
- **WP3:** `npm run test:reglas` en verde con todos los casos de 10.2; `firebase deploy --only firestore:rules --dry-run` (o la validación del emulador) sin errores; ninguna consulta usa filtros fuera de la tabla de 2.5.
- **WP4:** con `npm run dev` contra producción, App Check obtiene token (o token de depuración), Firestore lee con caché persistente, Analytics aparece en DebugView, Remote Config devuelve valores y un cambio publicado llega por `onConfigUpdate`, `npm run deploy:remoteconfig` publica la plantilla, el service worker queda registrado ya en Ingreso, y en un teléfono Android real `obtenerTokenPush` registra un dispositivo y un push enviado desde la consola se muestra **con la app cerrada y con la app abierta**.
- **WP5:** `#/galeria` muestra todos los componentes a 320, 390 y 1440 px sin desborde; navegación por hash y foco funcionan; la leyenda está en todas las pantallas; `verificar-rn.mjs` pasa sobre `src/ui`, `src/marco` y `src/navegacion`.
- **WP6:** `npm run deploy:supabase` despliega con `--use-api` (o con el plan B anotado); `GET /tareas` responde; `vecino/alta` con un token real crea los tributos y los dos recordatorios, y una segunda llamada no duplica nada; `vecino/baja` borra los datos **y el usuario de Auth**; un evento de alarma envía un push a un dispositivo real; **las cuatro tareas (`minuto`, `diaria`, `resumen`, `simulador`) corridas contra producción con `curl` y el `CRON_SECRET` dejan filas con `ok = true` en `public.ejecuciones`** (detecta índices faltantes); los cuatro trabajos de cron figuran en `cron.job`.
- **S1..S8:** su pantalla cumple la sección 8; sus specs pasan en Pixel 7 e iPhone 13, incluida la revisión de accesibilidad; `verificar-rn.mjs` pasa sobre sus archivos.
- **WI:** `npm run deploy` publicado; humo y carga en verde con los dos criterios de 10.5; matriz de dispositivos reales completada en `docs/pruebas/dispositivos.md` (al menos un Android con Chrome y un iPhone con la PWA instalada); README con cómo ejecutar, cómo hacerse admin con el uid de una cuenta Google, cómo correr cada prueba y el guion de la demo (sección 16) con un video de respaldo; repositorio público en GitHub (cuenta `facupepi`) con la historia de commits por paquete que deja el orquestador.

---

## 12. Riesgos técnicos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| RNW con Vite: extensiones `.web.*`, JSX en `.js` de dependencias, módulos que esperan `__DEV__` o `global` | La app no compila | Alias y `resolve.extensions` de 9.1, `optimizeDeps.esbuildOptions`; `__DEV__` definido; WP1 lo deja funcionando con una pantalla mínima antes de la fase 1 |
| Un agente escribe HTML o DOM fuera de `.web.*` | Se pierde el requisito "React Native real" (crítica ARQ-02 y COD-02 de la auditoría) | `scripts/verificar-rn.mjs` dentro de `npm test` (sección 0) |
| Reglas complejas (límite de 10 llamadas por operación y 20 por lote) | Pagos o estacionamiento rechazados en producción aunque pasen en el emulador, que cachea | Cada documento se lee una vez con `let`; conteo sin caché documentado en la sección 3 |
| Índices compuestos que el emulador no exige | `FAILED_PRECONDITION` solo en producción | Consultas limitadas a los índices de 2.5 y filtros extra en el código; corrida de las tareas contra producción en la definición de terminado de WP6 |
| Push con la app abierta o revocación en iOS | N1 no se ve, o el iPhone deja de recibir push | `sw.js` con manejador `push` propio que siempre muestra la notificación (9.2); alerta en la app por `onSnapshot`; deduplicación por `claveEntrega` |
| Reloj del teléfono desfasado | `fin` de la sesión fuera de la tolerancia de 2 min | Tolerancia en reglas; mensaje claro "Revisá la hora de tu teléfono" cuando el inicio falla por permiso y todo lo demás valida |
| `serverTimestamp()` no se admite en arrays | Historial del reclamo imposible de validar | `cronologia` como mapa (2.2) |
| App Check con reCAPTCHA v3 suma un script y una espera antes de la primera lectura; un navegador sin interfaz saca puntaje bajo | Carga más lenta; humo que falla | Datos desde la caché persistente mientras llega el token; modo monitor hasta medir; medición con App Check encendido y apagado (10.5); token de depuración en el humo |
| Bloqueadores de anuncios cortan Analytics, Performance o Remote Config | Errores en consola, valores por defecto | Carga diferida con `isSupported()` y `try`; la app nunca depende de esos SDK |
| Supabase gratuito pausa el proyecto tras 7 días sin actividad | Sin push, adjuntos ni recordatorios en la demo | El `insert` de cada minuto en `public.ejecuciones` es actividad real en la base y probablemente alcanza, pero la documentación no lo asegura: entrar al panel de Supabase el día anterior a la demo |
| Claves legacy de Supabase (`service_role`) sin soporte a fines de 2026 | Storage deja de funcionar en plena cursada | `SUPABASE_SECRET_KEYS` primero y la legacy como respaldo (6.11) |
| Arranque en frío de Edge Functions | Primer ingreso más lento | `vecino/alta` no bloquea la interfaz (los tributos aparecen después); los comandos del perfil esperan `altaLista` sin bloquear la pantalla |
| La clave de la cuenta de servicio es muy poderosa | Si se filtra, acceso total al proyecto | Solo en secretos de Supabase, en base64; el archivo se borra; `.gitignore` excluye `*.json` de credenciales y `supabase/.secretos.env`; rotarla al terminar la cursada |
| Web Push en iOS solo con la PWA instalada (iOS 16.4 o posterior) y no en Brave por defecto | N1 no llega en esos casos | La pantalla explica cuándo funciona; historial y alertas en vivo con la app abierta como respaldo |
| Popup de Google en la PWA instalada o con almacenamiento particionado | No se puede vincular o entrar con Google | `authDomain` en el mismo dominio del Hosting; respaldo de redirect también para vincular; el ingreso como invitado siempre funciona |
| Invitado que cierra sesión | Pierde el acceso a sus datos | Diálogo que ofrece vincular o borrar (8.2) |
| Cuotas diarias de Spark (50 000 lecturas, 20 000 escrituras) | Firestore deja de responder en la demo | Simulador apagado por defecto; tarea por minuto con consultas acotadas; suscripciones con `limit`; paginación solo a pedido; monitorear el uso el día de la demo |
| El simulador activa alarmas durante la clase | Push de alarma a teléfonos reales sin control | El simulador ya no toca alarmas; se activan solo desde el panel |
| Uso de las teselas de OpenStreetMap | Bloqueo por uso excesivo | Atribución visible, caché de 7 días y 400 teselas solo con respuestas 200, sin precarga masiva |
| IndexedDB no disponible (algunas ventanas privadas) | Sin caché persistente | El SDK cae solo a caché en memoria (5.3) |
| Adjuntos subidos y reclamo no creado | Archivos huérfanos | La ruta incluye el requestId, así que un reintento reutiliza los mismos archivos; limpieza manual del bucket si hiciera falta |
| Spam con usuarios anónimos | Datos basura en el proyecto | App Check, validación estricta en reglas y la posibilidad de deshabilitar el anónimo desde la consola |
| Uso del logo municipal | Confusión con un canal oficial | Leyenda permanente que Remote Config no puede quitar; ícono de la app propio; textos que dicen "simulado" en pagos y avisos |
| Agentes en paralelo pisándose archivos o el `.git` | Conflictos, regresiones, `index.lock` | Propiedad exclusiva por archivo (11.2), contratos escritos, un solo dueño de `package.json`, los agentes no commitean (11.1) y fase de integración |
| Git marca el repositorio como de otro dueño (`dubious ownership`, la carpeta la creó otro usuario de Windows) | No se puede commitear | `git config --global --add safe.directory "<ruta de app>"` antes de empezar (lo hace el orquestador) |
| El emulador de Firestore exige Java 21 y la máquina tiene varios JDK (el 17 se fuerza para Android) | Pruebas de reglas que no arrancan | `scripts/con-emuladores.mjs` fija `JAVA_HOME` al JDK 21 como hacía el script heredado; puertos de prueba separados de los de desarrollo (`firebase.pruebas.json`) |
| Puertos ocupados por emuladores huérfanos (UIX-01) | El arranque falla | `scripts/emuladores.mjs` comprueba los puertos antes de arrancar y en Windows termina el árbol con `taskkill /T` |
| Sin internet en el aula | No hay demo en vivo | Guion con plan B (sección 16): datos de la caché, datos móviles del teléfono y video de respaldo |

---

## 13. Puntos marcados VERIFICAR (estado después de la revisión)

**Resueltos por la revisión** (ya no son VERIFICAR):

| N.º | Tema | Resultado |
|---|---|---|
| 1-3 | Reglas: `rutaPropia`, `timestamp - duration`, `dayOfWeek()`, `map[clave]`, caché de llamadas | Funcionan en el emulador; la caché no está garantizada en producción, por eso `let` (3) |
| 4 | `initializeFirestore` sin IndexedDB | No lanza; cae a memoria solo. Se quitó el `try` (5.3) |
| 5 | Performance diferido | Registra igual la carga de página (5.6) |
| 6 | `authDomain` en `web.app` | Admitido por Firebase; falta el paso manual del URI de redirección (5.2) |
| 8 | `verify_jwt = false` | La pasarela no exige `apikey`; se quitaron `X-Firebase-Token` y la clave publicable (6.3) |
| 9 | JWK de `securetoken` | Devuelve claves con `kid`; `createRemoteJWKSet` sirve (6.4) |
| 10, 11 | Permisos de la cuenta de servicio y FCM sin plan pago | El rol `firebase.sdkAdminServiceAgent` alcanza; FCM habilitado (6.5, 6.7) |
| 12 | Cuerpo máximo de una Edge Function | No hay límite oficial: un archivo por solicitud (6.8) |
| 13, 16 | Empaquetado y despliegue de funciones | `--use-api`, imports directos de `shared/` y plan B documentado (6.2, 6.12) |
| 14 | `pg_cron`, reemplazo de trabajos y Vault | `with schema pg_catalog` más los `grant`; el resto confirmado (6.9) |
| 15 | Claves inyectadas con el sistema nuevo | `SUPABASE_SECRET_KEYS` con respaldo legacy (6.11) |
| 18 | vite-plugin-pwa 2.0.0 con `injectManifest` | Confirmado (9.1) |
| 23 | `pyftsubset` | Ya no se usa: woff2 de Google Fonts (1.2) |
| 25 | `Pressable` con `hovered`/`focused` y `dataSet` | Confirmado en RNW 0.21.2 |
| — | `onConfigUpdate` de Remote Config en el SDK web | Existe en firebase 12.19 (5.7) |

**Siguen abiertos** (cada uno tiene dueño):

1. **(WP4)** Clave VAPID propia: generarla en la consola y cargarla en `.env.local`.
2. **(WP4)** URI de redirección `https://san-francisco-conecta-tp5.web.app/__/auth/handler` en el cliente OAuth y TTL de App Check de 3600 s: pasos manuales en las consolas.
3. **(WP4)** Que `getToken` con la registración propia entregue push con la app abierta y cerrada en un teléfono real (definición de terminado).
4. **(WP6)** Que `--use-api` resuelva los imports de `../../../shared/`; si no, plan B.
5. **(WP6)** Pausa del plan gratuito de Supabase: si el cron alcanza como actividad; mitigación de entrar al panel el día anterior.
6. **(WI)** `curl -I …/__/auth/iframe` después del primer despliegue para ver si el Hosting le aplica `X-Frame-Options`.
7. **(WI)** Violaciones de la política de contenido en `Report-Only` antes de pasarla a obligatoria.
8. **(WI)** App Check obligatorio: activarlo solo con más del 95 % de solicitudes verificadas y la prueba de humo en verde.
9. **(S4)** Impresión del cedulón desde un `iframe` en Safari iOS.
10. **(WP2)** Coordenadas de un punto en la zona Sur y del tramo de la zona `p3`, contrastadas con OpenStreetMap.
11. **(WP5)** Que los nombres de íconos de lucide 0.468 de la sección 7.2 existan con esos archivos (`triangle-alert`, `wifi-off`, `layout-dashboard`, `message-circle`, `log-out`, `printer`, `paperclip`, `refresh-cw`).

---

## 14. Trazabilidad de requisitos

| Req. | Mecanismo | Prueba | Paso de la demo (16) |
|---|---|---|---|
| B1 | `Mapa` con `estaciones` (7.2, 8.5) | `bicicletas.spec` marcadores | 3 |
| B2 | `onSnapshot` de `estaciones`; panel y simulador | `bicicletas.spec` cambio en menos de 2 s | 4 |
| B3 | `ubicar` + `ordenarPorCercania` | `bicicletas.spec` geolocalización; `dominio.test` distancia | 3 |
| B4 | "Reportar problema" → `#/reclamos/nuevo?estacion=` | `bicicletas.spec` | 3 |
| T1 | `tributos` sembrados por `vecino/alta`; cedulón con `imprimirCedulon` | `tributos.spec`; `ingreso.spec` datos semilla | 5 |
| T2 | `pagarTributo` en transacción; reglas de importe e idempotencia | `tributos.test` (reglas), `tributos.spec` | 5 |
| T3 | `pagos` y estados con `estadoTributo`; `cargarMas('pagos')` | `tributos.spec`; `dominio.test` | 5 |
| T4 | Recordatorios en `vecino/alta`, tarea `diaria` y botón del panel | `recordatorios.test`; `ingreso.spec` notificaciones de vencimiento; WP6 corrida en producción | 5 y 9 |
| R1 | Formulario con `validarReclamo` y reglas | `reclamos.spec` errores junto al campo; `reclamos.test` | 6 |
| R2 | `adjuntos/subir` (Supabase Storage) y regla de ruta | `reclamos.spec` con PNG; `reclamos.test` adjuntos | 6 |
| R3 | `cronologia`, `avanzarReclamo` con evento y push | `reclamos.spec` avance del admin; `reclamos.test` transiciones | 7 |
| R4 | Buscador sobre lo cargado y `cargarMas('reclamos')` | `reclamos.spec` búsqueda | 6 |
| C1 | `contactos` por categoría | `contactos.spec` filtro | 10 |
| C2 | `abrirEnlace` con `tel:` y `mailto:` | `contactos.spec` | 10 |
| C3 | WhatsApp `https://wa.me/` (canal Tana) | `contactos.spec` | 10 |
| A1 | `Mapa` con `alarmas` | `alarmas.spec` | 8 |
| A2 | `onSnapshot` de `alarmas`; panel | `alarmas.spec` etiqueta en vivo | 8 |
| A3 | `cercania` en el almacén, `despachar` con `array-contains` y push | `alarmas.spec` ids sin coordenadas; `notificaciones.test` | 8 |
| A4 | `preferencias.zonas` y `decidirEntrega` | `alarmas.spec` zona; `notificaciones.test` | 8 |
| E1 | `Mapa` con tramos, tarifa y `horarioTexto`; `enHorario` | `dominio.test` horario; `estacionamiento.test` | 9 |
| E2 | `iniciarEstacionamiento` en transacción con pago y bloqueo | `estacionamiento.spec`; `estacionamiento.test` | 9 |
| E3 | Temporizador, umbral `avisoEstacionamientoMin`, notificación local y push de `minuto` | `estacionamiento.spec` aviso; `recordatorios.test` | 9 |
| E4 | `extenderEstacionamiento` (y `finalizarEstacionamiento`) | `estacionamiento.spec`; `estacionamiento.test` | 9 |
| N1 | `despachar` y FCM; `sw.js` | WP4 y WP6 con teléfono real; `notificaciones.spec` aviso del admin | 7 y 8 |
| N2 | `preferencias` (tipos, zonas, frecuencia) y botón "Enviar resumen ahora" | `notificaciones.spec` frecuencia; `notificaciones.test` | 11 |
| N3 | `unirNotificaciones` con `destino` y `enlace`; `cargarMas` | `notificaciones.spec` | 11 |
| Compatibilidad con navegadores móviles | RNW, PWA instalable, sin APIs exclusivas de un navegador | e2e en Pixel 7 e iPhone 13; humo en tres navegadores; `docs/pruebas/dispositivos.md` | 1 y 2 |
| Carga en menos de 3 s | Pantalla estática, presupuesto del paquete, service worker, caché persistente, SDK diferidos | `npm run test:carga` con los dos criterios de 10.5; traza `inicio_con_datos` | 1 |
| Protección de datos | Reglas por dueño, sin correo ni coordenadas, bloqueo sin `uid`, bucket privado con URLs de 5 min, App Check, borrado total con `vecino/baja`, secretos fuera del repositorio | `tests/reglas/*`; `cuenta.spec` borrado | 12 |
| Usabilidad | Componentes con `role`/`aria-*`, toque mínimo de 48, errores junto al campo, estados vacío, cargando y error, enlaces profundos | `@axe-core/playwright` en cada spec; `inicio.spec` 360 × 740 | todos |
| Escalabilidad | Ver sección 15 | Cuotas y tiempos en `public.ejecuciones`; consultas con `limit` | informe |

---

## 15. Escalabilidad

- **Interfaz:** Hosting de Firebase sirve archivos estáticos desde su CDN, con `immutable` en `/assets/**`; no hay servidor propio que escalar.
- **Datos:** Firestore escala horizontalmente sin administración. Todas las escuchas tienen `limit` y la paginación sube el límite a pedido; las consultas del servidor usan solo índices declarados o automáticos (2.5).
- **Lógica de servidor:** las Edge Functions de Supabase no guardan estado (salvo cachés en memoria de claves y del token OAuth, que se pueden perder sin efecto), así que cada instancia es intercambiable. La idempotencia por `requestId`, claves deterministas y la precondición `updateTime` permiten reintentar o correr dos instancias a la vez.
- **Envío masivo:** `despachar` pagina destinatarios de a 300 y envía de a 20 en paralelo; la bandeja procesa 20 eventos por corrida y reintenta hasta 3 veces. **Evolución** fuera del prototipo: temas de FCM por zona y tipo (`/topics/zona-centro`) en lugar de un envío por dispositivo, y una cola dedicada.
- **Costos:** todo entra en los planes gratuitos (Spark y Supabase Free). El cuello de botella es la cuota diaria de lecturas de Spark; con más vecinos, el paso natural es el plan Blaze con Cloud Functions, y el diseño de bandeja (`eventos`) se traslada sin cambios.

---

## 16. Guion de la demostración en clase

Lo escribe WI en el README y graba un video de respaldo siguiendo estos pasos. Dispositivos: **teléfono A** (vecino, Android con Chrome y la PWA instalada, push activado), **notebook B** (admin, cuenta Google con documento en `administradores`, conectada al proyector). Antes de la clase: entrar al panel de Supabase, `restablecerDemo`, `avisoEstacionamientoMin = 14`, `horarioEstricto = false` si la clase es de noche, simulador apagado.

1. Abrir la URL pública en A: se ve la pantalla estática y la leyenda; instalar la PWA (Cuenta, "Instalar la app").
2. Entrar como invitado: Inicio con los 7 servicios sin desplazar.
3. Bicicletas: mapa, "Usar mi ubicación", estación más cercana, "Reportar problema".
4. Desde B, panel, + bicicletas en b1: A cambia en menos de 2 s.
5. Tributos: estados, notificación de vencimiento ya presente, ver cedulón, pagar T-1001 (pago simulado) y ver el comprobante.
6. Reclamos: crear uno con una foto; buscarlo por código.
7. Desde B, avanzar ese reclamo a En proceso: la línea de tiempo de A cambia y llega el push.
8. Alarmas: seguir la zona parque, activar "Avisarme si se activa una alarma cerca"; desde B activar a2: aviso en la app y push con la app cerrada; al tocarlo abre `#/alarmas/a2`.
9. Estacionamiento: iniciar 15 min en p1; alrededor de un minuto después llega el aviso "por vencer"; extender 15 min; terminar ahora. Desde B, "Enviar recordatorios ahora".
10. Contactos: llamar al 147 y abrir WhatsApp.
11. Notificaciones: historial con enlaces, cambiar frecuencia a Resumen diario; desde B "Enviar resumen ahora".
12. Cuenta: vincular con Google o "Borrar mis datos" para mostrar la protección de datos.

**Plan B sin internet en el aula:** datos móviles del teléfono A compartidos con B; si tampoco hay, mostrar la app desde la caché (la PWA abre y muestra los últimos datos) y pasar el video de respaldo para los pasos en vivo.

---

## Anexo A. Contrato de `shared/` (WP2)

Módulos ESM puros, sin `Buffer`, `window`, `document`, `Deno` ni dependencias. Funcionan en el navegador, en Node 22 y en Deno.

**`constantes.mjs`**

```js
export const ZONAS = ['centro', 'parque', 'norte', 'sur'];
export const CATEGORIAS_RECLAMO = ['alumbrado', 'bacheo', 'limpieza', 'bicicletas', 'otros'];
export const ESTADOS_RECLAMO = ['recibido', 'en_proceso', 'resuelto'];
export const TIPOS_AVISO = ['obras', 'cortes', 'eventos', 'emergencias', 'servicios'];      // los que publica el panel
export const TIPOS_PERSONALES = ['tributos', 'estacionamiento', 'reclamos'];
export const TIPOS_NOTIFICACION = [...TIPOS_AVISO, 'alarmas', ...TIPOS_PERSONALES];
export const FRECUENCIAS = ['inmediata', 'resumen_diario', 'solo_historial'];
export const TIPOS_ARCHIVO = ['image/jpeg', 'image/png', 'application/pdf'];
export const EXTENSION_ARCHIVO = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };
export const LIMITES = { adjuntos: 3, bytesAdjunto: 2 * 1024 * 1024, ladoImagen: 1600, largoNombreAdjunto: 100,
  bloqueMinutos: 15, minutosMax: 240, toleranciaFinMin: 2, radioAlarmaKm: 1,
  avisoEstacionamientoMinPorDefecto: 5, avisoEstacionamientoMinMax: 14,   // el valor vigente está en municipal/config
  diasAvisoVencimiento: 3, cercaniaMin: 30, cercaniaMaxMin: 60, desfaseCordobaHoras: -3 };
export const COLECCIONES = { municipal: 'municipal', estaciones: 'estaciones', alarmas: 'alarmas',
  zonas: 'zonasEstacionamiento', contactos: 'contactos', avisos: 'avisos', eventos: 'eventos',
  administradores: 'administradores', bloqueos: 'bloqueosPatente', usuarios: 'usuarios',
  tributos: 'tributos', pagos: 'pagos', reclamos: 'reclamos', estacionamiento: 'estacionamiento',
  notificaciones: 'notificaciones', avisosLeidos: 'avisosLeidos', dispositivos: 'dispositivos' };
export const PREFERENCIAS_POR_DEFECTO = { tipos: [...TIPOS_NOTIFICACION], zonas: ['centro', 'parque'],
  frecuencia: 'inmediata', push: false };
export const ETIQUETAS = { zonas: { centro: 'Centro', parque: 'Parque', norte: 'Norte', sur: 'Sur', todas: 'Toda la ciudad' },
  categorias: { … }, estadosReclamo: { recibido: 'Recibido', en_proceso: 'En proceso', resuelto: 'Resuelto' },
  tipos: { … }, frecuencias: { inmediata: 'Inmediata', resumen_diario: 'Resumen diario', solo_historial: 'Solo historial' },
  estadosTributo: { pagado: 'Pagado', vencido: 'Vencido', por_vencer: 'Por vencer', pendiente: 'Pendiente' } };
export const ZONA_HORARIA = 'America/Argentina/Cordoba';
```

**`dominio.mjs`** (de `heredado:functions/lib/domain.mjs`)

| Función | Firma | Notas |
|---|---|---|
| `ErrorDominio` | `new ErrorDominio(mensaje, campo = null)` | Antes `DomainError` |
| `requerido` | `(valor, etiqueta, min = 1, max = 500, campo) → string` | Recorta espacios |
| `miembro` | `(valor, valores, etiqueta, campo) → valor` | |
| `minutosValidos` | `(n) → n` | 15..240 en bloques de 15 |
| `normalizarPatente` | `(texto) → 'ABC123' \| 'AB123CD'` | Campo `patente` |
| `costoEstacionamiento` | `(tarifaHora, minutos) → int` | `Math.round(tarifaHora * minutos / 60)` |
| `distanciaKm` | `({ lat, lng }, { lat, lng }) → number` | Haversine heredado |
| `ordenarPorCercania` | `(items, posicion) → items con distanciaKm` | Sin posición, conserva el orden |
| `enHorario` | `(horario, ms) → boolean` | Usa UTC−3 y día ISO (1 = lunes) |
| `estadoTributo` | `(tributo, ahoraMs, dias = 3) → 'pagado' \| 'vencido' \| 'por_vencer' \| 'pendiente'` | |
| `siguienteEstadoReclamo` | `(estado) → 'en_proceso' \| 'resuelto' \| null` | |
| `validarReclamo` | `({ categoria, direccion, descripcion, estacionId }) → normalizado` | Campos `categoria`, `direccion`, `descripcion` |
| `validarArchivo` | `({ nombre, tipo, tamano }) → ok` | Tipo y peso |
| `recortarNombreArchivo` | `(nombre) → string` | Sin rutas ni caracteres de control, como máximo 100 caracteres conservando la extensión (lo usa `adjuntos/subir`) |
| `tipoPorFirma` | `(bytes: Uint8Array) → mime \| null` | `%PDF-`, PNG de 8 bytes, JPEG `FF D8 FF` |
| `validarPreferencias` | `(p) → p normalizado` | Sin duplicados |
| `codigoReclamo` | `(requestId) → 'R-XXXXXX'` | 6 caracteres del id sin guiones, en mayúscula |
| `comprobante` | `(prefijo, requestId) → 'REC-XXXXXXXX'` | 8 caracteres |
| `codigoPagoTributo` | `(tributo) → string de dígitos con Luhn` | Para el cedulón |
| `nuevoIdSolicitud` | `() → string` | `crypto.randomUUID` o respaldo |
| `finSesion` | `(inicioMs, minutos) → ms` | |

**`formato.mjs`**: `dinero(n)`, `fecha(ms)`, `fechaHora(ms)`, `hora(ms)`, `tiempoRelativo(ms, ahora)` ("hace 3 min", "en 2 días"), `duracion(segundos)` → "HH:MM:SS". Todas con `es-AR` y `ZONA_HORARIA`.

**`rutas.mjs`**: `RUTAS`, `parsearHash(hash)`, `construirHash(nombre, id?, params?)`, `rutaSegura(destino)`.

**`catalogo.mjs`**: `catalogo(ahora) → { info, config, estaciones, alarmas, zonasEstacionamiento, contactos, avisos }` (`config` con `avisoEstacionamientoMin: 5`) y `datosInicialesVecino(ahora) → { tributos, pagos, reclamos, notificaciones, preferencias }`, con fechas en ms y los ids de 2.4.

**`recordatorios.mjs`** (de `heredado:functions/lib/reminders.mjs`): `recordatoriosTributos(tributos, ahora, dias = 3) → [{ id, titulo, cuerpo, tipo: 'tributos', destino: '#/tributos/<id>' }]` y `recordatoriosEstacionamiento(sesiones, ahora, minutos) → [{ id, sesionId, etapa: 'por_vencer' | 'finalizado', titulo, cuerpo, destino }]`, con `minutos` = `municipal/config.avisoEstacionamientoMin` (obligatorio: no hay umbral fijo en el código). El `id` es la clave determinista (`tributo-T-1001-2026-10-09-por_vencer`, `est-<sesionId>-<finMs>-por_vencer`) y sirve de id del documento de notificación y de `claveEntrega`.

**`notificaciones.mjs`** (de `heredado:src/notificationPolicy.js`)

```js
// notif: { tipo, zona } ; preferencias: { tipos, zonas, frecuencia, push } ; cercano: alarma dentro del radio
export function decidirEntrega(notif, preferencias, { cercano = false } = {}) {
  const personal = TIPOS_PERSONALES.includes(notif.tipo);
  const emergencia = notif.tipo === 'emergencias';
  const tipoOk = emergencia || preferencias.tipos.includes(notif.tipo);
  const zonaOk = personal || emergencia || notif.zona === 'todas'
    || preferencias.zonas.includes(notif.zona) || (notif.tipo === 'alarmas' && cercano);
  const visible = tipoOk && zonaOk;
  const inmediata = visible && (preferencias.frecuencia === 'inmediata' || emergencia);
  return { historial: visible, inmediata, push: inmediata && preferencias.push,
           resumen: visible && preferencias.frecuencia === 'resumen_diario' };
}
export function avisoVisible(aviso, preferencias, { todos = false } = {});   // todos = sin filtro
export function unirNotificaciones(personales, avisos, leidos, preferencias, { todos = false } = {}); // → NotificacionUnida[] (campo fuente)
export function alarmasCercanas(alarmas, posicion, radioKm) → string[];

// Clave única de entrega: data.id del push, tag de toda notificación del sistema y clave
// del conjunto de deduplicación del almacén. Un mismo hecho da la misma clave venga de donde venga.
export function claveEntrega(x) → string;
//   { fuente: 'alarma', alarma }          → alarma.activacionId                 (ev-…)
//   { fuente: 'aviso', aviso }            → aviso.eventoId                      (ev-…; también en avisos/alarma-ev-…)
//   { fuente: 'reclamo', reclamo }        → reclamo.ultimoEventoId              (ev-…)
//   { fuente: 'personal', notificacion }  → id sin el prefijo 'alarma-' o 'reclamo-' (ev-…);
//                                           los demás ids (tributo-…, est-…, pago-…, recibido-…, bienvenida) tal cual
//   { fuente: 'sesion', sesion, etapa }   → `est-${sesion.id}-${sesion.fin}-${etapa}`
// Se cumple alarma.activacionId == aviso(alarma-ev).eventoId == data.id del push == 'ev-…'.
```

**`simulador.mjs`**: `planificarPaso({ estaciones, reclamos, ahora, aleatorio = Math.random }) → { estaciones: [{ id, bicicletas }], reclamos: [{ uid, id, estado }] }` (sin alarmas: se activan solo desde el panel) y `crearAleatorio(semilla)` (para las pruebas).

## Anexo B. Dependencias (WP1 las instala todas en la fase 0)

| Paquete | Versión | Tipo | Para qué |
|---|---|---|---|
| `react`, `react-dom` | 19.1.0 | dep | Ya instaladas |
| `react-native-web` | 0.21.2 | dep | Ya instalada (existe la 0.21.3; no se actualiza salvo que WP1 encuentre un error que la justifique) |
| `firebase` | 12.19.0 | dep | Ya instalada |
| `leaflet` | 1.9.4 | dep | Ya instalada |
| `lucide-react` | 0.468.0 | dep | Ya instalada |
| `workbox-precaching`, `workbox-routing`, `workbox-strategies`, `workbox-expiration`, `workbox-cacheable-response`, `workbox-core`, `workbox-window`, `workbox-build` | 7.4.1 | dev | Service worker y pares de vite-plugin-pwa (`cacheable-response` para las teselas) |
| `vite` | 6.4.1 | dev | Ya instalada |
| `@vitejs/plugin-react` | 4.7.0 | dev | Ya instalada |
| `vite-plugin-pwa` | 2.0.0 | dev | PWA con `injectManifest` |
| `@firebase/rules-unit-testing` | 5.0.1 | dev | Ya instalada |
| `@playwright/test` | 1.56.1 | dev | Ya instalada |
| `@axe-core/playwright` | la última 4.x | dev | Revisión de accesibilidad en las e2e (nueva) |
| `firebase-admin` | 14.5.0 (la que usaba `functions/`) | dev | Siembra y e2e |
| `firebase-tools` | 15.30.0 (la global de la máquina) | dev | Emuladores y despliegue reproducibles |
| `supabase` | 2.120.0 (la que corre `npx`) | dev | CLI reproducible |

Se elimina el `overrides` de `@grpc/grpc-js` si ya no hace falta sin `functions/` (WP1 lo comprueba con `npm ls`).

**`.env.example`** (WP1)

```
# Copiar como .env.local. La configuración web de Firebase es pública por diseño, pero no se versiona.
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=san-francisco-conecta-tp5.web.app
VITE_FIREBASE_PROJECT_ID=san-francisco-conecta-tp5
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=G-M14RRR15FN
VITE_FIREBASE_VAPID_KEY=
VITE_RECAPTCHA_SITE_KEY=
VITE_APPCHECK_DEBUG_TOKEN=          # solo desarrollo local
VITE_SUPABASE_URL=https://qsxwsbdhlwyshqjfxaxw.supabase.co
```

`.env.development.local` (ignorado, opcional): `VITE_FIREBASE_AUTH_DOMAIN=san-francisco-conecta-tp5.firebaseapp.com` para desarrollar desde `localhost` (5.2).

**`.env.emulador`** y **`.env.e2e`** (versionados): `VITE_USAR_EMULADORES=true`, `VITE_FIREBASE_PROJECT_ID=demo-conecta-tp5`, `VITE_FIREBASE_API_KEY=demo-clave`, `VITE_FIREBASE_AUTH_DOMAIN=demo-conecta-tp5.firebaseapp.com`, `VITE_FIREBASE_APP_ID=1:000000000000:web:demo`, `VITE_PUERTO_AUTH` (9099 o 9098), `VITE_PUERTO_FIRESTORE` (8085 o 8086), `VITE_SUPABASE_URL=http://127.0.0.1:8787`.

**`.gitignore`** agrega: `.env.local`, `.env.*.local`, `supabase/.temp/`, `supabase/.branches/`, `supabase/.secretos.env`, `supabase/functions/_shared/compartido/` (solo por si se usa el plan B de 6.2), `credenciales/`, `*-firebase-adminsdk-*.json`, `test-results/`, `playwright-report/`, `dist/`, `.npm-cache/`, `*.log`, `.firebase/`.

---

## 17. Decisiones tomadas tras la revisión

Criterio: se acepta toda corrección con evidencia verificable o que cierre un hueco de los requisitos o de la demo; se descarta lo que agrega complejidad sin mejorar la nota ni la seguridad. "F" = crítica de factibilidad, "C" = crítica de cobertura.

**Aceptadas e incorporadas**

| Punto | Decisión | Dónde |
|---|---|---|
| F1, C4 (parte) | `sw.js` con manejador `push` propio que siempre muestra la notificación; sin `firebase/messaging/sw` ni `onMessage`; `refrescarPush()` al iniciar reemplaza `pushsubscriptionchange` | 5.8, 9.2, 4.7 |
| F2 | Reglas reescritas con `let`: cada documento se lee una vez por operación; tabla de conteo sin caché | 3 |
| F3, C9 | Sin índices nuevos: las condiciones que los exigirían (`intentos`, `vence`, `avisoPorVencer`, `push`, estado del panel) se filtran en el código; corrida de las tareas en producción | 2.5, 6.8, 11.4 |
| F4 | `escribirLote` (`:batchWrite`, no atómico) para creaciones idempotentes; `confirmar` (`:commit`) solo para reclamar eventos | 6.6, 6.8 |
| F5 | Un token se borra solo con 404, `UNREGISTERED` o `INVALID_ARGUMENT` que apunte a `message.token` | 6.7 |
| F6, C7 | `vecino/baja` borra el usuario de Auth por Identity Toolkit; alcance `identitytoolkit` agregado; el cliente solo cierra sesión | 6.5, 6.8, 4.7 |
| F7, C21 | `crearReclamo` no espera el `commit` sin red (`!enLinea` o 2,5 s) y devuelve `enCola: true` como éxito; "Pendiente de envío" con `hasPendingWrites`; lectura previa solo ante `permission-denied`; `en-cola` deja de ser un error | 4.2, 4.4, 8.8 |
| F8, C14 | Presupuesto inicial de 340 KB con gzip, fijado por WP1 midiendo un esqueleto en la fase 0; `initializeAuth` sin resolvedor; métrica obligatoria definida (LCP en frío y `data-listo` en visita repetida, ambos bajo 3 s), medida con App Check encendido y apagado | 5.2, 10.5, 11.1 |
| F9 | Teselas `https://tile.openstreetmap.org` con `crossOrigin`, `CacheableResponsePlugin` (200) y CSP corregida | 7.2, 9.2, 9.5 |
| F10 | `SUPABASE_SECRET_KEYS` con respaldo legacy | 6.11 |
| F11 | Un adjunto por solicitud | 4.4, 6.8 |
| F12 | Despliegue con `--use-api` e imports directos de `shared/`; se eliminan `sync-shared.mjs`, la copia y su prueba; plan B documentado | 6.2, 6.12, 10.6 |
| F13 | `pg_cron with schema pg_catalog` y los `grant` | 6.9 |
| F14 | `authDomain` de desarrollo en `firebaseapp.com`; `curl -I` del iframe tras el primer despliegue | 5.2, 9.5 |
| F15 | reCAPTCHA v3 (decisión del usuario) con TTL de 3600 s, token de depuración en el humo y modo monitor hasta medir | 5.4, 10.4 |
| F16 | Sin `try/catch` en la creación de `db` | 5.3 |
| F17, C12 | Service worker registrado en `index.web.js` desde la primera visita; `registroListo` con tiempo máximo; `ActualizacionDisponible` solo avisa | 5.1, 7.4, 9.1 |
| F18, C19 | `esAdmin()` exige proveedor no anónimo; fixture `admin` con usuario Google del emulador; `edge-simulado` aplica el criterio de `exigirAdmin` | 3, 5.2, 10.3 |
| F19 | CSP con los orígenes de Analytics y de Supabase en `img-src` | 9.5 |
| F20 | `enlaces.js` único y RN puro con `Linking.openURL(url, '_self')`; se elimina `enlaces.web.js` | 7.2 |
| F21 | Se mantiene la mitigación de entrar al panel de Supabase el día anterior | 12, 13 |
| C1 | `vecino/alta` crea los recordatorios T4 al instante; `tareas` acepta `diaria` y `resumen` del admin; botones en la pestaña Demo | 2.4, 6.8, 8.11 |
| C2 | Umbral de E3 único en `municipal/config.avisoEstacionamientoMin` (1 a 14); se quita el parámetro de Remote Config | 2.1, 3, 5.7, 6.8 |
| C3 | `finalizarEstacionamiento` con regla, transacción, `testID` y pruebas | 3, 4.4, 8.9, 10.2, 10.3 |
| C4 | `claveEntrega` única (push, `tag` y deduplicación); el almacén es el único dueño de `registrarEntrega` | 4.5, 5.9, 9.6, Anexo A |
| C5 | `preferencias.push` = "tiene algún dispositivo"; `eliminarDispositivo` solo lo apaga si no quedan; el interruptor sale de `estadoPushLocal()` | 2.2, 4.4, 5.8, 8.10 |
| C6 | `onIdTokenChanged` y `getIdToken(true)`; `vecino/alta` idempotente sincroniza `nombre` y `anonimo`; `linkWithRedirect` y `credentialFromError`; `cambiarACuentaExistente` borra al invitado y su push; diálogo para el invitado que sale; `asegurarAlta` en cada cambio de uid | 4.4, 4.5, 4.7, 5.2, 8.2 |
| C8 | Promesa `altaLista` que esperan los comandos del perfil; `alta` hace `update` si el perfil existe y solo se llama si falta `altaEn` o cambió `anonimo` | 4.4, 6.8 |
| C10 | `avisosLeidos` admite `update`; "marcar todas" solo envía las no leídas | 3, 4.4 |
| C11 | `mensajeria` solo maneja el token; nuevo `src/datos/sesion.js`; `useComando` recibe `alExito`; `errores.js` sin imports | 4.1, 4.6, 4.7, 11.3 |
| C13 | Plantilla `remoteconfig.template.json` versionada y desplegable; `onConfigUpdate` (existe en el SDK 12.19); se quita `panel_demo_visible` | 5.7, 9.5 |
| C15 | Se conserva `firebase.pruebas.json`; `page.clock.setSystemTime` y prohibido escribir después de adelantar el reloj | 1.2, 9.5, 10.3 |
| C16 | `scripts/verificar-rn.mjs` dentro de `npm test` | 0, 10 |
| C17 | Destino de todos los archivos heredados que faltaban; woff2 de Google Fonts; `.firebaserc` a WP1; `dist/` vaciado | 1.2 |
| C18 | Matriz de trazabilidad de 26 + 5 requisitos, sección de escalabilidad, matriz de dispositivos reales, `@axe-core/playwright` y guion de la demo con video | 10, 14, 15, 16 |
| C20 | (a) `cargarMas` del almacén sube el `limit`; (b) contratos de `useAdmin()` y `Cambios`; (c) código `app-check`; (d) `TIPOS_AVISO` sin `alarmas` en los dos lugares; (e) `fuente` en lugar de `origen`; (f) nombre recortado a 100; (g) cercanía hasta 60 min; (h) referencia a 11.2; (i) cercanía en el almacén | 2.1, 4, 6.8, Anexo A |
| C23 | Los agentes no commitean; el orquestador hace un commit por paquete al cerrar cada fase | 0, 11.1 |
| C24 | Se quitan `panel_demo_visible`, el modo emulador de `firestore.ts`, el doble encabezado de token, `pyftsubset`, `generar-iconos.mjs`, `sync:shared`, el bucket repetido en `config.toml` y Desktop Firefox de las e2e (queda en el humo); el simulador ya no activa alarmas | 5.7, 6, 9.3, 10 |
| Confirmaciones de F | Incorporadas como hechos: reglas en el emulador, Spark sin facturación, Performance diferido, `authDomain` en `web.app`, JWK con `kid`, rol de la cuenta de servicio, `verify_jwt`, límites de Supabase, `pg_cron` y Vault, vite-plugin-pwa 2.0.0, RNW 0.21.2 con React 19, Leaflet dentro de un `View` con alto explícito y `circleMarker` | 3, 5, 6, 7.2, 9.1, 13 |

**Aceptadas en parte**

| Punto | Qué se tomó y qué no |
|---|---|
| C22 | Se quita el `uid` de `bloqueosPatente` y la propiedad se prueba con `exists` de la sesión propia **antes** del lote. No se adopta el id SHA-256: las reglas no pueden comprobar que el hash corresponda a la patente de la sesión, así que un usuario podría bloquear el hash de una patente ajena; y, sin el `uid`, saber hasta qué hora está estacionada una patente visible en la calle ya no revela quién es |
| F8 (Firestore diferido) | Se adopta `initializeAuth` sin resolvedor, pero no cargar Firestore con `import()` después de la sesión: cambiaría todo el contrato del repositorio a un `db` asíncrono, y el requisito ya se cumple con la pantalla estática en frío y el service worker en la visita repetida |

**Descartadas**

| Punto | Justificación |
|---|---|
| C24, sumar S2 a WP5 | WP5 es el camino crítico de la fase 1 (todas las pantallas dependen de él); Inicio y Contactos en la fase 2 no lo demoran |
| F15, pasar a reCAPTCHA Enterprise | Decisión del usuario ya tomada (v3); el mismo crítico propone mantenerla |
| F12, conservar la copia `compartido/` como camino principal | Queda solo como plan B: duplica código y obliga a una prueba de sincronización |

**Paquetes de trabajo resultantes.** La cantidad no cambia: 6 de cimientos (WP1 a WP6), 8 de pantallas (S1 a S8) y 1 de integración (WI). Cambios de propiedad: `src/plataforma/ubicacion*.js` pasa de S3 a WP3 (lo usa el almacén); `src/datos/sesion.js` es nuevo de WP3; `src/plataforma/registroSW*.js` y `remoteconfig.template.json` son nuevos de WP4; `enlaces.js` queda como un solo archivo de WP5; `firebase.pruebas.json`, `.firebaserc`, `.npmrc`, `scripts/verificar-rn.mjs` y `tests/e2e/accesibilidad.mjs` son de WP1; se eliminan `scripts/sync-shared.mjs`, `scripts/generar-iconos.mjs` y `tests/unidad/sincronizacion.test.mjs`. La tabla 11.2 es la referencia completa.
