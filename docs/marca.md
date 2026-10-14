# Identidad visual

Los archivos de marca están en `public/brand/`. Este documento queda fuera de `public/` para que no se publique en Hosting.

El logo se obtuvo de la web pública de la Municipalidad de San Francisco el 7 de octubre de 2026 para este trabajo práctico académico (UTN FRSFCO).

- Fuente: https://www.sanfrancisco.gov.ar/theme/imagenes/estructura/Logo_Institucional_blanco.png
- `public/brand/municipalidad-blanco-ingreso.png`: el mismo logo reducido a 174 × 102 px (tres veces su tamaño en el Ingreso) y a 256 colores, para la pantalla de Ingreso y la pantalla de arranque de `index.html`.
- Referencia visual: https://www.sanfrancisco.gov.ar/
- Quicksand: Google Fonts (subconjunto latino, variable de 300 a 700, archivo `public/fonts/quicksand-latin.woff2`), licencia SIL Open Font License incluida en `public/fonts/OFL-Quicksand.txt`.
- Ícono de la app (`public/icons/`): propio, una "C" blanca sobre #009ee2. No usa el logo municipal.

Colores contrastados en el CSS público: celeste #009ee2, azul oscuro #1e2939, verde #6aa435, naranja #f07e07 y amarillo #f4c000. Los botones y textos usan variantes más oscuras cuando hace falta contraste.

La app se publica en Firebase Hosting como proyecto académico de la UTN FRSFCO, sin vínculo oficial con la Municipalidad. La única nota es "Proyecto académico UTN FRSFCO", al pie de la pantalla de Ingreso, en el pie institucional y al final del cedulón impreso. Los pagos pasan por una pasarela simulada, sin dinero real; las notificaciones push, en cambio, son reales.
