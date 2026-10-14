// Assets ilustrativos del selector Android. Datos de muestra; no son una captura del teléfono.
// Requiere sharp (local, o --sharp-dir apuntando a un directorio node_modules).
import { mkdir, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardsMark, chevronMark, widgetBackdrop } from '../src/widgets/art.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const sharpDir = process.argv.indexOf('--sharp-dir');
const require = createRequire(sharpDir < 0 ? import.meta.url : resolve(process.argv[sharpDir + 1], 'package.json'));
const sharp = require('sharp');
const text = (x, y, value, size, weight = 600, color = '#F4F6FF') => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}" font-family="Arial, sans-serif">${value}</text>`;
const icon = (svg, x, y) => svg.replace('<svg ', `<svg x="${x}" y="${y}" `);
const open = (height) => widgetBackdrop(320, height).replace('</svg>', '');
const bar = (y, width, pct) => `<rect x="12" y="${y}" width="${width}" height="5" rx="3" fill="#FFFFFF" opacity=".08"/><rect x="12" y="${y}" width="${width * pct / 100}" height="5" rx="3" fill="#65D9A5"/>`;
const header = (title) => icon(cardsMark, 12, 12) + text(48, 32, title, 14, 700) + `<rect x="276" y="12" width="32" height="30" rx="10" fill="#FFFFFF" opacity=".05"/>` + text(284, 34, '↻', 22, 600, '#A6BBFF');
const daily = open(180) + header('Repaso diario') + text(12, 83, '24', 38, 800) + text(70, 79, 'pendientes', 12, 400, '#A6B2D0') + text(12, 106, '16 completadas · 40%', 11, 400, '#A6B2D0') + bar(117, 296, 40) + `<rect x="12" y="136" width="296" height="32" rx="12" fill="#3E63DD"/>` + text(24, 157, 'Repasar ahora', 12, 700) + text(278, 159, '→', 20) + '</svg>';
let decks = open(260) + header('Mazos en progreso');
for (const [i, name, pct] of [[0, 'Administración de Operaciones', 65], [1, 'Teoría de juegos', 30], [2, 'Administración de Personas', 12]]) {
  const y = 76 + i * 56;
  decks += text(12, y, name, 13, 700) + bar(y + 14, 238, pct) + text(260, y + 20, `${pct}%`, 10, 600, '#65D9A5') + icon(chevronMark, 292, y - 2);
}
decks += text(12, 244, 'Biblioteca', 11, 600, '#A6BBFF') + text(224, 244, 'AVANCE DE HOY', 8, 400, '#A6B2D0') + '</svg>';
const destination = resolve(root, 'assets/widgets');
await mkdir(destination, { recursive: true });
for (const [name, svg] of [['daily-preview', daily], ['decks-preview', decks]]) {
  await writeFile(resolve(destination, `${name}.svg`), svg);
  await sharp(Buffer.from(svg)).resize(640).png().toFile(resolve(destination, `${name}.png`));
  console.log(`${name}.png`);
}
