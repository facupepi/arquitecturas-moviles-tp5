# Prueba de humo contra la URL publicada

Sección 10.4 de la especificación. Se corre con `npm run test:humo`.

- Configuración: `playwright.humo.config.mjs`
- Pruebas: `tests/humo/publicado.spec.mjs`
- Ayudantes: `tests/humo/ayudantes.mjs`

## Qué se prueba

Hay 15 pruebas por navegador.

Sin sesión, cuatro pruebas:

- La URL responde 200 por HTTPS, la pantalla estática ya trae la leyenda de prototipo y después aparece la pantalla de Ingreso, sin desborde horizontal ni errores de consola graves.
- El manifiesto es válido: tiene los campos de 9.3, los tres íconos PNG responden y, en Chromium, `Page.getAppManifest` no da errores.
- El service worker `/sw.js` queda activo ya en Ingreso y controla la página al recargar.
- `GET /functions/v1/tareas` de Supabase devuelve `ok`.

Como invitado, once pruebas en orden, con una cuenta anónima por navegador:

- Entra como invitado y aparece Inicio con los siete servicios.
- Abre cada servicio desde su acceso (siete pruebas), con la leyenda visible en todas.
- En Bicicletas aparecen las 7 estaciones, los 7 marcadores y teselas de OpenStreetMap cargadas.
- Tributos muestra T-0999 como vencido y T-1001 como por vencer.
- Notificaciones muestra los vencimientos de T-1001 y T-0999.
- No hubo errores de consola graves en todo el recorrido.
- "Borrar mis datos" borra la cuenta y vuelve a Ingreso.

Si el recorrido se corta antes de borrar la cuenta, el `afterAll` llama a `vecino/baja` con el token guardado en el navegador.

## Navegadores

Playwright 1.56.1 con cinco proyectos:

| Proyecto | Motor |
|---|---|
| Pixel 7 | Chromium |
| iPhone 13 | WebKit |
| Desktop Chrome | Chromium |
| Desktop Firefox | Firefox |
| Desktop Safari | WebKit |

En total son 75 pruebas.

## Resultados

### 7 de octubre de 2026, contra https://san-francisco-conecta-tp5.web.app

Hubo dos corridas: de 23:31 a 23:35 UTC y, con la versión final de la prueba, de 23:39 a 23:44 UTC. Las dos dieron lo mismo.

Resultado: **5 pasaron, 20 fallaron y 50 no corrieron**, de 75 pruebas.

La causa es que Hosting no está desplegado: la URL devuelve 404 "Site Not Found".

| Prueba | Los 5 proyectos |
|---|---|
| Responde 200 por HTTPS | Falló: recibió 404 |
| Manifiesto válido | Falló: no hay `link[rel=manifest]` |
| Service worker activo | Falló: no aparece la pantalla de Ingreso |
| `GET /functions/v1/tareas` devuelve `ok` | Pasó |
| Entra como invitado | Falló: no aparece la pantalla de Ingreso |
| Las otras 10 del recorrido | No corrieron (modo serie) |

No se creó ninguna cuenta de invitado, así que no hubo nada que borrar.

### Validación del código de la prueba contra el build local

Se usó `vite preview` sobre `dist/` en http://127.0.0.1:4179 y se corrieron solo las cuatro pruebas sin sesión.

Resultado: **20 de 20 pasaron**, en los cinco proyectos.

- En una corrida anterior, WebKit (iPhone 13 y Desktop Safari) registró una vez el error de consola "Failed to load resource: 400". No se repitió en seis corridas más ni en la corrida final.
- El recorrido como invitado no se corrió en local: escribiría en Firestore de producción, y el origen local no está en `ORIGENES_PERMITIDOS` de Supabase.

## Pendiente para dejarla en verde

1. Sembrar el catálogo de producción y correr `firebase deploy` de reglas, índices, Remote Config y Hosting.
2. Redesplegar las funciones `vecino` y `adjuntos`.
3. Volver a correr `npm run test:humo` y agregar aquí el resultado.
4. Si reCAPTCHA rechaza a los navegadores sin interfaz, registrar un token de depuración de App Check y pasarlo en `APPCHECK_TOKEN_HUMO`, sin versionarlo.
