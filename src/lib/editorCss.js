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
.nf-root th { background: #4668e810; font-weight: 600; }
.nf-root .column-resize-handle { position: absolute; right: -3px; top: 0; bottom: 0; width: 6px; background: #4668e8; pointer-events: none; z-index: 2; }
.nf-root .resize-cursor { cursor: col-resize; }
.nf-root td[data-nf-active-cell], .nf-root th[data-nf-active-cell] { background: #4668e80d; box-shadow: inset 0 0 0 1px #4668e866; }
.nf-root td p, .nf-root th p { margin: 0 0 4px; min-height: 1.5em; }
.nf-root td > p:last-child, .nf-root th > p:last-child { margin-bottom: 0; }
.nf-root .selectedCell:after { position: absolute; inset: 0; background: #4668e81e; pointer-events: none; content: ""; }
.nf-table-panel { position: absolute; box-sizing: border-box; z-index: 60; padding: 4px; background: #11131A; color: #F3F4F8; border: 1px solid #ffffff1f; border-radius: 10px; overflow-y: auto; box-shadow: 0 12px 28px rgba(0, 0, 0, 0.55); }
.nf-table-panel[hidden], .nf-table-options[hidden] { display: none !important; }
.nf-table-primary { display: flex; align-items: center; gap: 2px; }
.nf-table-primary .nf-btn { flex: 1; min-width: 0; height: 36px; font-size: 13px; white-space: nowrap; }
.nf-table-primary .nf-btn:last-child { flex: 0 0 36px; font-size: 22px; }
.nf-table-options { display: flex; flex-direction: column; border-top: 1px solid #ffffff1a; margin-top: 4px; padding-top: 4px; }
.nf-table-options .nf-btn { justify-content: flex-start; font-size: 13px; height: 38px; }
.nf-table-panel .nf-btn:disabled { opacity: .4; cursor: default; }
.nf-table-panel .nf-btn:focus-visible { outline: 2px solid #4668e8; outline-offset: -2px; }
.nf-table-grip { position: absolute; left: 0; width: 24px; height: 28px; padding: 3px; border: 0; border-radius: 4px; color: #8F94A8; background: transparent; z-index: 4; cursor: pointer; }
.nf-table-grip[hidden] { display: none !important; }
.nf-table-grip:hover, .nf-table-grip:focus-visible { background: #ffffff12; color: #9BB4FF; }
.nf-table-grip svg { width: 18px; height: 22px; }

.nf-root {
  position: relative;
  background: #0C0D12;
  color: #F3F4F8;
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
.nf-root .ProseMirror img.ProseMirror-selectednode { outline: 2px solid #4668E8; }
.nf-root .ProseMirror {
  padding: 10px 12px;
  outline: none;
  caret-color: #4668E8;
  word-wrap: break-word;
  white-space: pre-wrap;
}
.nf-root.nf-page { background: transparent; font-size: 17px; line-height: 1.65; }
.nf-root.nf-page .ProseMirror { padding: 6px 0 180px 0; line-height: 1.65; }
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
  color: #767B91;
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
  background: rgba(17, 19, 26, 0.96);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 4px;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.62), 0 2px 8px rgba(0, 0, 0, 0.4);
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
/* Fórmulas LaTeX (Live Preview sobre KaTeX MathML) */
.nf-root .nf-math-hidden-src {
  display: inline-block;
  max-width: 0;
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  font-size: 0 !important;
  line-height: 0 !important;
  color: transparent !important;
  vertical-align: top;
  pointer-events: none;
  user-select: none;
}
.nf-root .nf-math-hidden-line {
  margin: 0 !important;
  padding: 0 !important;
  max-height: 0 !important;
  min-height: 0 !important;
  line-height: 0 !important;
  overflow: hidden !important;
  opacity: 0;
  pointer-events: none;
}
.nf-root .nf-math-widget {
  cursor: pointer;
  user-select: none;
  transition: background 0.14s ease, box-shadow 0.14s ease;
}
.nf-root .nf-math-widget.is-editing {
  background: rgba(70, 104, 232, 0.16);
  box-shadow: 0 0 0 1.5px rgba(70, 104, 232, 0.72);
  border-radius: 8px;
}
.nf-root .nf-marquee {
  position: absolute;
  z-index: 75;
  pointer-events: none;
  box-sizing: border-box;
  border-radius: 4px;
  background: rgba(70, 104, 232, 0.18);
  border: 1.5px solid rgba(155, 180, 255, 0.85);
}
.nf-root [data-nf-block-selected="true"] {
  background: rgba(70, 104, 232, 0.16);
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px rgba(155, 180, 255, 0.45);
}
.nf-multi-bar {
  position: absolute;
  z-index: 68;
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 5px 6px;
  border-radius: 10px;
  background: rgba(17, 19, 26, 0.98);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #F3F4F8;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.64), 0 2px 8px rgba(0, 0, 0, 0.4);
  animation: nf-reveal 110ms ease-out;
}
.nf-multi-bar[hidden],
.nf-marquee[hidden] {
  display: none !important;
}
.nf-multi-count {
  font-size: 12px;
  font-weight: 600;
  color: #8F94A8;
  padding: 0 6px 0 4px;
  white-space: nowrap;
}
.nf-multi-btn {
  border: none;
  border-radius: 7px;
  height: 28px;
  padding: 0 9px;
  background: rgba(255, 255, 255, 0.06);
  color: #F3F4F8;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.nf-multi-btn:hover:not(:disabled) {
  background: rgba(70, 104, 232, 0.22);
  color: #9BB4FF;
}
.nf-multi-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.nf-multi-del {
  background: rgba(229, 72, 77, 0.14);
  color: #FF8B8E;
}
.nf-multi-del:hover:not(:disabled) {
  background: rgba(229, 72, 77, 0.24);
  color: #FF8B8E;
}
.nf-math-popover,
.nf-link-popover {
  position: absolute;
  z-index: 68;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(17, 19, 26, 0.98);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #F3F4F8;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.68), 0 2px 8px rgba(0, 0, 0, 0.42);
  overflow-y: auto;
  animation: nf-reveal 120ms ease-out;
}
.nf-math-popover[hidden],
.nf-link-popover[hidden],
.nf-link-hover[hidden],
.nf-link-input[hidden],
.nf-link-error[hidden],
.nf-link-actions[hidden],
.nf-link-mode-expand[hidden],
.nf-link-popover-open[hidden] { display: none !important; }
.nf-link-popover.is-compact {
  gap: 0;
  padding: 5px 6px;
}
.nf-link-popover.is-compact .nf-link-modes {
  display: flex;
  align-items: center;
  gap: 3px;
}
.nf-link-mode-expand {
  border: none;
  border-radius: 7px;
  height: 28px;
  min-width: 28px;
  padding: 0 7px;
  background: rgba(255, 255, 255, 0.06);
  color: #F3F4F8;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}
.nf-link-mode-expand:hover {
  background: rgba(70, 104, 232, 0.22);
  color: #9BB4FF;
}
.nf-link-hover {
  position: absolute;
  z-index: 67;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 9px;
  background: #11131A;
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.6), 0 2px 6px rgba(0, 0, 0, 0.36);
  animation: nf-reveal 100ms ease-out;
}
.nf-link-hover-btn {
  border: none;
  border-radius: 6px;
  height: 26px;
  padding: 0 9px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.06);
  color: #F3F4F8;
}
.nf-link-hover-edit:hover {
  background: rgba(70, 104, 232, 0.22);
  color: #9BB4FF;
}
.nf-link-hover-delete {
  color: #FF8B8E;
  background: rgba(229, 72, 77, 0.12);
}
.nf-link-hover-delete:hover {
  background: rgba(229, 72, 77, 0.22);
}
.nf-math-popover-preview {
  min-height: 36px;
  max-height: 120px;
  overflow-x: auto;
  overflow-y: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(70, 104, 232, 0.08);
  border: 1px solid rgba(155, 180, 255, 0.16);
  color: #F3F4F8;
}
.nf-math-popover-preview math {
  font-family: "Cambria Math", "STIX Two Math", "Latin Modern Math", "Times New Roman", serif;
  font-size: 1.08em;
  color: inherit;
}
.nf-math-popover-empty {
  color: #8F94A8;
  font-size: 12.5px;
}
.nf-math-popover-input,
.nf-link-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: #0C0D12;
  color: #F3F4F8;
  font-size: 13px;
  line-height: 1.45;
  outline: none;
}
.nf-math-popover-input {
  resize: vertical;
  min-height: 52px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.nf-math-popover-input:focus,
.nf-link-input:focus {
  border-color: #4668E8;
  box-shadow: 0 0 0 1px rgba(70, 104, 232, 0.45);
}
.nf-math-popover-actions,
.nf-link-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}
.nf-math-popover-actions { justify-content: space-between; }
.nf-link-actions .nf-link-popover-open { margin-right: auto; }
.nf-math-popover-btn,
.nf-link-popover-btn {
  border: none;
  border-radius: 8px;
  height: 30px;
  padding: 0 12px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.nf-math-popover-delete,
.nf-link-popover-delete {
  background: rgba(229, 72, 77, 0.14);
  color: #FF8B8E;
}
.nf-math-popover-done,
.nf-link-popover-done {
  background: #4668E8;
  color: #FFFFFF;
}
.nf-link-popover-open {
  background: rgba(255, 255, 255, 0.08);
  color: #9BB4FF;
}
.nf-link-modes {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  padding: 3px;
  border-radius: 9px;
  background: rgba(6, 6, 8, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.nf-link-mode-btn {
  border: none;
  border-radius: 7px;
  height: 28px;
  padding: 0 6px;
  background: transparent;
  color: #8F94A8;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.nf-link-mode-btn:hover { color: #F3F4F8; background: rgba(255, 255, 255, 0.06); }
.nf-link-mode-btn.is-active {
  background: rgba(70, 104, 232, 0.24);
  color: #9BB4FF;
  box-shadow: inset 0 0 0 1px rgba(155, 180, 255, 0.35);
}
.nf-link-error {
  color: #FF8B8E;
  font-size: 12px;
  line-height: 1.3;
}
@media (pointer: coarse) {
  .nf-math-popover-btn,
  .nf-link-popover-btn { height: 36px; padding: 0 14px; font-size: 13px; }
  .nf-link-mode-btn { height: 34px; font-size: 12.5px; }
  .nf-link-mode-expand,
  .nf-root .nf-link-block-edit { min-width: 34px; height: 32px; }
}
@media (prefers-reduced-motion: reduce) {
  .nf-math-popover,
  .nf-link-popover,
  .nf-link-hover,
  .nf-multi-bar { animation: none; }
}
/* Enlaces estilo Notion: URL inline, mención, marcador y tarjeta */
.nf-root a.nf-link-inline {
  color: #9BB4FF;
  text-decoration: underline;
  text-decoration-color: rgba(155, 180, 255, 0.55);
  text-underline-offset: 3px;
  cursor: pointer;
}
.nf-root a.nf-link-mention {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 8px;
  margin: 0 2px;
  border-radius: 999px;
  background: rgba(70, 104, 232, 0.16);
  border: 1px solid rgba(155, 180, 255, 0.3);
  color: #F3F4F8;
  font-weight: 600;
  font-size: 0.94em;
  text-decoration: none;
  cursor: pointer;
  vertical-align: baseline;
}
.nf-root a.nf-link-mention::before {
  content: attr(data-link-icon);
  color: #9BB4FF;
  font-size: 0.9em;
  line-height: 1;
}
.nf-root a.nf-link:hover { filter: brightness(1.1); }
.nf-root .nf-link-block {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 8px 0;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(17, 19, 26, 0.96);
  color: #F3F4F8;
  cursor: pointer;
  transition: border-color 0.14s ease, background 0.14s ease;
}
.nf-root .nf-link-block:hover { border-color: rgba(155, 180, 255, 0.45); }
.nf-root .nf-link-block-card {
  flex-direction: column;
  align-items: stretch;
  padding: 0;
  overflow: hidden;
  border-color: rgba(70, 104, 232, 0.35);
}
.nf-root .nf-link-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(70, 104, 232, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.nf-root .nf-link-block-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
}
.nf-root .nf-link-block-card .nf-link-block-body {
  padding: 10px 12px;
}
.nf-root .nf-link-block-body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.nf-root .nf-link-block-title {
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.35;
  color: #F3F4F8;
  overflow-wrap: anywhere;
}
.nf-root .nf-link-block-desc {
  font-size: 12.5px;
  line-height: 1.4;
  color: #8F94A8;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.nf-root .nf-link-block-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #8F94A8;
}
.nf-root .nf-link-block-icon {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--nf-link-accent, #9BB4FF);
}
.nf-root .nf-link-block-edit {
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.06);
  color: #8F94A8;
  min-width: 28px;
  height: 28px;
  padding: 0 7px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}
.nf-root .nf-link-block-edit:hover {
  background: rgba(70, 104, 232, 0.22);
  border-color: rgba(155, 180, 255, 0.35);
  color: #9BB4FF;
}
.nf-root .nf-link-block-edit[hidden] {
  display: none !important;
}
.nf-root .nf-math-inline {
  display: inline-flex;
  align-items: baseline;
  vertical-align: middle;
  margin: 0 2px;
  padding: 1px 3px;
  border-radius: 5px;
}
.nf-root .nf-math-inline:hover {
  background: rgba(70, 104, 232, 0.12);
}
.nf-root .nf-math-block {
  display: flex;
  justify-content: center;
  width: 100%;
  box-sizing: border-box;
  overflow-x: auto;
  margin: 8px 0;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(70, 104, 232, 0.06);
  border: 1px solid rgba(155, 180, 255, 0.16);
}
.nf-root .nf-math-widget math {
  font-family: "Cambria Math", "STIX Two Math", "Latin Modern Math", "Times New Roman", serif;
  font-size: 1.08em;
  color: inherit;
}
`;

// Solo para la página del WebView (nativo): ahí el editor ES toda la página.
export const EDITOR_BODY_CSS = `
:root { color-scheme: dark; }
html, body { margin: 0; padding: 0; background: #0C0D12; }
html.nf-native-document {
  min-height: 100%;
  overflow: clip;
  overflow-anchor: none;
  overscroll-behavior-y: none;
}
html.nf-native-document body {
  min-height: 100%;
  overflow: visible;
  overflow-anchor: none;
  overscroll-behavior-y: none;
}
`;
