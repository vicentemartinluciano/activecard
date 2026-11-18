// CSS del editor Notion como string: única fuente para el bundle del WebView
// (nativo) y para la web (donde se inyecta una vez en el documento).
// Todo va scopeado a .nf-root / .nf-bubble — en la web estos estilos viven en
// la MISMA página que la app, así que no puede haber reglas sueltas sobre body.
// Los colores están hardcodeados a propósito: el bundle del WebView se
// construye aparte y no puede importar el theme en runtime. Mantener en
// sintonía con src/theme/index.js si el theme cambia.

import { TOGGLE_CSS } from "./toggleCss";

export const EDITOR_CSS = TOGGLE_CSS + `
.nf-root .tableWrapper { overflow-x: auto; max-width: 100%; margin: 12px 0; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; }
.nf-root table { border-collapse: collapse; table-layout: fixed; width: 100%; min-width: 360px; }
.nf-root td, .nf-root th { position: relative; min-width: 160px; border: 1px solid #ffffff24; padding: 10px 12px; vertical-align: top; text-align: left; line-height: 1.5; overflow-wrap: anywhere; }
.nf-root th { background: #3e63dd0d; font-weight: 600; }
.nf-root .column-resize-handle { position: absolute; right: -3px; top: 0; bottom: 0; width: 6px; background: #3e63dd; pointer-events: none; z-index: 2; }
.nf-root .resize-cursor { cursor: col-resize; }
.nf-root td[data-nf-active-cell], .nf-root th[data-nf-active-cell] { background: #3e63dd0a; box-shadow: inset 0 0 0 1px #3e63dd66; }
.nf-root td p, .nf-root th p { margin: 0 0 4px; min-height: 1.5em; }
.nf-root td > p:last-child, .nf-root th > p:last-child { margin-bottom: 0; }
.nf-root .selectedCell:after { position: absolute; inset: 0; background: #3e63dd1a; pointer-events: none; content: ""; }
.nf-table-panel { position: absolute; box-sizing: border-box; z-index: 60; padding: 4px; background: #1c1c22; color: #E9E9EF; border: 1px solid #ffffff26; border-radius: 9px; overflow-y: auto; box-shadow: 0 4px 16px #0004; }
.nf-table-panel[hidden], .nf-table-options[hidden] { display: none !important; }
.nf-table-primary { display: flex; align-items: center; gap: 2px; }
.nf-table-primary .nf-btn { flex: 1; min-width: 0; height: 36px; font-size: 13px; white-space: nowrap; }
.nf-table-primary .nf-btn:last-child { flex: 0 0 36px; font-size: 22px; }
.nf-table-options { display: flex; flex-direction: column; border-top: 1px solid #ffffff1f; margin-top: 4px; padding-top: 4px; }
.nf-table-options .nf-btn { justify-content: flex-start; font-size: 13px; height: 38px; }
.nf-table-panel .nf-btn:disabled { opacity: .4; cursor: default; }
.nf-table-panel .nf-btn:focus-visible { outline: 2px solid #3e63dd; outline-offset: -2px; }
.nf-table-grip { position: absolute; left: 0; width: 24px; height: 28px; padding: 3px; border: 0; border-radius: 4px; color: #8a7f6f; background: transparent; z-index: 4; cursor: pointer; }
.nf-table-grip[hidden] { display: none !important; }
.nf-table-grip:hover, .nf-table-grip:focus-visible { background: #ffffff12; color: #3e63dd; }
.nf-table-grip svg { width: 18px; height: 22px; }

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
  width: 100%;
  height: auto;
  display: block;
  border-radius: 8px;
  margin: 6px auto; /* centrada; el ancho por defecto es 100%, el style inline
                       (width: N%) lo achica y margin auto la mantiene centrada */
}
.nf-root .ProseMirror img.ProseMirror-selectednode { outline: 2px solid #3E63DD; }
.nf-root .ProseMirror {
  padding: 10px 12px;
  outline: none;
  caret-color: #3E63DD;
  word-wrap: break-word;
  white-space: pre-wrap;
}
.nf-root.nf-page { background: transparent; font-size: 17px; line-height: 1.65; }
.nf-root.nf-page .ProseMirror { padding: 6px 0 112px 0; line-height: 1.65; }
.nf-root.nf-page .ProseMirror p { margin: 0 0 8px; }
.nf-root.nf-page .ProseMirror h1,
.nf-root.nf-page .ProseMirror h2,
.nf-root.nf-page .ProseMirror h3 { margin: 18px 0 8px; line-height: 1.25; }
.nf-root.nf-page .ProseMirror ul,
.nf-root.nf-page .ProseMirror ol { margin: 6px 0 10px; padding-left: 24px; }
@media (min-width: 760px) {
  .nf-root.nf-page { font-size: 18px; line-height: 1.72; }
  .nf-root.nf-page .ProseMirror { line-height: 1.72; }
}
.nf-root .ProseMirror p { margin: 0 0 2px; }
.nf-root .ProseMirror h1,
.nf-root .ProseMirror h2,
.nf-root .ProseMirror h3 { margin: 4px 0; line-height: 1.22; font-weight: 750; }
.nf-root .ProseMirror h1 { font-size: 1.55em; }
.nf-root .ProseMirror h2 { font-size: 1.3em; }
.nf-root .ProseMirror h3 { font-size: 1.12em; }
.nf-root .ProseMirror blockquote {
  margin: 5px 0;
  padding: 3px 0 3px 12px;
  border-left: 3px solid #5B6897;
  color: #B7B7C2;
}
.nf-root .ProseMirror s { text-decoration: line-through; }
/* Cara con default centrado (el frente): los párrafos "sin tocar" se ven
   centrados en el editor (WYSIWYG). Un text-align inline explícito (izq/der)
   gana por especificidad, así se puede forzar otra alineación. */
.nf-align-center .ProseMirror p,
.nf-align-center .ProseMirror h1,
.nf-align-center .ProseMirror h2,
.nf-align-center .ProseMirror h3,
.nf-align-center .ProseMirror blockquote { text-align: center; }
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
  position: absolute;
  z-index: 65;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: max-content;
  max-width: calc(100% - 8px);
  background: rgba(24, 24, 30, 0.96);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 11px;
  padding: 4px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.35);
}
.nf-bubble[hidden] { display: none !important; }
.nf-insert-menu {
  display: none;
  gap: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 4px;
  flex-wrap: wrap;
}
.nf-inserting .nf-insert-menu { display: flex; flex-direction: row; }
.nf-insert-menu > .nf-btn {
  justify-content: center;
  gap: 6px;
  padding: 0 9px;
  height: 28px;
  min-height: 28px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.05);
}
.nf-insert-menu > .nf-btn:hover { background: rgba(255, 255, 255, 0.12); }
.nf-insert-menu > .nf-btn svg { width: 14px; height: 14px; }
.nf-bubble * { box-sizing: border-box; }
.nf-row { display: flex; gap: 4px; align-items: center; }
.nf-bubble > .nf-row:first-child {
  gap: 1px;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
}
.nf-bubble > .nf-row:first-child::-webkit-scrollbar { display: none; }
.nf-btn:disabled { opacity: .35; cursor: default; }
.nf-btn[hidden] { display: none; }
.nf-btn {
  min-width: 28px;
  height: 28px;
  padding: 0 5px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: #E9E9EF;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1;
  flex-shrink: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s ease, color 0.12s ease;
}
.nf-btn:hover { background: rgba(255, 255, 255, 0.1); }
.nf-btn.is-active,
.nf-inserting .nf-bubble [aria-label="Insertar"] {
  background: #213163;
  color: #9EB1FF;
  box-shadow: inset 0 0 0 1px rgba(143, 166, 243, 0.28);
}
.nf-btn svg { width: 16px; height: 16px; display: block; }
.nf-btn svg.nf-chevron { width: 10px; height: 10px; opacity: 0.7; margin-left: 2px; flex-shrink: 0; }
.nf-btn[aria-label="Cambiar formato"] { gap: 2px; padding: 0 6px; }
.nf-sep { width: 1px; height: 16px; background: rgba(255, 255, 255, 0.12); margin: 0 3px; flex-shrink: 0; }
.nf-swatches { display: none; }
.nf-swatches.open {
  display: flex;
  gap: 6px;
  padding: 6px 4px 2px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.nf-formats { display: none; }
.nf-formats.open {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 4px;
}
.nf-format-btn { min-width: 28px; font-size: 12px; font-weight: 700; }
.nf-format-btn.nf-toggle-option { border-left: 1px solid rgba(255, 255, 255, 0.15); border-radius: 0 6px 6px 0; padding: 0 10px; }
/* Con una imagen seleccionada, la barrita muestra SOLO los tamaños. */
.nf-imgrow { display: none; }
.nf-bubble.img-mode .nf-row:not(.nf-imgrow) { display: none; }
.nf-bubble.img-mode .nf-imgrow { display: flex; }
.nf-swatch {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: transform 0.1s ease;
}
.nf-swatch:hover { transform: scale(1.1); }
.nf-swatch.is-active { border-color: #FFFFFF; }
@keyframes nf-pop { from { opacity: 0; transform: translateY(4px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes nf-reveal { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }
.nf-bubble:not([hidden]) { animation: nf-pop 140ms cubic-bezier(.16,1,.3,1); transform-origin: 50% 100%; }
.nf-formats.open, .nf-swatches.open, .nf-inserting .nf-insert-menu { animation: nf-reveal 120ms ease-out; }
@media (pointer: coarse) {
  .nf-btn { height: 34px; min-width: 34px; }
  .nf-bubble > .nf-row:first-child { gap: 2px; }
  .nf-sep { margin: 0 4px; height: 18px; }
  .nf-insert-menu > .nf-btn { height: 34px; min-height: 34px; }
  .nf-swatch { width: 26px; height: 26px; }
}
@media (prefers-reduced-motion: reduce) {
  .nf-bubble:not([hidden]), .nf-formats.open, .nf-swatches.open, .nf-inserting .nf-insert-menu { animation: none; }
}
`;

// Solo para la página del WebView (nativo): ahí el editor ES toda la página.
export const EDITOR_BODY_CSS = `
:root { color-scheme: dark; }
html, body { margin: 0; padding: 0; background: #121216; }
`;
