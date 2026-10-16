// Simulación HTML del JSX real; no sustituye capturas/QA de Android.
// node scripts/preview-widget-layouts.mjs --tools-dir <node_modules con playwright>
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';

const root = fileURLToPath(new URL('../', import.meta.url));
const dir = resolve(root, '.desktop-preview/widgets/layouts');
await mkdir(dir, { recursive: true });
const require = createRequire(import.meta.url);
const toolsIndex = process.argv.indexOf('--tools-dir');
const tools = toolsIndex < 0 ? require : createRequire(resolve(process.argv[toolsIndex + 1], 'package.json'));
const { chromium } = tools('playwright');
const shim = `
import React from 'react';
function style(s = {}, text = false) {
  const out = { display:'flex', flexDirection:'column', alignItems:'flex-start', boxSizing:'border-box', flexShrink:0, ...s };
  for (const k of ['width','height']) if(out[k] === 'match_parent') out[k] = '100%';
  if(s.paddingHorizontal !== undefined) {out.paddingLeft = s.paddingHorizontal; out.paddingRight = s.paddingHorizontal; delete out.paddingHorizontal;}
  if(s.backgroundGradient) {const g=s.backgroundGradient; out.background='linear-gradient('+(g.orientation==='LEFT_RIGHT'?'90deg':'135deg')+','+g.from+','+g.to+')'; delete out.backgroundGradient;}
  if(text) {out.display='-webkit-box'; out.WebkitBoxOrient='vertical'; out.overflow='hidden'; out.lineHeight='1.4';}
  delete out.adjustsFontSizeToFit;
  return out;
}
export function FlexWidget({style:s,children}) {return React.createElement('div',{style:style(s)},children);}
export function ListWidget({style:s,children}) {return React.createElement('div',{style:{...style(s),overflow:'auto'}},children);}
export function OverlapWidget({style:s,children}) {return React.createElement('div',{style:{...style(s),display:'grid'}},React.Children.toArray(children).map((child,i)=>React.createElement('div',{key:i,style:{gridArea:'1 / 1',minWidth:0}},child)));}
export function TextWidget({style:s,text,maxLines=1}) {return React.createElement('div',{style:{...style(s),justifyContent:'center',alignItems:'stretch',overflow:'hidden'}},React.createElement('div',{'data-fit':s?.adjustsFontSizeToFit||undefined,style:{display:'-webkit-box',WebkitBoxOrient:'vertical',WebkitLineClamp:maxLines,overflow:'hidden',lineHeight:1.25,width:'100%'}},text));}
export function SvgWidget({style:s,svg}) {return React.createElement('div',{style:style(s),dangerouslySetInnerHTML:{__html:svg.replace('<svg ','<svg style="width:100%;height:100%" ')}});}
`;
const result = await build({
  stdin: { contents: "export { ReviewWidget, DecksWidget, CombinedWidget } from './src/widgets/views.android.js';", resolveDir: root, loader: 'jsx' },
  bundle: true, platform: 'node', format: 'cjs', write: false,
  external: ['react', 'react/jsx-runtime'], loader: { '.js': 'jsx' }, jsx: 'automatic',
  plugins: [{ name: 'native-widget-preview', setup(b) {
    b.onResolve({ filter: /^react-native-android-widget$/ }, () => ({ path: 'widget-shim', namespace: 'preview' }));
    b.onResolve({ filter: /^react-native$/ }, () => ({ path: 'native-shim', namespace: 'native' }));
    b.onLoad({ filter: /.*/, namespace: 'native' }, () => ({ contents: "export const Platform={OS:'android'};", loader: 'js' }));
    b.onLoad({ filter: /.*/, namespace: 'preview' }, () => ({ contents: shim, loader: 'js', resolveDir: root }));
  } }],
});
const bundle = resolve(dir, 'views.cjs');
await writeFile(bundle, result.outputFiles[0].text);
const views = require(bundle);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
let fonts = '';
for (const [weight, folder, suffix] of [[400, '400Regular', 'Regular'], [600, '600SemiBold', 'SemiBold'], [700, '700Bold', 'Bold'], [800, '800ExtraBold', 'ExtraBold']]) {
  const name = `PlusJakartaSans_${weight}${suffix}`;
  const bytes = await readFile(resolve(root, `node_modules/@expo-google-fonts/plus-jakarta-sans/${folder}/${name}.ttf`));
  fonts += `@font-face{font-family:'${name}';src:url(data:font/ttf;base64,${Buffer.from(bytes).toString('base64')});font-weight:${weight}}`;
}
const data = { streak: { days: 7, activeToday: true }, review: { remaining: 23, done: 2, total: 25, pct: 8 },
  inProgress: [{ id: 1, name: 'Creación de Ofertas Irresistibles', progress: { pct: 3 } }],
  recent: [{ id: 2, name: 'Administración de Operaciones', card_count: 32 }, { id: 3, name: 'Teoría de juegos', card_count: 21 }, { id: 4, name: 'Administración de Personas', card_count: 18 }, { id: 5, name: 'Marketing', card_count: 24 }, { id: 6, name: 'Estrategia', card_count: 8 }] };
const browser = await chromium.launch({ headless: true, channel: process.env.WIDGET_BROWSER || 'chrome' });
try {
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  for (const [width, height] of [[160, 132], [400, 132], [180, 154], [294, 218], [401, 218], [160, 280], [401, 340], [320, 180], [320, 260], [320, 340], [400, 500]]) {
    for (const [name, View] of [['daily', views.ReviewWidget], ['decks', views.DecksWidget], ['combined', views.CombinedWidget]]) {
      if (name === 'combined' && height < 280) continue;
      const html = `<html><head><style>${fonts}body{margin:0;background:#09090B}svg{display:block}</style></head><body>${renderToStaticMarkup(React.createElement(View, { info: { width, height }, data }))}</body></html>`;
      await page.setViewportSize({ width, height });
      await page.setContent(html);
      await page.evaluate(async () => {
        await document.fonts.ready;
        for (const el of document.querySelectorAll('[data-fit]')) {
          let size = parseFloat(getComputedStyle(el).fontSize);
          while (el.scrollWidth > el.clientWidth && size > 10) el.style.fontSize = (--size) + 'px';
        }
      });
      await page.screenshot({ path: resolve(dir, `${name}-${width}x${height}.png`) });
      if (process.argv.includes('--selector') && width === 320 && height === (name === 'daily' ? 180 : name === 'decks' ? 260 : 340)) {
        await page.screenshot({ path: resolve(root, `assets/widgets/${name}-preview.png`) });
      }
    }
  }
  console.log('Previews del JSX real: ' + dir);
} finally { await browser.close(); }
