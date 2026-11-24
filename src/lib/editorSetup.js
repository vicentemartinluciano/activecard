// Configuración compartida del editor Notion: la usan el bundle del WebView
// (nativo, editor-web/index.js) y el editor de la web (NotionField.web.js).
// Así las dos plataformas tienen exactamente las mismas marcas y atajos.

import { Extension, textInputRule, wrappingInputRule } from "@tiptap/core";
import { Blockquote } from "@tiptap/extension-blockquote";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { closeHistory } from "@tiptap/pm/history";
import { Highlight } from "@tiptap/extension-highlight";
import { Placeholder } from "@tiptap/extensions";
import { StarterKit } from "@tiptap/starter-kit";
import { Table, TableView, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import katex from "katex";

import { attachEditorTableControls } from "./editorTableControls";
import { clipboardToEditorHtml, endsWithDisplayMathParagraph } from "./editorPaste";
import { positionEditorPanel } from "./editorGeometry";
import { matchMathAt, splitMathSegments } from "./mathLatex";

import { compressFile } from "./imageCompress";
import { Image } from "./tiptapImage";
import { EDITOR_TEXT_COLORS, TColor } from "./tiptapTColor";
import { ALIGNMENTS, TextAlign } from "./tiptapTextAlign";
import { Toggle, ToggleContent, ToggleSummary, toggleSummaryDepth } from "./tiptapToggle";

// Atajos de tipeo propios. "->" se transforma en la flecha → (el conector de
// las tarjetas). Los otros ya vienen de StarterKit: "---" = divisor,
// "- " = viñeta, "1. " = lista numerada.
const Shortcuts = Extension.create({
  name: "activecardShortcuts",
  addStorage() {
    return { pointerSelecting: false };
  },
  addInputRules() {
    return [textInputRule({ find: /->$/, replace: "→" })];
  },
  addKeyboardShortcuts() {
    return {
      "Mod-Alt-f": () => {
        if (!hasCopiedFormat()) return Boolean(copyFormatFromEditor(this.editor));
        if (isSameCopyOrigin(this.editor)) {
          setCopiedFormat(null);
          this.editor.view.dispatch(
            this.editor.state.tr.setMeta("nfFormatPainter", true).setMeta("addToHistory", false)
          );
          return true;
        }
        return pasteFormatToEditor(this.editor);
      },
      "Mod-Alt-c": () => Boolean(copyFormatFromEditor(this.editor)),
      "Mod-Alt-v": () => pasteFormatToEditor(this.editor),
    };
  },
  onSelectionUpdate({ editor, transaction }) {
    if (
      !this.storage.pointerSelecting &&
      hasCopiedFormat() &&
      !editor.state.selection.empty &&
      !transaction.getMeta("nfFormatPainter") &&
      !isSameCopyOrigin(editor)
    ) {
      pasteFormatToEditor(editor);
    }
  },
  addProseMirrorPlugins() {
    const storage = this.storage;
    const editor = this.editor;
    const finishPointerSelection = () => {
      if (!storage.pointerSelecting) return;
      storage.pointerSelecting = false;
      if (
        hasCopiedFormat() &&
        !editor.isDestroyed &&
        !editor.state.selection.empty &&
        !isSameCopyOrigin(editor)
      ) {
        pasteFormatToEditor(editor);
      }
    };
    const cancelPointerSelection = () => {
      storage.pointerSelecting = false;
    };
    return [
      new Plugin({
        view() {
          if (typeof document === "undefined") return {};
          document.addEventListener("pointerup", finishPointerSelection);
          document.addEventListener("mouseup", finishPointerSelection);
          document.addEventListener("touchend", finishPointerSelection);
          document.addEventListener("pointercancel", cancelPointerSelection);
          document.addEventListener("touchcancel", cancelPointerSelection);
          return {
            destroy() {
              document.removeEventListener("pointerup", finishPointerSelection);
              document.removeEventListener("mouseup", finishPointerSelection);
              document.removeEventListener("touchend", finishPointerSelection);
              document.removeEventListener("pointercancel", cancelPointerSelection);
              document.removeEventListener("touchcancel", cancelPointerSelection);
            },
          };
        },
        props: {
          handleDOMEvents: {
            pointerdown: () => { storage.pointerSelecting = true; return false; },
            mousedown: () => { storage.pointerSelecting = true; return false; },
            touchstart: () => { storage.pointerSelecting = true; return false; },
            pointerup: () => { finishPointerSelection(); return false; },
            mouseup: () => { finishPointerSelection(); return false; },
            touchend: () => { finishPointerSelection(); return false; },
            pointercancel: () => { cancelPointerSelection(); return false; },
            touchcancel: () => { cancelPointerSelection(); return false; },
            beforeinput: (_view, event) => {
              if (event.inputType !== "insertLineBreak" || event.isComposing || !event.cancelable) return false;
              if (!editor.commands.setHardBreak()) return false;
              event.preventDefault();
              return true;
            },
          },
        },
      }),
    ];
  },
});

const WritingQuote = Blockquote.extend({
  addInputRules() { return [wrappingInputRule({ find: /^"\s$/, type: this.type })]; },
});

// La normalización HTML no debe quitar espacios del texto al reabrir una cara.
// Solo los bloques de texto preservan espacios; la estructura entre bloques
// sigue pasando por el parser normal.
const WritingStarterKit = StarterKit.extend({
  addExtensions() {
    return this.parent().map(extension => ["paragraph", "heading"].includes(extension.name)
      ? extension.extend({ whitespace: "pre" }) : extension);
  },
});

const mathLiveKey = new PluginKey("activecardMathLive");

function renderMathDecorationHtml(latex, display) {
  try {
    return katex.renderToString(latex || "", {
      displayMode: display,
      output: "mathml",
      throwOnError: false,
      strict: "ignore",
    });
  } catch {
    return "";
  }
}

function collectTextRuns(textblock, blockStartPos) {
  const runs = [];
  let text = "";
  let runStart = null;
  let offset = 0;

  const flush = () => {
    if (text && runStart != null) {
      runs.push({ text, docPos: runStart });
    }
    text = "";
    runStart = null;
  };

  textblock.forEach((child) => {
    if (child.isText) {
      if (runStart == null) runStart = blockStartPos + offset;
      text += child.text;
    } else {
      flush();
    }
    offset += child.nodeSize;
  });
  flush();
  return runs;
}

function collectMathEntries(doc) {
  const entries = [];
  const consumedParagraphPositions = new Set();

  const scanMultilineContainer = (container, contentStartPos) => {
    const children = [];
    let offset = 0;
    container.forEach((child) => {
      children.push({ node: child, pos: contentStartPos + offset });
      offset += child.nodeSize;
    });

    let i = 0;
    while (i < children.length) {
      const startItem = children[i];
      if (startItem.node.type.name !== "paragraph") {
        i += 1;
        continue;
      }
      const trimmed = startItem.node.textContent.trim();
      const opensMultiline =
        (trimmed.startsWith("$$") || trimmed.startsWith("\\[")) && !matchMathAt(trimmed, 0);
      if (!opensMultiline) {
        i += 1;
        continue;
      }

      let closeIdx = -1;
      let matched = null;
      const maxEnd = Math.min(children.length, i + 40);
      for (let j = i + 1; j < maxEnd; j += 1) {
        if (children[j].node.type.name !== "paragraph") break;
        const combined = children
          .slice(i, j + 1)
          .map((item) => item.node.textContent)
          .join("\n")
          .trim();
        const cand = matchMathAt(combined, 0);
        if (cand && cand.display && cand.end === combined.length) {
          closeIdx = j;
          matched = cand;
          break;
        }
      }

      if (closeIdx !== -1 && matched) {
        const groupItems = children.slice(i, closeIdx + 1);
        const first = groupItems[0];
        const last = groupItems[groupItems.length - 1];
        for (const item of groupItems) consumedParagraphPositions.add(item.pos);
        entries.push({
          from: first.pos + 1,
          to: last.pos + last.node.nodeSize - 1,
          latex: matched.latex,
          raw: matched.raw,
          display: true,
          isMultiline: true,
          firstSize: first.node.content.size,
          secondaryItems: groupItems.slice(1),
        });
        i = closeIdx + 1;
        continue;
      }
      i += 1;
    }
  };

  scanMultilineContainer(doc, 0);

  doc.descendants((node, pos) => {
    if (!node.isTextblock) {
      if (node.childCount > 0) scanMultilineContainer(node, pos + 1);
      return true;
    }
    if (consumedParagraphPositions.has(pos)) return false;

    const blockStart = pos + 1;
    const runs = collectTextRuns(node, blockStart);
    for (const run of runs) {
      const segments = splitMathSegments(run.text);
      for (const seg of segments) {
        if (seg.type !== "math") continue;
        entries.push({
          from: run.docPos + seg.from,
          to: run.docPos + seg.to,
          latex: seg.latex,
          raw: seg.raw,
          display: seg.display,
          isMultiline: false,
        });
      }
    }
    return false;
  });

  return entries;
}

const mathControllers = new WeakMap();

const MathLivePreview = Extension.create({
  name: "mathLivePreview",
  addKeyboardShortcuts() {
    const deleteMathAtomic = (from, to) => {
      const editor = this.editor;
      const ctrl = mathControllers.get(editor);
      if (ctrl?.isOpen()) ctrl.close({ focusEditor: false });
      return editor
        .chain()
        .focus()
        .command(({ tr }) => {
          closeHistory(tr);
          tr.delete(from, to);
          closeHistory(tr);
          return true;
        })
        .run();
    };

    return {
      Escape: () => {
        const ctrl = mathControllers.get(this.editor);
        if (ctrl?.isOpen()) {
          ctrl.close({ focusEditor: true });
          return true;
        }
        return false;
      },
      ArrowLeft: () => {
        const { selection, doc } = this.editor.state;
        if (!selection.empty) return false;
        const pos = selection.from;
        const hit = collectMathEntries(doc).find((entry) => pos > entry.from && pos <= entry.to);
        if (!hit) return false;
        this.editor.view.dispatch(
          this.editor.state.tr.setSelection(TextSelection.create(doc, hit.from)).scrollIntoView()
        );
        return true;
      },
      ArrowRight: () => {
        const { selection, doc } = this.editor.state;
        if (!selection.empty) return false;
        const pos = selection.from;
        const hit = collectMathEntries(doc).find((entry) => pos >= entry.from && pos < entry.to);
        if (!hit) return false;
        this.editor.view.dispatch(
          this.editor.state.tr.setSelection(TextSelection.create(doc, hit.to)).scrollIntoView()
        );
        return true;
      },
      Backspace: () => {
        const { selection, doc } = this.editor.state;
        if (!selection.empty) return false;
        const pos = selection.from;
        const hit = collectMathEntries(doc).find((entry) => pos > entry.from && pos <= entry.to);
        if (!hit) return false;
        return deleteMathAtomic(hit.from, hit.to);
      },
      Delete: () => {
        const { selection, doc } = this.editor.state;
        if (!selection.empty) return false;
        const pos = selection.from;
        const hit = collectMathEntries(doc).find((entry) => pos >= entry.from && pos < entry.to);
        if (!hit) return false;
        return deleteMathAtomic(hit.from, hit.to);
      },
    };
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: mathLiveKey,
        state: {
          init: () => ({ activeMath: null }),
          apply(tr, value) {
            const meta = tr.getMeta(mathLiveKey);
            if (meta !== undefined) return { activeMath: meta };
            if (value.activeMath && tr.docChanged) {
              return { activeMath: null };
            }
            return value;
          },
        },
        view(view) {
          if (typeof document === "undefined") return {};
          const host = view.dom.closest?.(".nf-root") || view.dom.parentElement;
          if (!host) return {};

          const popover = document.createElement("div");
          popover.className = "nf-math-popover";
          popover.setAttribute("role", "dialog");
          popover.setAttribute("aria-label", "Editar fórmula");
          popover.hidden = true;

          const preview = document.createElement("div");
          preview.className = "nf-math-popover-preview";

          const input = document.createElement("textarea");
          input.className = "nf-math-popover-input";
          input.rows = 2;
          input.spellcheck = false;
          input.autocomplete = "off";
          input.setAttribute("autocapitalize", "off");
          input.placeholder = "Escribí la fórmula en LaTeX...";
          input.setAttribute("aria-label", "Código LaTeX de la fórmula");

          const actions = document.createElement("div");
          actions.className = "nf-math-popover-actions";

          const delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "nf-math-popover-btn nf-math-popover-delete";
          delBtn.textContent = "Eliminar";

          const doneBtn = document.createElement("button");
          doneBtn.type = "button";
          doneBtn.className = "nf-math-popover-btn nf-math-popover-done";
          doneBtn.textContent = "Listo";

          actions.append(delBtn, doneBtn);
          popover.append(preview, input, actions);
          host.appendChild(popover);

          let current = null;
          let currentAnchor = null;

          const updatePreview = (raw, display) => {
            const cleaned = String(raw || "").trim();
            if (!cleaned) {
              preview.innerHTML = '<span class="nf-math-popover-empty">Fórmula vacía</span>';
              return;
            }
            preview.innerHTML = renderMathDecorationHtml(cleaned, display) || "";
          };

          const positionPopover = () => {
            if (!current || popover.hidden || !host.isConnected) return;
            const anchorEl =
              currentAnchor && currentAnchor.isConnected
                ? currentAnchor
                : host.querySelector(".nf-math-widget.is-editing");
            const root = host.getBoundingClientRect();
            const anchor = anchorEl?.getBoundingClientRect?.() || view.coordsAtPos(current.from);
            const maxWidth = Math.max(220, Math.min(360, (root.width || 320) - 16));
            popover.style.width = `${maxWidth}px`;
            const left = Math.min(
              Math.max(8, (anchor.left + anchor.right) / 2 - root.left - maxWidth / 2),
              Math.max(8, (root.width || maxWidth + 16) - maxWidth - 8)
            );
            popover.style.left = `${left}px`;
            const coarse = !!window.matchMedia?.("(pointer: coarse)")?.matches;
            positionEditorPanel(host, popover, anchor, false, coarse ? 12 : 8);
          };

          const close = ({ focusEditor = false } = {}) => {
            if (!current && popover.hidden) return;
            current = null;
            currentAnchor = null;
            popover.hidden = true;
            host.classList.remove("nf-math-editing");
            if (!editor.isDestroyed) {
              view.dispatch(view.state.tr.setMeta(mathLiveKey, null).setMeta("addToHistory", false));
              if (focusEditor) editor.commands.focus();
            }
            host.dispatchEvent(new Event("nf:layout"));
          };

          const open = (entry, anchorEl) => {
            if (!editor.isEditable) return;
            if (current && current.from === entry.from && current.to === entry.to) {
              close({ focusEditor: true });
              return;
            }
            if (current) {
              commit({ focusEditor: false });
            }
            const refreshed =
              collectMathEntries(editor.state.doc).find(
                (item) => item.latex === entry.latex && item.display === entry.display && item.from === entry.from
              ) || entry;
            current = { ...refreshed };
            currentAnchor = anchorEl;
            input.value = refreshed.latex || "";
            updatePreview(input.value, refreshed.display);
            host.classList.add("nf-math-editing");
            host.dispatchEvent(new Event("nf:dismiss-controls"));
            popover.hidden = false;
            view.dispatch(
              view.state.tr
                .setMeta(mathLiveKey, { from: refreshed.from, to: refreshed.to })
                .setMeta("addToHistory", false)
            );
            positionPopover();
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
            host.dispatchEvent(new Event("nf:layout"));
          };

          const commit = ({ focusEditor = true } = {}) => {
            if (!current) return;
            const snapshot = current;
            const normalizedInput = input.value.replace(/\r\n?/g, "\n").replace(/\s*\n+\s*/g, " ").trim();
            const normalizedOrig = (snapshot.latex || "").replace(/\r\n?/g, "\n").replace(/\s*\n+\s*/g, " ").trim();
            const docSize = editor.state.doc.content.size;
            const validRange = snapshot.from >= 0 && snapshot.to <= docSize && snapshot.from <= snapshot.to;

            current = null;
            currentAnchor = null;
            popover.hidden = true;
            host.classList.remove("nf-math-editing");

            if (validRange && !normalizedInput) {
              const chain = editor
                .chain()
                .command(({ tr }) => {
                  closeHistory(tr);
                  tr.delete(snapshot.from, snapshot.to);
                  closeHistory(tr);
                  return true;
                })
                .command(({ tr }) => {
                  tr.setMeta(mathLiveKey, null);
                  return true;
                });
              if (focusEditor) chain.focus();
              chain.run();
            } else if (validRange && normalizedInput !== normalizedOrig) {
              const replacement = snapshot.display ? `$$${normalizedInput}$$` : `$${normalizedInput}$`;
              const afterPos = snapshot.from + replacement.length;
              const chain = editor
                .chain()
                .command(({ tr }) => {
                  closeHistory(tr);
                  tr.insertText(replacement, snapshot.from, snapshot.to);
                  const clamped = Math.min(afterPos, tr.doc.content.size);
                  tr.setSelection(TextSelection.create(tr.doc, clamped));
                  closeHistory(tr);
                  tr.setMeta(mathLiveKey, null);
                  return true;
                });
              if (focusEditor) chain.focus();
              chain.run();
            } else if (!editor.isDestroyed) {
              view.dispatch(view.state.tr.setMeta(mathLiveKey, null).setMeta("addToHistory", false));
              if (focusEditor) editor.commands.focus();
            }
            host.dispatchEvent(new Event("nf:layout"));
          };

          const removeFormula = () => {
            if (!current) return;
            const snapshot = current;
            const docSize = editor.state.doc.content.size;
            const validRange = snapshot.from >= 0 && snapshot.to <= docSize && snapshot.from <= snapshot.to;
            current = null;
            currentAnchor = null;
            popover.hidden = true;
            host.classList.remove("nf-math-editing");
            if (validRange) {
              editor
                .chain()
                .focus()
                .command(({ tr }) => {
                  closeHistory(tr);
                  tr.delete(snapshot.from, snapshot.to);
                  closeHistory(tr);
                  tr.setMeta(mathLiveKey, null);
                  return true;
                })
                .run();
            } else {
              view.dispatch(view.state.tr.setMeta(mathLiveKey, null).setMeta("addToHistory", false));
              editor.commands.focus();
            }
            host.dispatchEvent(new Event("nf:layout"));
          };

          const controller = {
            open,
            close,
            commit,
            isOpen: () => Boolean(current),
          };
          mathControllers.set(editor, controller);

          input.addEventListener("input", () => {
            if (!current) return;
            updatePreview(input.value, current.display);
            positionPopover();
            host.dispatchEvent(new Event("nf:layout"));
          });

          input.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close({ focusEditor: true });
            } else if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.stopPropagation();
              commit({ focusEditor: true });
            }
          });

          doneBtn.addEventListener("pointerdown", (event) => event.preventDefault());
          doneBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            commit({ focusEditor: true });
          });

          delBtn.addEventListener("pointerdown", (event) => event.preventDefault());
          delBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            removeFormula();
          });

          const onOutsidePointer = (event) => {
            if (!current || popover.contains(event.target)) return;
            if (event.target.closest?.(".nf-math-widget")) return;
            commit({ focusEditor: false });
          };
          const onViewport = () => positionPopover();
          document.addEventListener("pointerdown", onOutsidePointer, true);
          window.addEventListener("resize", onViewport);
          window.addEventListener("scroll", onViewport, true);
          window.visualViewport?.addEventListener("resize", onViewport);
          host.addEventListener("nf:viewport", onViewport);

          return {
            update(nextView, prevState) {
              if (!current) return;
              if (nextView.state.doc !== prevState.doc && !mathLiveKey.getState(nextView.state)?.activeMath) {
                current = null;
                currentAnchor = null;
                popover.hidden = true;
                host.classList.remove("nf-math-editing");
                host.dispatchEvent(new Event("nf:layout"));
              }
            },
            destroy() {
              mathControllers.delete(editor);
              document.removeEventListener("pointerdown", onOutsidePointer, true);
              window.removeEventListener("resize", onViewport);
              window.removeEventListener("scroll", onViewport, true);
              window.visualViewport?.removeEventListener("resize", onViewport);
              host.removeEventListener("nf:viewport", onViewport);
              popover.remove();
            },
          };
        },
        props: {
          handleDOMEvents: {
            beforeinput: (_view, event) => {
              if (event.inputType !== "deleteContentBackward" || event.isComposing || !event.cancelable) {
                return false;
              }
              const { selection, doc } = editor.state;
              if (!selection.empty) return false;
              const pos = selection.from;
              const hit = collectMathEntries(doc).find((entry) => pos > entry.from && pos <= entry.to);
              if (!hit) return false;
              event.preventDefault();
              return editor
                .chain()
                .focus()
                .command(({ tr }) => {
                  closeHistory(tr);
                  tr.delete(hit.from, hit.to);
                  closeHistory(tr);
                  return true;
                })
                .run();
            },
          },
          decorations(state) {
            const activeMath = mathLiveKey.getState(state)?.activeMath;
            const entries = collectMathEntries(state.doc);
            const decorations = [];

            for (const entry of entries) {
              const html = renderMathDecorationHtml(entry.latex, entry.display);
              if (!html) continue;
              const editing = Boolean(activeMath && activeMath.from === entry.from && activeMath.to === entry.to);
              if (entry.isMultiline) {
                if (entry.firstSize > 0) {
                  decorations.push(
                    Decoration.inline(entry.from, entry.from + entry.firstSize, {
                      class: "nf-math-hidden-src",
                      "aria-hidden": "true",
                    })
                  );
                }
                for (const item of entry.secondaryItems) {
                  decorations.push(
                    Decoration.node(item.pos, item.pos + item.node.nodeSize, {
                      class: "nf-math-hidden-line",
                      "aria-hidden": "true",
                    })
                  );
                }
              } else {
                decorations.push(
                  Decoration.inline(entry.from, entry.to, {
                    class: "nf-math-hidden-src",
                    "aria-hidden": "true",
                  })
                );
              }
              decorations.push(
                Decoration.widget(
                  entry.from,
                  () => {
                    const el = document.createElement("span");
                    el.className = `${entry.display ? "nf-math-widget nf-math-block" : "nf-math-widget nf-math-inline"}${editing ? " is-editing" : ""}`;
                    el.contentEditable = "false";
                    el.innerHTML = html;
                    el.addEventListener("mousedown", (event) => {
                      event.preventDefault();
                    });
                    el.addEventListener("click", (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      mathControllers.get(editor)?.open(entry, el);
                    });
                    return el;
                  },
                  { side: -1, key: `${entry.from}:${entry.to}:${entry.raw}:${editing ? "1" : "0"}` }
                )
              );
            }

            return decorations.length ? DecorationSet.create(state.doc, decorations) : DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

const RichClipboard = Extension.create({
  name: "activecardRichClipboard",
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        props: {
          handlePaste(_view, event) {
            if (!event.clipboardData || event.defaultPrevented) return false;
            const payload = clipboardToEditorHtml(event.clipboardData);
            if (!payload) return false;
            if (payload.kind === "image") {
              event.preventDefault();
              insertImageFile(editor, payload.file);
              return true;
            }
            if (payload.kind === "html") {
              const atDocEnd = editor.state.selection.to >= editor.state.doc.content.size - 1;
              const html =
                atDocEnd && endsWithDisplayMathParagraph(payload.html)
                  ? `${payload.html}<p></p>`
                  : payload.html;
              editor.commands.command(({ tr }) => {
                closeHistory(tr);
                return true;
              });
              const inserted = editor.commands.insertContent(html);
              if (inserted) {
                editor.commands.command(({ tr }) => {
                  closeHistory(tr);
                  return true;
                });
                event.preventDefault();
              }
              return inserted;
            }
            return false;
          },
        },
      }),
    ];
  },
});

