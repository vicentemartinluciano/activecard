// Configuración compartida del editor Notion: la usan el bundle del WebView
// (nativo, editor-web/index.js) y el editor de la web (NotionField.web.js).
// Así las dos plataformas tienen exactamente las mismas marcas y atajos.

import { Extension, textInputRule } from "@tiptap/core";
import { Highlight } from "@tiptap/extension-highlight";
import { Placeholder } from "@tiptap/extensions";
import { StarterKit } from "@tiptap/starter-kit";

import { compressFile } from "./imageCompress";
import { Image } from "./tiptapImage";
import { EDITOR_TEXT_COLORS, TColor } from "./tiptapTColor";
import { ALIGNMENTS, TextAlign } from "./tiptapTextAlign";

// Atajos de tipeo propios. "->" se transforma en la flecha → (el conector de
// las tarjetas). Los otros ya vienen de StarterKit: "---" = divisor,
// "- " = viñeta, "1. " = lista numerada.
const Shortcuts = Extension.create({
  name: "activecardShortcuts",
  addInputRules() {
    return [textInputRule({ find: /->$/, replace: "→" })];
  },
});

export function buildExtensions({ placeholder = "", defaultAlign = "left" } = {}) {
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
    TextAlign.configure({ types: ["paragraph"], defaultAlignment: defaultAlign }),
    Image,
    Placeholder.configure({ placeholder }),
    Shortcuts,
  ];
}

// --- Imágenes --------------------------------------------------------------
// Ícono del botón para insertar imagen (abre el selector de archivos).
export const IMAGE_BTN_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-4.5-4.5L5 21"/></svg>`;

// Comprime el archivo elegido (canvas) e inserta la imagen como bloque.
export async function insertImageFile(editor, file) {
  if (!file || !file.type || !file.type.startsWith("image/")) return;
  const src = await compressFile(file);
  editor.chain().focus().setImage({ src }).run();
}

// Tamaños de imagen (ancho en % del contenedor). Se muestran en la barrita
// cuando hay una imagen seleccionada.
export const IMAGE_SIZES = [
  { key: "img-45", label: "Pequeña", pct: 45, html: "S" },
  { key: "img-70", label: "Mediana", pct: 70, html: "M" },
  { key: "img-100", label: "Grande", pct: 100, html: "G" },
];

export function isImageSelected(editor) {
  return editor.isActive("image");
}

export function currentImageWidth(editor) {
  return editor.getAttributes("image").width || 100;
}

export function setImageWidth(editor, pct) {
  editor.chain().focus().updateAttributes("image", { width: pct }).run();
}

// Pegar una imagen desde el portapapeles: la detecta, la comprime e inserta.
// Devuelve true si consumió el evento (para no pegar además como texto/HTML).
export function handleImagePaste(editor, event) {
  const items = event.clipboardData && event.clipboardData.items;
  if (!items) return false;
  for (const item of items) {
    if (item.type && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        event.preventDefault();
        insertImageFile(editor, file);
        return true;
      }
    }
  }
  return false;
}

export const COLOR_KEYS = Object.keys(EDITOR_TEXT_COLORS);
export { EDITOR_TEXT_COLORS };

// Barrita flotante: SOLO lo esencial (decisión de producto). Listas, divisor
// y flecha se hacen por atajo de tipeo, no por botón.
const HIGHLIGHTER_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>`;
// Ícono de alineación (un botón que cicla izquierda → centro → derecha).
const ALIGN_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="17" y1="12" x2="7" y2="12"/><line x1="19" y1="18" x2="5" y2="18"/></svg>`;

export const BUBBLE_BUTTONS = [
  { key: "bold", label: "Negrita", html: '<b style="font-size:15px">B</b>' },
  { key: "italic", label: "Cursiva", html: '<i style="font-family:Georgia,serif;font-size:15px">I</i>' },
  { key: "underline", label: "Subrayado", html: '<u style="font-size:15px">U</u>' },
  { key: "highlight", label: "Resaltado", html: HIGHLIGHTER_SVG },
  { key: "align", label: "Alineación", html: ALIGN_SVG },
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
  // "align" no es una marca: se ilumina cuando el bloque está centrado o a la
  // derecha (izquierda = default, sin resaltar).
  state.align =
    editor.isActive({ textAlign: "center" }) || editor.isActive({ textAlign: "right" });
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
  else if (key === "align") {
    // Cicla izquierda → centro → derecha → izquierda.
    const cur = ALIGNMENTS.find((a) => editor.isActive({ textAlign: a })) || "left";
    const next = ALIGNMENTS[(ALIGNMENTS.indexOf(cur) + 1) % ALIGNMENTS.length];
    chain.setTextAlign(next);
  }
  chain.run();
}

// Elegir un color reemplaza el anterior; volver a elegir el mismo lo saca.
export function applyColor(editor, colorKey, currentKey) {
  const chain = editor.chain().focus();
  if (currentKey === colorKey) chain.unsetMark("tcolor");
  else chain.setMark("tcolor", { color: colorKey });
  chain.run();
}
