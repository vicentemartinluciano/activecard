import { compileGeneratedBack, normalizeGeneratedCard } from '../generatedCardFormat';
import { decodeTable, decodeToggle, toPlainText } from '../richtext';
import { decodeFormatted, decodeList } from '../richContent';
import { marksToHtml, htmlToMarks } from '../richhtml';

test('desplegables, listas anidadas y marcas se conservan al pasar por el editor', () => {
  const blocks = [{ type: 'paragraph', text: '**Idea** → definición breve' }, { type: 'separator' }, { type: 'toggle', title: '**Categoría**', blocks: [{ type: 'quote', text: '*Aplicación concreta*' }, { type: 'bullets', items: ['[[azul:Concepto]]', [{ type: 'paragraph', text: '**Subtema**' }, { type: 'numbered', start: 3, items: ['__Primero__', '==Límite=='] }]] }] }];
  const back = compileGeneratedBack(blocks);
  const toggle = decodeToggle(back.split('\n')[2]);
  expect(toggle.summary).toBe('**Categoría**');
  expect(decodeList(toggle.content.split('\n')[1]).items).toHaveLength(2);
  const reopened = htmlToMarks(marksToHtml(back));
  expect(toPlainText(reopened).replace(/^\d+\. /gm, '')).toBe(toPlainText(back).replace(/^\d+\. /gm, ''));
  expect(marksToHtml(reopened)).toContain('<details');
  expect(marksToHtml(reopened)).toContain('<ol start="3"');
});

test('tabla comparativa convierte encabezados y conserva el contenido', () => {
  const back = compileGeneratedBack([{ type: 'table', rows: [['Eje', 'A', 'B'], ['Objetivo', 'Propio', 'Organización']] }]);
  const table = decodeTable(back);
  expect(table[0].every((cell) => cell.header)).toBe(true);
  expect(table[1][1].text).toBe('Propio');
  expect(toPlainText(htmlToMarks(marksToHtml(back)))).toBe(toPlainText(back));
});

test('lee respuestas anteriores sin reescribir sus marcas', () => {
  expect(normalizeGeneratedCard({ front: ' Pregunta ', back: '**Respuesta**\n---\n*Ejemplo*' })).toEqual({ front: 'Pregunta', back: '**Respuesta**\n---\n*Ejemplo*' });
});

test.each([[{ type: 'unknown', text: 'No perder' }], [{ type: 'toggle', title: 'Título', blocks: [] }], [{ type: 'numbered', start: -1, items: ['a'] }], [{ type: 'table', rows: [['A', 'B'], ['Incompleta']] }]])('un bloque inválido no se descarta silenciosamente', (block) => {
  expect(() => compileGeneratedBack([block])).toThrow('formato incompleto');
});


test('spans exactos conservan estilos combinados y saltos internos sin Markdown ambiguo', () => {
  const spans = [{ text: 'Ancla\nsegunda línea', bold: true, italic: true, underline: true, strike: true, color: 'azul' }, { text: ' explicación', highlight: true }];
  const back = compileGeneratedBack([{ type: 'paragraph', align: 'center', spans }]);
  expect(decodeFormatted(back)).toMatchObject({ kind: 'p', align: 'center', spans });
  expect(decodeFormatted(htmlToMarks(marksToHtml(back)))).toMatchObject({ align: 'center', spans });
});