// En celular el ancho es de presentación: no modificar los colwidth guardados
// en escritorio al ampliar columnas pequeñas para lectura y scroll lateral.
function readableColumns(node, minWidth) {
  const widths = [];
  node.firstChild?.forEach((cell) => {
    for (let index = 0; index < cell.attrs.colspan; index++)
      widths.push(Math.max(minWidth, cell.attrs.colwidth?.[index] || 0));
  });
  return widths;
}

class ReadableTableView extends TableView {
  constructor(...args) {
    super(...args);
    this.fitColumns();
  }

  update(node) {
    const updated = super.update(node);
    if (updated) this.fitColumns();
    return updated;
  }

  fitColumns() {
    const widths = readableColumns(this.node, this.cellMinWidth);
    Array.from(this.colgroup.children).forEach((col, index) => {
      col.style.width = `${widths[index]}px`;
    });
    this.table.style.width = `${widths.reduce((sum, width) => sum + width, 0)}px`;
    this.table.style.minWidth = "100%";
  }
}

const ReadableTable = Table.extend({
  renderHTML(props) {
    const output = Table.config.renderHTML.call(this, props);
    if (this.options.resizable) return output;
    const table = this.options.renderWrapper ? output[2] : output;
    const cols = table[2].slice(2);
    const widths = readableColumns(props.node, this.options.cellMinWidth);
    widths.forEach((size, index) => {
      cols[index][1].style = `width: ${size}px`;
    });
    const width = widths.reduce((sum, size) => sum + size, 0);
    table[1].style = `width: ${width}px; min-width: 100%`;
    return output;
  },
});

