// Muestrea el mismo Lottie de Inicio; no crea un fuego diferente para el widget.
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Buffer } from 'node:buffer';
const toolsIndex = process.argv.indexOf('--tools-dir');
const require = createRequire(resolve(process.argv[toolsIndex + 1], 'package.json'));
const { chromium } = require('playwright');
const animationData = JSON.parse(await readFile('assets/lottie/streak-fire.json', 'utf8'));
const destination = 'assets/widgets/flame';
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 128, height: 128 } });
  await page.setContent('<style>body{margin:0;background:transparent}#flame{width:128px;height:128px}#flame svg{transform:scale(1.4)!important;transform-origin:50% 50%}</style><div id="flame"></div>');
  await page.addScriptTag({ path: resolve('node_modules/lottie-web/build/player/lottie.min.js') });
  await page.evaluate(async (data) => {
    window.widgetFlame = window.lottie.loadAnimation({ container: document.getElementById('flame'), renderer: 'svg', loop: false, autoplay: false, animationData: data });
    await new Promise((done) => window.widgetFlame.addEventListener('DOMLoaded', done));
  }, animationData);
  for (let i = 0; i < 48; i++) {
    await page.evaluate((frame) => window.widgetFlame.goToAndStop(frame, true), animationData.ip + (animationData.op - animationData.ip - 1) * i / 48);
    await page.screenshot({ path: `${destination}/frame-${i}.png`, omitBackground: true });
  }
  const bytes = await readFile(`${destination}/frame-24.png`);
  await writeFile('src/widgets/flameFrame.js', `// Generado desde assets/lottie/streak-fire.json por build-widget-flame.mjs.\nexport const flameFrame = 'data:image/png;base64,${Buffer.from(bytes).toString('base64')}';\n`);
} finally { await browser.close(); }
