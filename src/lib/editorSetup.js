// Configuración compartida del editor Notion: la usan el bundle del WebView
// (nativo, editor-web/index.js) y el editor de la web (NotionField.web.js).
// Así las dos plataformas tienen exactamente las mismas marcas y atajos.

import { Extension, textInputRule } from "@tiptap/core";
import { Highlight } from "@tiptap/extension-highlight";
import { Placeholder } from "@tiptap/extensions";
import { StarterKit } from "@tiptap/starter-kit";

import { EDITOR_TEXT_COLORS, TColor } from "./tiptapTColor";

// Atajos de tipeo propios. "->" se transforma en la flecha → (el conector de
// las tarjetas). Los otros ya vienen de StarterKit: "---" = divisor,
// "- " = viñeta, "1. " = lista numerada.
const Shortcuts = Extension.create({
  name: "activecardShortcuts",
  addInputRules() {
    return [textInputRule({ find: /->$/, replace: "→" })];
  },
});

export function buildExtensions({ placeholder = "" } = {}) {
  return [
    StarterKit.configure({
      // Fuera lo que el formato de ActiveCard no sabe representar.
      heading: false,
      blockquote: false,
      code: false,
      codeBlock: false,
      strike: false,
      link: false,
      hardBreak: false,
      trailingNode: false,
      // Quedan: bold, italic, underline, horizontalRule (---),
      // bulletList (- ), orderedList (1. ), undoRedo.
    }),
    Highlight,
    TColor,
    Placeholder.configure({ placeholder }),
    Shortcuts,
  ];
}

export const COLOR_KEYS = Object.keys(EDITOR_TEXT_COLORS);
export { EDITOR_TEXT_COLORS };

// Barrita flotante: SOLO lo esencial (decisión de producto). Listas, divisor
// y flecha se hacen por atajo de tipeo, no por botón.
const HIGHLIGHTER_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>`;

export const BUBBLE_BUTTONS = [
  { key: "bold", label: "Negrita", html: '<b style="font-size:15px">B</b>' },
  { key: "italic", label: "Cursiva", html: '<i style="font-family:Georgia,serif;font-size:15px">I</i>' },
  { key: "underline", label: "Subrayado", html: '<u style="font-size:15px">U</u>' },
  { key: "highlight", label: "Resaltado", html: HIGHLIGHTER_SVG },
];

// El botón de color abre la fila de swatches (no aplica nada por sí mismo).
export const COLOR_BUTTON = {
  key: "color",
  label: "Color del texto",
  html: '<span style="display:flex;flex-direction:column;align-items:center;gap:2px;line-height:1"><span style="font-size:13px;font-weight:700">A</span><span style="width:14px;height:3px;border-radius:2px;background:linear-gradient(90deg,#E5484D,#FFC53D,#46A758,#6E8BEB)"></span></span>',
};

// Estado activo de cada botón, para pintarlos en el bubble.
export function activeStates(editor) {
  const state = {};
  for (const b of BUBBLE_BUTTONS) state[b.key] = editor.isActive(b.key);
  state.colorKey = null;
  for (const key of COLOR_KEYS) {
    if (editor.isActive("tcolor", { color: key })) {
      state.colorKey = key;
      break;
    }
  }
  return state;
}

// Aplica la acción de un botón del bubble.
export function runBubbleAction(editor, key) {
  const chain = editor.chain().focus();
  if (key === "bold") chain.toggleBold();
  else if (key === "italic") chain.toggleItalic();
  else if (key === "underline") chain.toggleUnderline();
  else if (key === "highlight") chain.toggleHighlight();
  chain.run();
}

// Elegir un color reemplaza el anterior; volver a elegir el mismo lo saca.
export function applyColor(editor, colorKey, currentKey) {
  const chain = editor.chain().focus();
  if (currentKey === colorKey) chain.unsetMark("tcolor");
  else chain.setMark("tcolor", { color: colorKey });
  chain.run();
}