export function buildExtensions({ placeholder = "", defaultAlign = "left", tableResizable = false } = {}) {
  return [
    WritingStarterKit.configure({
      // Fuera lo que el formato de ActiveCard no sabe representar.
      heading: { levels: [1, 2, 3] },
      blockquote: false,
      code: false,
      codeBlock: false,
      strike: {},
      link: false,
      hardBreak: {},
      // Permite salir de una tabla al párrafo siguiente también con teclado móvil.
      trailingNode: {},
      // Quedan también los atajos tipo Notion: # / ## / ### para títulos,
      // > para desplegable, " para cita, ~~ tachado, --- divisor, - viñeta y 1. numerada.
    }),
    WritingQuote,
    Highlight,
    Toggle, ToggleSummary, ToggleContent,
    ReadableTable.configure({ renderWrapper: true, cellMinWidth: tableResizable ? 80 : 200,
      resizable: tableResizable, View: tableResizable ? TableView : ReadableTableView }),
    TableRow,
    TableCell.extend({ content: "(paragraph | heading | bulletList | orderedList | blockquote | horizontalRule | image | toggle)+" }),
    TableHeader.extend({ content: "(paragraph | heading | bulletList | orderedList | blockquote | horizontalRule | image | toggle)+" }),
    TColor,
    TextAlign.configure({ types: ["paragraph", "heading", "blockquote"], defaultAlignment: defaultAlign }),
    Image,
    Placeholder.configure({ placeholder }),
    RichClipboard,
    MathLivePreview,
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
  if (!event || event.defaultPrevented) return false;
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

// Barrita flotante: conserva lo esencial y suma UN selector de formato de
// bloque. Los atajos siguen funcionando aunque el usuario no abra el selector.
const HIGHLIGHTER_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>`;
// Ícono de alineación (un botón que cicla izquierda → centro → derecha).
const ALIGN_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="17" y1="12" x2="7" y2="12"/><line x1="19" y1="18" x2="5" y2="18"/></svg>`;
export const PAINTBRUSH_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.37 2.63a2.12 2.12 0 0 1 3 3L14 13l-4 1 1-4Z"/><path d="M9 14c-2.5 1-4 3.5-4 6 2.5 0 5-1.5 6-4"/></svg>`;
export const CLEAR_FORMAT_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M5 20h6"/><path d="M13 4 8 20"/><path d="m15 15 5 5"/><path d="m20 15-5 5"/></svg>`;
export const OUTDENT_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 6H11"/><path d="M21 12H11"/><path d="M21 18H11"/><path d="m7 8-4 4 4 4"/></svg>`;
export const INDENT_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 6H11"/><path d="M21 12H11"/><path d="M21 18H11"/><path d="m3 8 4 4-4 4"/></svg>`;
export const PLUS_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`;

const CHEVRON_SVG = `<svg class="nf-chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 4.5 3 3 3-3"/></svg>`;
const FORMAT_BADGES = {
  paragraph: "¶",
  heading1: "H1",
  heading2: "H2",
  heading3: "H3",
  quote: "❝",
  bulletList: "•",
  orderedList: "1.",
  mixed: "¶",
};

export function formatButtonHtml({ formatKey = "paragraph", toggleActive = false } = {}) {
  const badge = toggleActive && formatKey === "paragraph"
    ? "▸"
    : FORMAT_BADGES[formatKey] || FORMAT_BADGES.paragraph;
  return `<span style="font-size:13px;font-weight:700;line-height:1">${badge}</span>${CHEVRON_SVG}`;
}

export const FORMAT_BUTTON = {
  key: "format",
  label: "Cambiar formato",
  html: formatButtonHtml(),
};

export const FORMAT_OPTIONS = [
  { key: "paragraph", label: "Texto", html: "P" },
  { key: "heading1", label: "Título 1", html: "H1" },
  { key: "heading2", label: "Título 2", html: "H2" },
  { key: "heading3", label: "Título 3", html: "H3" },
  { key: "quote", label: "Cita", html: "❝" },
  { key: "bulletList", label: "Viñetas", html: "•" },
  { key: "orderedList", label: "Lista numerada", html: "1." },
  { key: "toggle", label: "Desplegable", html: "▸ Desplegable" },
];

export const BUBBLE_BUTTONS = [
  { key: "bold", label: "Negrita", html: '<b style="font-size:15px">B</b>' },
  { key: "italic", label: "Cursiva", html: '<i style="font-family:Georgia,serif;font-size:15px">I</i>' },
  { key: "underline", label: "Subrayado", html: '<u style="font-size:15px">U</u>' },
  { key: "strike", label: "Tachado", html: '<s style="font-size:15px">S</s>' },
  { key: "highlight", label: "Resaltado", html: HIGHLIGHTER_SVG },
  { key: "align", label: "Alineación", html: ALIGN_SVG },
];

export const STRUCTURE_BUTTONS = [
  { key: "copyFormat", label: "Copiar formato", html: PAINTBRUSH_SVG },
  { key: "clear", label: "Quitar estilos del texto", html: CLEAR_FORMAT_SVG },
  { key: "outdent", label: "Reducir sangría", html: OUTDENT_SVG },
  { key: "indent", label: "Aumentar sangría", html: INDENT_SVG },
];
export function canStructureAction(editor, key) {
  if (key === "copyFormat") return !isImageSelected(editor);
  if (toggleSummaryDepth(editor.state.selection.$from) != null) {
    if (key === "indent") return editor.can().indentToggle();
    if (key === "outdent") return editor.can().outdentToggle();
  }
  if (key === "indent") return editor.can().sinkListItem("listItem");
  if (key === "outdent") return editor.can().liftListItem("listItem");
  return true;
}

let copiedFormatState = null;
let copiedSelectionOrigin = null;
const formatListeners = new Set();

function isSameCopyOrigin(editor) {
  return Boolean(
    copiedSelectionOrigin &&
      copiedSelectionOrigin.editor === editor &&
      copiedSelectionOrigin.doc === editor.state.doc &&
      copiedSelectionOrigin.from === editor.state.selection.from &&
      copiedSelectionOrigin.to === editor.state.selection.to
  );
}

export function getCopiedFormat() {
  return copiedFormatState;
}

export function hasCopiedFormat() {
  return Boolean(copiedFormatState);
}

export function setCopiedFormat(format, { notify = true, origin = null } = {}) {
  copiedFormatState = format ? { ...format } : null;
  copiedSelectionOrigin = format ? origin : null;
  if (notify) {
    for (const listener of formatListeners) {
      listener(copiedFormatState);
    }
  }
}

export function subscribeCopiedFormat(listener) {
  formatListeners.add(listener);
  return () => formatListeners.delete(listener);
}

function hasAncestor($pos, name) {
  for (let depth = $pos.depth; depth > 0; depth--) {
    if ($pos.node(depth).type.name === name) return true;
  }
  return false;
}

export function copyFormatFromEditor(editor, { toggle = false } = {}) {
  if (!editor || isImageSelected(editor)) return null;
  if (toggle && copiedFormatState && isSameCopyOrigin(editor)) {
    setCopiedFormat(null);
    editor.view.dispatch(editor.state.tr.setMeta("nfFormatPainter", true).setMeta("addToHistory", false));
    return null;
  }
  const { from, to, empty, $from, $to } = editor.state.selection;
  let marks = null;
  if (!empty) {
    let nonBlankMarks = null;
    let fallbackMarks = null;
    editor.state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isText) return;
      const startInNode = Math.max(0, from - pos);
      const endInNode = Math.min(node.text.length, to - pos);
      if (endInNode <= startInNode) return;
      if (!fallbackMarks) fallbackMarks = node.marks;
      if (node.text.slice(startInNode, endInNode).trim().length > 0) {
        nonBlankMarks = node.marks;
        return false;
      }
    });
    marks = nonBlankMarks || fallbackMarks || $from.marks();
  } else {
    marks = editor.state.storedMarks || $from.marks();
  }

  const bold = marks.some((m) => m.type.name === "bold");
  const italic = marks.some((m) => m.type.name === "italic");
  const underline = marks.some((m) => m.type.name === "underline");
  const strike = marks.some((m) => m.type.name === "strike");
  const highlight = marks.some((m) => m.type.name === "highlight");
  const colorKey = marks.find((m) => m.type.name === "tcolor")?.attrs?.color || null;

  let formatKey = "paragraph";
  if ($from.parent.type.name === "heading") {
    formatKey = `heading${$from.parent.attrs.level}`;
  } else {
    for (let depth = $from.depth - 1; depth > 0; depth--) {
      const name = $from.node(depth).type.name;
      if (name === "blockquote") {
        formatKey = "quote";
        break;
      }
      if (name === "bulletList") {
        formatKey = "bulletList";
        break;
      }
      if (name === "orderedList") {
        formatKey = "orderedList";
        break;
      }
    }
  }

  const defaultAlign =
    editor.extensionManager.extensions.find((extension) => extension.name === "textAlign")?.options.defaultAlignment ||
    "left";
  const quoteAlign = editor.getAttributes("blockquote").textAlign;
  const parentAlign = $from.parent.attrs?.textAlign;
  const rawAlign = quoteAlign && quoteAlign !== defaultAlign ? quoteAlign : parentAlign;
  const textAlign = rawAlign && rawAlign !== defaultAlign ? rawAlign : null;

  const selectedText = empty ? "" : editor.state.doc.textBetween(from, to, "\n", "\0");
  const parentText = $from.parent.isTextblock ? $from.parent.textContent : "";
  const fullBlock =
    empty ||
    !$from.sameParent($to) ||
    ($from.parent.isTextblock && selectedText.trim().length > 0 && selectedText.trim() === parentText.trim());
  const hasInlineMarks = Boolean(bold || italic || underline || strike || highlight || colorKey);

  const snapshot = {
    bold,
    italic,
    underline,
    strike,
    highlight,
    colorKey,
    formatKey,
    textAlign,
    fullBlock,
    hasInlineMarks,
  };
  setCopiedFormat(snapshot, { origin: { editor, doc: editor.state.doc, from, to } });
  editor.view.dispatch(editor.state.tr.setMeta("nfFormatPainter", true).setMeta("addToHistory", false));
  return snapshot;
}

export function pasteFormatToEditor(editor, format = copiedFormatState, { disarm = true } = {}) {
  if (!editor || !format || isImageSelected(editor)) return false;
  const prevCopied = copiedFormatState;
  const prevOrigin = copiedSelectionOrigin;
  if (disarm && copiedFormatState) {
    // Desarmar antes de despachar transacciones para evitar reentrada en onSelectionUpdate.
    copiedFormatState = null;
    copiedSelectionOrigin = null;
  }
  const { from, to, empty, $from, $to } = editor.state.selection;
  let expandedWord = false;
  let wordFrom = from;
  let wordTo = to;

  if (empty && $from.parent.isTextblock && $from.parent.content.size > 0) {
    const blockStart = $from.start();
    const offset = $from.parentOffset;
    const text = $from.parent.textContent;
    let startOffset = offset;
    let endOffset = offset;
    while (startOffset > 0 && !/\s/.test(text[startOffset - 1])) startOffset--;
    while (endOffset < text.length && !/\s/.test(text[endOffset])) endOffset++;
    if (endOffset > startOffset) {
      expandedWord = true;
      wordFrom = blockStart + startOffset;
      wordTo = blockStart + endOffset;
    }
  }

  const targetFullBlock = empty
    ? $from.parent.content.size === 0
    : !$from.sameParent($to) ||
      ($from.parent.isTextblock &&
        editor.state.doc.textBetween(from, to, "\n", "\0").trim() === $from.parent.textContent.trim());

  const shouldApplyBlock =
    Boolean(format.fullBlock) &&
    targetFullBlock &&
    (format.formatKey !== "paragraph" ||
      (!format.hasInlineMarks &&
        !editor.isActive("bulletList") &&
        !editor.isActive("orderedList") &&
        (editor.isActive("heading") || editor.isActive("blockquote"))));

  const chain = editor.chain().focus().command(({ tr }) => {
    closeHistory(tr);
    return true;
  });

  if (expandedWord) {
    chain.setTextSelection({ from: wordFrom, to: wordTo });
  }

  if (shouldApplyBlock) {
    chain.command(({ state: s, commands }) => {
      const $pos = s.selection.$from;
      if (format.formatKey !== "bulletList" && hasAncestor($pos, "bulletList")) {
        commands.toggleBulletList();
      }
      if (format.formatKey !== "orderedList" && hasAncestor(s.selection.$from, "orderedList")) {
        commands.toggleOrderedList();
      }
      if (format.formatKey !== "quote" && hasAncestor(s.selection.$from, "blockquote")) {
        commands.unsetBlockquote();
      }
      if (format.formatKey === "heading1") return commands.setHeading({ level: 1 });
      if (format.formatKey === "heading2") return commands.setHeading({ level: 2 });
      if (format.formatKey === "heading3") return commands.setHeading({ level: 3 });
      if (format.formatKey === "quote") {
        if (!hasAncestor(s.selection.$from, "blockquote")) {
          return commands.setParagraph() && commands.setBlockquote();
        }
        return commands.setParagraph();
      }
      if (format.formatKey === "bulletList") {
        if (!hasAncestor(s.selection.$from, "bulletList")) {
          return commands.setParagraph() && commands.toggleBulletList();
        }
        return commands.setParagraph();
      }
      if (format.formatKey === "orderedList") {
        if (!hasAncestor(s.selection.$from, "orderedList")) {
          return commands.setParagraph() && commands.toggleOrderedList();
        }
        return commands.setParagraph();
      }
      return commands.setParagraph();
    });
  }

  if (format.fullBlock && targetFullBlock) {
    const targetDefaultAlign =
      editor.extensionManager.extensions.find((extension) => extension.name === "textAlign")?.options
        .defaultAlignment || "left";
    chain.command(({ state: s, commands }) => {
      const $pos = s.selection.$from;
      if (hasAncestor($pos, "bulletList") || hasAncestor($pos, "orderedList")) return true;
      commands.setTextAlign(format.textAlign || targetDefaultAlign);
      return true;
    });
  }

  chain.unsetAllMarks();
  chain.command(({ tr }) => {
    if (tr.selection.empty) tr.setStoredMarks([]);
    return true;
  });
  if (format.bold) chain.setBold();
  if (format.italic) chain.setItalic();
  if (format.underline) chain.setUnderline();
  if (format.strike) chain.setStrike();
  if (format.highlight) chain.setHighlight();
  if (format.colorKey) chain.setMark("tcolor", { color: format.colorKey });

  if (expandedWord) {
    // Restaurar el cursor colapsado para que seguir escribiendo no borre la palabra formateada.
    chain.command(({ tr }) => {
      const mapped = tr.mapping.map(from);
      const clamped = Math.max(0, Math.min(mapped, tr.doc.content.size));
      tr.setSelection(TextSelection.near(tr.doc.resolve(clamped)));
      return true;
    });
  }

  chain.command(({ tr }) => {
    closeHistory(tr);
    return true;
  });

  const applied = chain.run();
  if (applied) {
    editor.commands.command(({ tr }) => {
      closeHistory(tr);
      return true;
    });
    if (disarm && prevCopied) {
      setCopiedFormat(null);
      editor.view.dispatch(editor.state.tr.setMeta("nfFormatPainter", true).setMeta("addToHistory", false));
    }
  } else if (disarm && prevCopied) {
    copiedFormatState = prevCopied;
    copiedSelectionOrigin = prevOrigin;
  }
  return applied;
}

export function colorButtonHtml(colorKey) {
  const bar =
    colorKey && EDITOR_TEXT_COLORS[colorKey]
      ? EDITOR_TEXT_COLORS[colorKey]
      : "linear-gradient(90deg,#E5484D,#FFC53D,#46A758,#6E8BEB)";
  return `<span style="display:flex;flex-direction:column;align-items:center;gap:2px;line-height:1"><span style="font-size:13px;font-weight:700">A</span><span style="width:14px;height:2.5px;border-radius:2px;background:${bar}"></span></span>`;
}

// El botón de color abre la fila de swatches (no aplica nada por sí mismo).
export const COLOR_BUTTON = {
  key: "color",
  label: "Color del texto",
  html: colorButtonHtml(null),
};

// Estado activo de cada botón, para pintarlos en el bubble.
export function activeStates(editor) {
  const state = {};
  for (const b of BUBBLE_BUTTONS) state[b.key] = editor.isActive(b.key);
  // "align" no es una marca: se ilumina cuando el bloque está centrado o a la
  // derecha (izquierda = default, sin resaltar).
  state.align =
    editor.isActive({ textAlign: "center" }) || editor.isActive({ textAlign: "right" });
  state.formatKey = currentFormat(editor);
  state.toggleActive = toggleSummaryDepth(editor.state.selection.$from) != null;
  state.inList = editor.isActive("bulletList") || editor.isActive("orderedList");
  state.canIndent = canStructureAction(editor, "indent");
  state.canOutdent = canStructureAction(editor, "outdent");
  state.hasCopiedFormat = hasCopiedFormat();
  for (const key of COLOR_KEYS) {
    if (editor.isActive("tcolor", { color: key })) {
      state.colorKey = key;
      break;
    }
  }
  return state;
}

export function currentFormat(editor) {
  if (!editor.state.selection.empty) {
    const formats = new Set();
    const { from, to } = editor.state.selection;
    editor.state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isTextblock || pos >= to || pos + node.nodeSize <= from) return;
      const $pos = editor.state.doc.resolve(pos + 1);
      let key = node.type.name === "heading" ? `heading${node.attrs.level}` : "paragraph";
      if (key === "paragraph") for (let depth = $pos.depth - 1; depth > 0; depth--) {
        const type = $pos.node(depth).type.name;
        if (["blockquote", "bulletList", "orderedList"].includes(type)) { key = type === "blockquote" ? "quote" : type; break; }
      }
      formats.add(key);
    });
    if (formats.size > 1) return "mixed";
  }
  if (editor.isActive("heading", { level: 1 })) return "heading1";
  if (editor.isActive("heading", { level: 2 })) return "heading2";
  if (editor.isActive("heading", { level: 3 })) return "heading3";
  if (editor.isActive("blockquote")) return "quote";
  if (editor.isActive("bulletList")) return "bulletList";
  if (editor.isActive("orderedList")) return "orderedList";
  return "paragraph";
}

export function applyFormat(editor, key) {
  editor.commands.command(({ tr }) => { closeHistory(tr); return true; });
  if (key === "toggle") {
    const chain = editor.chain().focus();
    if (toggleSummaryDepth(editor.state.selection.$from) != null) chain.unwrapToggle();
    else chain.convertToToggle();
    chain.run();
    return;
  }
  const inSummary = toggleSummaryDepth(editor.state.selection.$from) != null;
  const defaultAlign = editor.extensionManager.extensions.find((extension) => extension.name === "textAlign")?.options.defaultAlignment || "left";
  const quoteAlign = editor.getAttributes("blockquote").textAlign;
  const preservedAlign = inSummary ? (quoteAlign && quoteAlign !== defaultAlign ? quoteAlign : editor.state.selection.$from.parent.attrs.textAlign) : null;
  // Primero saca cualquier contenedor incompatible; después aplica el bloque
  // elegido. Son comandos separados para que TipTap no deje un título dentro
  // de una lista o una cita dentro de otra cita.
  if (editor.isActive("bulletList")) editor.chain().focus().toggleBulletList().run();
  if (editor.isActive("orderedList")) editor.chain().focus().toggleOrderedList().run();
  if (editor.isActive("blockquote")) editor.chain().focus().toggleBlockquote().run();

  const chain = editor.chain().focus();
  if (key === "heading1") chain.setHeading({ level: 1 });
  else if (key === "heading2") chain.setHeading({ level: 2 });
  else if (key === "heading3") chain.setHeading({ level: 3 });
  else if (key === "quote") chain.setParagraph().toggleBlockquote();
  else if (key === "bulletList") chain.setParagraph().toggleBulletList();
  else if (key === "orderedList") chain.setParagraph().toggleOrderedList();
  else chain.setParagraph();
  if (preservedAlign) chain.setTextAlign(preservedAlign);
  chain.run();
}

// Aplica la acción de un botón del bubble.
export function runBubbleAction(editor, key) {
  if (key === "copyFormat") {
    copyFormatFromEditor(editor, { toggle: true });
    return;
  }
  const chain = editor.chain().focus().command(({ tr }) => { closeHistory(tr); return true; });
  if (key === "bold") chain.toggleBold();
  else if (key === "italic") chain.toggleItalic();
  else if (key === "underline") chain.toggleUnderline();
  else if (key === "strike") chain.toggleStrike();
  else if (key === "clear") chain.unsetAllMarks();
  else if (key === "indent") {
    if (toggleSummaryDepth(editor.state.selection.$from) != null) chain.indentToggle();
    else chain.sinkListItem("listItem");
  } else if (key === "outdent") {
    if (toggleSummaryDepth(editor.state.selection.$from) != null) chain.outdentToggle();
    else chain.liftListItem("listItem");
  }
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
  const chain = editor.chain().focus().command(({ tr }) => { closeHistory(tr); return true; });
  if (currentKey === colorKey) chain.unsetMark("tcolor");
  else chain.setMark("tcolor", { color: colorKey });
  chain.run();
}

export const TABLE_ACTIONS = [
  { key: "addRowAfter", label: "Agregar fila", text: "+ Fila" },
  { key: "addColumnAfter", label: "Agregar columna", text: "+ Columna" },
  { key: "deleteRow", label: "Quitar fila", text: "− Fila" },
  { key: "deleteColumn", label: "Quitar columna", text: "− Columna" },
  { key: "deleteTable", label: "Eliminar tabla", text: "Eliminar tabla" },
];
export const TABLE_BTN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/></svg>';
export function insertTable(editor) {
  editor.chain().focus().setTextSelection(editor.state.selection.to)
    .insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
}
export function mountTableToolbar(editor, host) {
  return attachEditorTableControls(editor, host);
}
