// Entry del bundle que corre DENTRO del WebView (nativo). esbuild lo compila
// a un IIFE que se embebe en assets/editor/editorHtml.js (generado y
// commiteado → viaja por OTA, funciona sin conexión).
//
// Contrato con React Native (NotionField.js):
//   RN → web:  window.__editor.setContent(html) / setPlaceholder(t) / setMinHeight(px)
//   web → RN:  postMessage {type:"ready"} | {type:"change", html} | {type:"height", height}

import { Editor } from "@tiptap/core";
import { BubbleMenuPlugin } from "@tiptap/extension-bubble-menu";

import { EDITOR_BODY_CSS, EDITOR_CSS } from "../src/lib/editorCss";
import {
  activeStates,
  applyColor,
  buildExtensions,
  BUBBLE_BUTTONS,
  COLOR_BUTTON,
  COLOR_KEYS,
  currentImageWidth,
  EDITOR_TEXT_COLORS,
  handleImagePaste,
  IMAGE_BTN_SVG,
  IMAGE_SIZES,
  insertImageFile,
  isImageSelected,
  runBubbleAction,
  setImageWidth,
} from "../src/lib/editorSetup";

const post = (msg) => window.ReactNativeWebView?.postMessage(JSON.stringify(msg));

// --- estilos ---------------------------------------------------------------
const style = document.createElement("style");
style.textContent = EDITOR_BODY_CSS + EDITOR_CSS;
document.head.appendChild(style);

// --- DOM -------------------------------------------------------------------
const host = document.createElement("div");
host.className = window.__nfDefaultAlign === "center" ? "nf-root nf-align-center" : "nf-root";
document.body.appendChild(host);

// Botón + input para insertar imágenes desde el archivo (compresión por canvas
// adentro de la propia página del WebView, sin librería nativa).
const imgInput = document.createElement("input");
imgInput.type = "file";
imgInput.accept = "image/*";
imgInput.style.display = "none";
document.body.appendChild(imgInput);
imgInput.addEventListener("change", () => {
  const file = imgInput.files && imgInput.files[0];
  if (file) insertImageFile(editor, file);
  imgInput.value = "";
});

const imgBtn = document.createElement("button");
imgBtn.className = "nf-imgbtn";
imgBtn.type = "button";
imgBtn.title = "Insertar imagen";
imgBtn.setAttribute("aria-label", "Insertar imagen");
imgBtn.innerHTML = IMAGE_BTN_SVG;
imgBtn.addEventListener("click", () => imgInput.click());
host.appendChild(imgBtn);

const bubble = document.createElement("div");
bubble.className = "nf-bubble";
bubble.style.visibility = "hidden";
document.body.appendChild(bubble);

const row = document.createElement("div");
row.className = "nf-row";
bubble.appendChild(row);

const swatches = document.createElement("div");
swatches.className = "nf-row nf-swatches";
bubble.appendChild(swatches);

const buttons = {};
for (const def of [...BUBBLE_BUTTONS, COLOR_BUTTON]) {
  if (def.key === "color") {
    const sep = document.createElement("div");
    sep.className = "nf-sep";
    row.appendChild(sep);
  }
  const btn = document.createElement("button");
  btn.className = "nf-btn";
  btn.type = "button";
  btn.title = def.label;
  btn.setAttribute("aria-label", def.label);
  btn.innerHTML = def.html;
  // pointerdown + preventDefault: si no, el botón le roba el foco al editor
  // y se pierde la selección justo antes de aplicar la marca.
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (def.key === "color") swatches.classList.toggle("open");
    else {
      runBubbleAction(editor, def.key);
      swatches.classList.remove("open");
    }
  });
  row.appendChild(btn);
  buttons[def.key] = btn;
}

const swatchEls = {};
for (const key of COLOR_KEYS) {
  const sw = document.createElement("button");
  sw.className = "nf-swatch";
  sw.type = "button";
  sw.title = key;
  sw.setAttribute("aria-label", key);
  sw.style.background = EDITOR_TEXT_COLORS[key];
  sw.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    applyColor(editor, key, activeStates(editor).colorKey);
  });
  swatches.appendChild(sw);
  swatchEls[key] = sw;
}

// Fila de tamaños de imagen (visible solo con una imagen seleccionada).
const imgRow = document.createElement("div");
imgRow.className = "nf-row nf-imgrow";
bubble.appendChild(imgRow);
const sizeBtns = {};
for (const size of IMAGE_SIZES) {
  const b = document.createElement("button");
  b.className = "nf-btn";
  b.type = "button";
  b.title = size.label;
  b.setAttribute("aria-label", size.label);
  b.textContent = size.html;
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setImageWidth(editor, size.pct);
  });
  imgRow.appendChild(b);
  sizeBtns[size.pct] = b;
}

// --- editor ----------------------------------------------------------------
let lastHtml = "";

const editor = new Editor({
  element: host,
  extensions: buildExtensions({ placeholder: "", defaultAlign: window.__nfDefaultAlign || "left" }),
  content: "",
  autofocus: false,
  onUpdate: ({ editor: ed }) => {
    lastHtml = ed.getHTML();
    post({ type: "change", html: lastHtml });
  },
  onTransaction: () => {
    const imgSel = isImageSelected(editor);
    bubble.classList.toggle("img-mode", imgSel);
    if (imgSel) {
      const w = currentImageWidth(editor);
      for (const size of IMAGE_SIZES) {
        sizeBtns[size.pct].classList.toggle("is-active", size.pct === w);
      }
      return;
    }
    const state = activeStates(editor);
    for (const def of BUBBLE_BUTTONS) {
      buttons[def.key].classList.toggle("is-active", !!state[def.key]);
    }
    buttons.color.classList.toggle("is-active", !!state.colorKey);
    for (const key of COLOR_KEYS) {
      swatchEls[key].classList.toggle("is-active", state.colorKey === key);
    }
  },
});

editor.registerPlugin(
  BubbleMenuPlugin({
    editor,
    element: bubble,
    pluginKey: "nfBubble",
    options: { placement: "top", offset: 8 },
    shouldShow: ({ editor: ed, from, to }) => {
      const visible = from !== to && !ed.state.selection.empty;
      if (!visible) swatches.classList.remove("open");
      return visible;
    },
  })
);

// Pegar imágenes desde el portapapeles (además del botón de archivo).
editor.view.dom.addEventListener("paste", (e) => handleImagePaste(editor, e));

// --- alto dinámico ---------------------------------------------------------
let lastHeight = 0;
const reportHeight = () => {
  const height = Math.ceil(host.getBoundingClientRect().height);
  if (height && height !== lastHeight) {
    lastHeight = height;
    post({ type: "height", height });
  }
};
new ResizeObserver(() => requestAnimationFrame(reportHeight)).observe(host);

// --- API para React Native -------------------------------------------------
window.__editor = {
  setContent(html) {
    lastHtml = html;
    editor.commands.setContent(html, { emitUpdate: false });
    requestAnimationFrame(reportHeight);
  },
  setPlaceholder(text) {
    const ext = editor.extensionManager.extensions.find((e) => e.name === "placeholder");
    if (ext) {
      ext.options.placeholder = text;
      // Transacción vacía: fuerza recalcular las decoraciones del placeholder.
      editor.view.dispatch(editor.state.tr);
    }
  },
  setMinHeight(px) {
    host.style.minHeight = `${px}px`;
    requestAnimationFrame(reportHeight);
  },
  focus() {
    editor.commands.focus("end");
  },
};

post({ type: "ready" });
