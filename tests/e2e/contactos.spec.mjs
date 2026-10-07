// Contactos (S2, sección 8.4 y 10.3): C1 filtro por categoría, C2 llamar y correo con enlaces del
// sistema, C3 WhatsApp. window.open se espía en la página (RNW abre mailto: y https: con él).
import { test, expect, irA } from './fixtures.mjs';
import { revisarAccesibilidad } from './accesibilidad.mjs';
import { catalogo } from '../../shared/catalogo.mjs';

const CONTACTOS = catalogo().contactos;
const DE = (categoria) => CONTACTOS.filter((c) => c.categoria === categoria).map((c) => c.id);
const CORREO = CONTACTOS.find((c) => c.correo);
const WHATSAPP = CONTACTOS.find((c) => c.whatsapp);
const POLICIA = CONTACTOS.find((c) => c.nombre === 'Policía');

async function abrirContactos(page, hash = '#/contactos') {
  // Espía de window.open: guarda la URL y el destino y no abre nada.
  await page.evaluate(() => {
    globalThis.__abiertos = [];
    window.open = (url, destino) => { globalThis.__abiertos.push({ url: String(url), destino }); return null; };
  });
  await irA(page, hash);
  await expect(page.getByTestId('pantalla-contactos')).toBeVisible();
  await expect(page.getByTestId('lista-contactos')).toBeVisible();
}

const abiertos = (page) => page.evaluate(() => globalThis.__abiertos);

test.describe('Contactos', () => {
  test('C1: todas las áreas y el filtro por categoría', async ({ vecino }) => {
    const { page } = vecino;
    await abrirContactos(page);
    const tarjetas = page.getByTestId('lista-contactos').locator('[data-testid^="contacto-"]');
    await expect(tarjetas).toHaveCount(CONTACTOS.length);
    await expect(page.getByTestId('contacto-destacado')).toContainText('Línea 147');

    await page.getByTestId('categoria-emergencias').click();
    await expect(page.getByTestId('categoria-emergencias')).toHaveAttribute('aria-checked', 'true');
    await expect(tarjetas).toHaveCount(DE('emergencias').length);
    for (const id of DE('emergencias')) await expect(page.getByTestId(`contacto-${id}`)).toBeVisible();
    await expect(page.getByTestId(`contacto-${DE('municipal')[0]}`)).toHaveCount(0);

    await page.getByTestId('categoria-salud').click();
    await expect(tarjetas).toHaveCount(DE('salud').length);

    await page.getByTestId('categoria-todas').click();
    await expect(tarjetas).toHaveCount(CONTACTOS.length);
  });

  test('C1: el enlace profundo abre la categoría pedida', async ({ vecino }) => {
    const { page } = vecino;
    await abrirContactos(page, '#/contactos?categoria=salud');
    await expect(page.getByTestId('categoria-salud')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('lista-contactos').locator('[data-testid^="contacto-"]')).toHaveCount(DE('salud').length);
  });

  test('C2: llamar lleva el número en la etiqueta y el correo abre mailto: en la misma ventana', async ({ vecino }) => {
    const { page } = vecino;
    await abrirContactos(page);

    const llamar = page.getByTestId(`llamar-${POLICIA.id}`);
    await expect(llamar).toHaveAttribute('aria-label', new RegExp(`Llamar a Policía al ${POLICIA.telefono}`));
    await expect(page.getByTestId('destacado-llamar')).toHaveAttribute('aria-label', /147/);

    await page.getByTestId(`correo-${CORREO.id}`).click();
    await expect.poll(() => abiertos(page)).toHaveLength(1);
    const [correo] = await abiertos(page);
    expect(correo.url).toMatch(new RegExp(`^mailto:${CORREO.correo.replace('.', '\\.')}\\?subject=`));
    expect(decodeURIComponent(correo.url)).toContain('Consulta desde San Francisco Conecta');
    expect(correo.destino).toBe('_self');
  });

  test('C3: WhatsApp abre wa.me con un saludo', async ({ vecino }) => {
    const { page } = vecino;
    await abrirContactos(page);
    await page.getByTestId(`whatsapp-${WHATSAPP.id}`).click();
    await expect.poll(() => abiertos(page)).toHaveLength(1);
    const [wa] = await abiertos(page);
    expect(wa.url).toMatch(new RegExp(`^https://wa\\.me/${WHATSAPP.whatsapp}\\?text=`));
    expect(decodeURIComponent(wa.url)).toContain('Hola');
    expect(wa.destino).not.toBe('_self');

    await page.getByTestId('destacado-whatsapp').click();
    await expect.poll(() => abiertos(page)).toHaveLength(2);
  });

  test('accesibilidad de Contactos', async ({ vecino }) => {
    const { page } = vecino;
    await abrirContactos(page);
    await revisarAccesibilidad(page, 'contactos');
    await page.getByTestId('categoria-emergencias').click();
    await revisarAccesibilidad(page, 'contactos-emergencias');
  });
});
