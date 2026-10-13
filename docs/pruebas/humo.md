# Prueba de humo contra la URL publicada

Se corre con `npm run test:humo`.

- Configuración: `playwright.humo.config.mjs`
- Pruebas: `tests/humo/publicado.spec.mjs`
- Ayudantes: `tests/humo/ayudantes.mjs`

## Qué se prueba

La app solo admite cuentas de Google, y una prueba automática no puede ni debe entrar con una cuenta real. Por eso la prueba de humo mira solo lo público: no crea usuarios ni escribe en producción.

Hay seis pruebas por navegador.

- La URL responde 200 por HTTPS con la pantalla estática y la leyenda de prototipo, y después aparece Ingreso, sin desborde horizontal ni errores de consola graves.
- Ingreso solo ofrece "Continuar con Google": no hay ingreso como invitado.
- La política de seguridad de contenido y los demás encabezados de Hosting viajan en la respuesta.
- El manifiesto es válido y sus tres íconos responden. En Chromium, además, `Page.getAppManifest` no informa errores.
- El service worker `/sw.js` queda activo ya en Ingreso y controla la página al recargar.
- `GET /functions/v1/tareas` de Supabase devuelve `ok`.

## Navegadores

Playwright 1.56.1 con cinco proyectos, 30 pruebas en total.

| Proyecto | Motor |
|---|---|
| Pixel 7 | Chromium |
| iPhone 13 | WebKit |
| Desktop Chrome | Chromium |
| Desktop Firefox | Firefox |
| Desktop Safari | WebKit |

## Resultado

12 de octubre de 2026, 22:24 hora de Córdoba, contra https://san-francisco-conecta-tp5.web.app.

**30 de 30 pasaron**, en 28,8 segundos.

| Prueba | Pixel 7 | iPhone 13 | Chrome | Firefox | Safari |
|---|---|---|---|---|---|
| Responde 200 con la pantalla estática y la leyenda | Pasó | Pasó | Pasó | Pasó | Pasó |
| Solo ingreso con Google | Pasó | Pasó | Pasó | Pasó | Pasó |
| Política de seguridad en los encabezados | Pasó | Pasó | Pasó | Pasó | Pasó |
| Manifiesto e íconos | Pasó | Pasó | Pasó | Pasó | Pasó |
| Service worker activo | Pasó | Pasó | Pasó | Pasó | Pasó |
| Supabase `tareas` responde | Pasó | Pasó | Pasó | Pasó | Pasó |

App Check sigue en modo de control, sin exigir el certificado. Si se activa la exigencia, la prueba acepta un token de depuración en la variable `APPCHECK_TOKEN_HUMO`, que nunca se versiona.
