// Construye el bundle del editor del WebView y lo escribe como un módulo JS
// que exporta el HTML completo (string). El resultado (assets/editor/
// editorHtml.js) se COMMITEA: así viaja por OTA y el editor abre sin conexión.
//
//   npm run editor:build
//
// Correr esto cada vez que cambie editor-web/index.js, editorSetup.js,
// tiptapTColor.js o editorCss.js.

import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = resolve(root, "assets/editor/editorHtml.js");

const result = await build({
  entryPoints: [resolve(root, "editor-web/index.js")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2019",
  platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
  write: false,
  logLevel: "info",
});

const js = result.outputFiles[0].text;

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
</head>
<body>
<script>${js}</script>
</body>
</html>`;

// El HTML se embebe como string JS: hay que escapar el cierre de script (si
// no, el <script> del bundle cortaría el HTML de la página que lo contiene)
// y los delimitadores del template literal.
const escaped = html
  .replace(/\\/g, "\\\\")
  .replace(/`/g, "\\`")
  .replace(/\$\{/g, "\\${")
  .replace(/<\/script/gi, "<\\/script");

const module = `/* eslint-disable */
// ARCHIVO GENERADO por scripts/build-editor.mjs — NO editar a mano.
// Regenerar con: npm run editor:build
export default \`${escaped}\`;
`;

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, module, "utf8");

const kb = Math.round(Buffer.byteLength(module, "utf8") / 1024);
console.log(`editorHtml.js escrito (${kb} KB)`);
