import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const Module = require('node:module');
const compiled = await build({
  stdin: { contents: "export * from './src/lib/generatedCardFormat'; export * from './src/lib/richhtml'; export {toPlainText} from './src/lib/richtext';", resolveDir: process.cwd() },
  bundle: true, write: false, format: 'cjs', platform: 'node',
  plugins: [{ name: 'platform-only', setup(builder) {
    builder.onResolve({ filter: /^react-native$/ }, () => ({ path: 'platform', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: "export const Platform={OS:'web',select:v=>v.web??v.default};" }));
  } }],
});
const loaded = new Module('generated-format-verification');
loaded._compile(compiled.outputFiles[0].text, 'generated-format-verification.cjs');
const api = loaded.exports;
const back = api.compileGeneratedBack([
  { type: 'heading', level: 2, text: '**Concepto**' },
  { type: 'paragraph', align: 'center', spans: [{ text: 'Ancla\nsalto', bold: true, italic: true, underline: true, strike: true, color: 'azul' }] },
  { type: 'toggle', title: 'Detalle', blocks: [{ type: 'bullets', items: ['[[azul:Término]]', [{ type: 'paragraph', text: 'Subtema' }, { type: 'numbered', start: 3, items: ['Uno', 'Dos'] }]] }] },
  { type: 'separator' },
  { type: 'table', rows: [['Eje', 'A'], ['Uso', 'Ejemplo']] },
]);
const html = api.marksToHtml(back);
const reopened = api.htmlToMarks(html);
const content = (value) => api.toPlainText(value).replace(/^\d+\. /gm, '');
assert.equal(content(reopened), content(back));
assert.match(html, /<details/);
assert.match(html, /<ol start="3"/);
assert.match(html, /<th/);
assert.throws(() => api.compileGeneratedBack([{ type: 'desconocido', text: 'No perder' }]), /formato incompleto/);
console.log('OK: generación con títulos, listas anidadas/numeradas, desplegables y tablas conservada al convertir y reabrir en el editor.');
