// Editor estilo Notion — versión WEB: TipTap corre directo sobre react-dom,
// sin WebView (react-native-webview no existe en web). Mismas extensiones,
// mismos atajos y mismo markup de botones que el nativo — ambos salen de
// src/lib/editorSetup.js, así se ven y se comportan igual.

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useEffect, useRef } from "react";

import { attachEditorToolbar } from "../lib/editorToolbar";

import { EDITOR_CSS } from "../lib/editorCss";
import {
  activeStates,
  applyColor,
  applyFormat,
  buildExtensions,
  BUBBLE_BUTTONS,
  COLOR_BUTTON,
  COLOR_KEYS,
  currentImageWidth,
  EDITOR_TEXT_COLORS,
  FORMAT_BUTTON,
  FORMAT_OPTIONS,
  handleImagePaste,
  IMAGE_BTN_SVG,
  IMAGE_SIZES,
  insertImageFile,
  isImageSelected,
  runBubbleAction,
  setImageWidth,
  mountTableToolbar, insertTable, TABLE_BTN_SVG,
} from "../lib/editorSetup";
import { htmlToMarks, marksToHtml } from "../lib/richhtml";
import { colors, radius } from "../theme";

// El CSS del editor se inyecta una sola vez en el documento de la app.
let cssInjected = false;
function ensureCss() {
  if (cssInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.setAttribute("data-notion-field", "");
  style.textContent = EDITOR_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

export default function NotionField({
  value,
  onChangeText,
  placeholder,
  minHeight = 110,
  defaultAlign = "left",
}) {
  ensureCss();
  const lastEmitted = useRef(null);

  const editor = useEditor({
    extensions: buildExtensions({ placeholder: placeholder || "", defaultAlign, tableResizable: true }),
    content: marksToHtml(value),
    onUpdate: ({ editor: ed }) => {
      const marcas = htmlToMarks(ed.getHTML());
      lastEmitted.current = marcas;
      onChangeText(marcas);
    },
  });
  // TipTap 3 no vuelve a renderizar React por cada transacción. Suscribirse
  // explícitamente incluye selecciones nuevas sin modificar el documento.
  const toolbar = useEditorState({ editor, selector: ({ editor: ed }) => ed ? {
    image: isImageSelected(ed), width: currentImageWidth(ed), ...activeStates(ed),
  } : null });

  // Igual que en nativo: no re-inyectar el eco de lo que el editor emitió
  // (perdería el cursor mientras se escribe).
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmitted.current) return;
    editor.commands.setContent(marksToHtml(value), { emitUpdate: false });
  }, [value, editor]);

  // Pegar imágenes desde el portapapeles (además del botón de archivo).
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const onPaste = (e) => handleImagePaste(editor, e);
    dom.addEventListener("paste", onPaste);
    return () => dom.removeEventListener("paste", onPaste);
  }, [editor]);

  const fileInputRef = useRef(null);
  const tableToolbarRef = useRef(null);
  const bubbleRef = useRef(null);
  useEffect(() => {
    const input = fileInputRef.current;
    if (!input || !editor) return;
    const cancel = () => { tableToolbarRef.current?.classList.remove("nf-picking", "nf-inserting"); editor.commands.focus(); };
    input.addEventListener("cancel", cancel);
    return () => input.removeEventListener("cancel", cancel);
  }, [editor]);
  useEffect(() => {
    if (editor && tableToolbarRef.current) return mountTableToolbar(editor, tableToolbarRef.current);
  }, [editor]);

  useEffect(() => {
    if (editor && tableToolbarRef.current && bubbleRef.current) return attachEditorToolbar(editor, tableToolbarRef.current, bubbleRef.current);
  }, [editor]);

  if (!editor) return null;
  const imgSelected = toolbar?.image;
  const imgWidth = toolbar?.width || 100;
  const state = toolbar || {};

  const stop = (e) => {
    // Sin esto el botón le roba el foco al editor y se pierde la selección.
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      ref={tableToolbarRef}
      className={`nf-root${defaultAlign === "center" ? " nf-align-center" : ""}`}
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.sm,
        minHeight,
        overflow: "visible",
      }}
    >
        <div className="nf-bubble" ref={bubbleRef} role="toolbar" aria-label="Herramientas de texto">
          {imgSelected ? (
            <div className="nf-row">
              {IMAGE_SIZES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  title={s.label}
                  aria-label={s.label}
                  className={`nf-btn${imgWidth === s.pct ? " is-active" : ""}`}
                  onPointerDown={stop}
                  onClick={(e) => {
                    stop(e);
                    setImageWidth(editor, s.pct);
                  }}
                >
                  {s.html}
                </button>
              ))}
            </div>
          ) : (
            <>
          <div className="nf-row">
            <button
              type="button"
              title={FORMAT_BUTTON.label}
              aria-label={FORMAT_BUTTON.label}
              className={`nf-btn${state.formatKey !== "paragraph" ? " is-active" : ""}`}
              onPointerDown={stop}
                  onClick={(e) => {
                stop(e);
                const bubble = e.currentTarget.closest(".nf-bubble");
                bubble.querySelector(".nf-formats").classList.toggle("open");
                bubble.querySelector(".nf-swatches").classList.remove("open");
              }}
              dangerouslySetInnerHTML={{ __html: FORMAT_BUTTON.html }}
            />
            {BUBBLE_BUTTONS.map((b) => (
              <button
                key={b.key}
                type="button"
                title={b.label}
                aria-label={b.label}
                className={`nf-btn${state[b.key] ? " is-active" : ""}`}
                onPointerDown={stop}
                  onClick={(e) => {
                  stop(e);
                  runBubbleAction(editor, b.key);
                  e.currentTarget.closest(".nf-bubble").querySelector(".nf-formats").classList.remove("open");
                }}
                dangerouslySetInnerHTML={{ __html: b.html }}
              />
            ))}
            <div className="nf-sep" />
            <button
              type="button"
              title={COLOR_BUTTON.label}
              aria-label={COLOR_BUTTON.label}
              className={`nf-btn${state.colorKey ? " is-active" : ""}`}
              onPointerDown={stop}
                  onClick={(e) => {
                stop(e);
                const row = e.currentTarget.closest(".nf-bubble").querySelector(".nf-swatches");
                row.classList.toggle("open");
                e.currentTarget.closest(".nf-bubble").querySelector(".nf-formats").classList.remove("open");
              }}
              dangerouslySetInnerHTML={{ __html: COLOR_BUTTON.html }}
            />
            <button type="button" className="nf-btn" aria-label="Insertar" onPointerDown={stop}
                  onClick={(e) => {
              stop(e);
              const root = tableToolbarRef.current;
              root.classList.toggle("nf-inserting");
              e.currentTarget.closest(".nf-bubble").querySelectorAll(".nf-formats,.nf-swatches").forEach((panel) => panel.classList.remove("open"));
              root.dispatchEvent(new Event("nf:position-toolbar"));
            }}>+</button>
          </div>
          <div className="nf-row nf-formats">
            {FORMAT_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                title={option.label}
                aria-label={option.label}
                className={`nf-btn nf-format-btn${state.formatKey === option.key ? " is-active" : ""}`}
                onPointerDown={stop}
                  onClick={(e) => {
                  stop(e);
                  applyFormat(editor, option.key);
                  e.currentTarget.closest(".nf-formats").classList.remove("open");
                }}
              >
                {option.html}
              </button>
            ))}
          </div>
          <div className="nf-row nf-swatches">
            {COLOR_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                title={key}
                aria-label={key}
                className={`nf-swatch${state.colorKey === key ? " is-active" : ""}`}
                style={{ background: EDITOR_TEXT_COLORS[key] }}
                onPointerDown={stop}
                  onClick={(e) => {
                  stop(e);
                  applyColor(editor, key, state.colorKey);
                }}
              />
            ))}
          </div>
            </>
          )}
          <div className="nf-insert-menu" aria-label="Insertar contenido">
            <button type="button" className="nf-btn" aria-label="Insertar imagen" onPointerDown={stop}
                  onClick={(e) => { stop(e); tableToolbarRef.current.classList.add("nf-picking"); fileInputRef.current?.click(); }} dangerouslySetInnerHTML={{ __html: IMAGE_BTN_SVG + "<span>Imagen</span>" }} />
            <button type="button" className="nf-btn" aria-label="Insertar tabla" onPointerDown={stop}
                  onClick={(e) => { stop(e); insertTable(editor); tableToolbarRef.current.classList.remove("nf-inserting"); }} dangerouslySetInnerHTML={{ __html: TABLE_BTN_SVG + "<span>Tabla</span>" }} />
          </div>
        </div>
      <EditorContent editor={editor} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files && e.target.files[0];
          if (file) insertImageFile(editor, file);
          e.target.value = "";
          tableToolbarRef.current.classList.remove("nf-picking", "nf-inserting");
          editor.commands.focus();
        }}
      />
    </div>
  );
}
