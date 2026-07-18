// CSS del editor Notion como string: única fuente para el bundle del WebView
// (nativo) y para la web (donde se inyecta una vez en el documento).
// Todo va scopeado a .nf-root / .nf-bubble — en la web estos estilos viven en
// la MISMA página que la app, así que no puede haber reglas sueltas sobre body.
// Los colores están hardcodeados a propósito: el bundle del WebView se
// construye aparte y no puede importar el theme en runtime. Mantener en
// sintonía con src/theme/index.js si el theme cambia.

export const EDITOR_CSS = `
.nf-root {
  position: relative;
  background: #121216;
  color: #E9E9EF;
  font-family: -apple-system, Roboto, "Segoe UI", sans-serif;
  font-size: 16px;
  line-height: 1.45;
  -webkit-tap-highlight-color: transparent;
}
.nf-root .ProseMirror img {
  max-width: 100%;
  height: auto;
  display: block;
  border-radius: 8px;
  margin: 6px 0;
}
.nf-root .ProseMirror img.ProseMirror-selectednode { outline: 2px solid #3E63DD; }
/* Botón para insertar imagen: fijo abajo a la derecha del campo. */
.nf-imgbtn {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: #1C1C22;
  color: #B7B7C2;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  z-index: 5;
}
.nf-imgbtn:hover { background: #24242C; color: #E9E9EF; }
.nf-imgbtn svg { width: 16px; height: 16px; display: block; }
.nf-root .ProseMirror {
  padding: 10px 12px;
  outline: none;
  caret-color: #3E63DD;
  word-wrap: break-word;
  white-space: pre-wrap;
}
.nf-root .ProseMirror p { margin: 0 0 2px; }
.nf-root .ProseMirror ul, .nf-root .ProseMirror ol { margin: 2px 0; padding-left: 22px; }
.nf-root .ProseMirror li > p { margin: 0; }
.nf-root .ProseMirror hr {
  border: none;
  border-top: 1px solid #202027;
  margin: 10px 0;
}
.nf-root .ProseMirror mark { background: #4A3A12; color: inherit; border-radius: 2px; }
.nf-root .ProseMirror u { text-decoration: underline; }
/* Placeholder (extensión Placeholder de TipTap) */
.nf-root .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  color: #8B8B98;
  float: left;
  height: 0;
  pointer-events: none;
}
/* Barrita flotante */
.nf-bubble {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: #1C1C22;
  border: 1px solid #FFFFFF1F;
  border-radius: 10px;
  padding: 6px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  z-index: 50;
}
.nf-bubble * { box-sizing: border-box; }
.nf-row { display: flex; gap: 4px; align-items: center; }
.nf-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 6px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: #E9E9EF;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nf-btn:hover { background: #FFFFFF14; }
.nf-btn.is-active { background: #1C2647; color: #8FA6F3; }
.nf-btn svg { width: 17px; height: 17px; display: block; }
.nf-sep { width: 1px; height: 20px; background: #FFFFFF1F; margin: 0 2px; }
.nf-swatches { display: none; }
.nf-swatches.open { display: flex; }
.nf-swatch {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}
.nf-swatch.is-active { border-color: #FFFFFF; }
`;

// Solo para la página del WebView (nativo): ahí el editor ES toda la página.
export const EDITOR_BODY_CSS = `
:root { color-scheme: dark; }
html, body { margin: 0; padding: 0; background: #121216; }
`;
