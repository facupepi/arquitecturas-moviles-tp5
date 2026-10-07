// Revisión de accesibilidad con axe para las specs de pantalla (WP1, sección 10.3).
//
//   import { revisarAccesibilidad } from './accesibilidad.mjs';
//   await revisarAccesibilidad(page, 'tributos');
//
// Corre @axe-core/playwright con las etiquetas wcag2a y wcag2aa y falla si hay violaciones de impacto
// serious o critical. Las moderate y minor se adjuntan al reporte pero no fallan. Cada spec la llama
// una vez por pantalla, con la pantalla ya cargada (después de esperar su testID).
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

export const ETIQUETAS_AXE = ['wcag2a', 'wcag2aa'];
export const IMPACTOS_QUE_FALLAN = ['serious', 'critical'];

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} nombre  nombre de la pantalla o del estado revisado (aparece en el reporte)
 * @param {{ incluir?: string[], excluir?: string[] }} [opciones]
 *   incluir: selectores a los que se limita la revisión; excluir: selectores que se saltean (por ejemplo,
 *   las teselas de un mapa de terceros). Excluir algo propio requiere justificarlo en el informe.
 * @returns {Promise<import('axe-core').AxeResults>}
 */
export async function revisarAccesibilidad(page, nombre, { incluir = [], excluir = [] } = {}) {
  let constructor = new AxeBuilder({ page }).withTags(ETIQUETAS_AXE);
  for (const selector of incluir) constructor = constructor.include(selector);
  for (const selector of excluir) constructor = constructor.exclude(selector);
  const resultado = await constructor.analyze();

  const graves = resultado.violations.filter((v) => IMPACTOS_QUE_FALLAN.includes(v.impact));
  const resumen = resultado.violations.map((v) => ({
    regla: v.id,
    impacto: v.impact,
    descripcion: v.help,
    ayuda: v.helpUrl,
    nodos: v.nodes.map((n) => ({ selector: n.target.join(' '), resumen: n.failureSummary })),
  }));
  try {
    await test.info().attach(`axe-${nombre}.json`, { body: JSON.stringify(resumen, null, 2), contentType: 'application/json' });
  } catch { /* fuera de una prueba no hay dónde adjuntar */ }

  const texto = graves.map((v) => `- [${v.impact}] ${v.id}: ${v.help}\n` +
    v.nodes.slice(0, 5).map((n) => `    ${n.target.join(' ')}`).join('\n')).join('\n');
  expect(graves.length, `Violaciones de accesibilidad graves en "${nombre}":\n${texto}`).toBe(0);
  return resultado;
}
