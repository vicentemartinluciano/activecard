// Editor estilo Notion — versión WEB: TipTap corre directo sobre react-dom,
// sin WebView (react-native-webview no existe en web). Mismas extensiones,
// mismos atajos y mismo markup de botones que el nativo — ambos salen de
// src/lib/editorSetup.js, así se ven y se comportan igual.

import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEffect, useRef } from "react";

import { EDITOR_CSS } from "../lib/editorCss";
import {
  activeStates,
  applyColor,
  buildExtensions,
  BUBBLE_BUTTONS,
  COLOR_BUTTON,
  COLOR_KEYS,
  EDITOR_TEXT_COLORS,
  handleImagePaste,
  IMAGE_BTN_SVG,
  insertImageFile,
  runBubbleAction,
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
    extensions: buildExtensions({ placeholder: placeholder || "", defaultAlign }),
    content: marksToHtml(value),
    onUpdate: ({ editor: ed }) => {
      const marcas = htmlToMarks(ed.getHTML());
      lastEmitted.current = marcas;
      onChangeText(marcas);
    },
  });

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

  if (!editor) return null;
  const state = activeStates(editor);

  const stop = (e) => {
    // Sin esto el botón le roba el foco al editor y se pierde la selección.
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      className={`nf-root${defaultAlign === "center" ? " nf-align-center" : ""}`}
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.sm,
        minHeight,
        overflow: "visible",
      }}
    >
      <BubbleMenu editor={editor} options={{ placement: "top", offset: 8 }}>
        <div className="nf-bubble">
          <div className="nf-row">
            {BUBBLE_BUTTONS.map((b) => (
              <button
                key={b.key}
                type="button"
                title={b.label}
                aria-label={b.label}
                className={`nf-btn${state[b.key] ? " is-active" : ""}`}
                onPointerDown={(e) => {
                  stop(e);
                  runBubbleAction(editor, b.key);
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
              onPointerDown={(e) => {
                stop(e);
                const row = e.currentTarget.closest(".nf-bubble").querySelector(".nf-swatches");
                row.classList.toggle("open");
              }}
              dangerouslySetInnerHTML={{ __html: COLOR_BUTTON.html }}
            />
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
                onPointerDown={(e) => {
                  stop(e);
                  applyColor(editor, key, state.colorKey);
                }}
              />
            ))}
          </div>
        </div>
      </BubbleMenu>
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
        }}
      />
      <button
        type="button"
        className="nf-imgbtn"
        title="Insertar imagen"
        aria-label="Insertar imagen"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        dangerouslySetInnerHTML={{ __html: IMAGE_BTN_SVG }}
      />
    </div>
  );
}
