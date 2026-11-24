// Configuración compartida del editor Notion: la usan el bundle del WebView
// (nativo, editor-web/index.js) y el editor de la web (NotionField.web.js).
// Así las dos plataformas tienen exactamente las mismas marcas y atajos.

import { Extension, textInputRule, wrappingInputRule } from "@tiptap/core";
import { Blockquote } from "@tiptap/extension-blockquote";
import { NodeSelection, Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
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
import { linkDisplayTitle, openExternalLink, sanitizeLinkUrl } from "./richLink";

import { compressFile } from "./imageCompress";
import { Image } from "./tiptapImage";
import { WebBookmark, WebLink } from "./tiptapLink";
import { EDITOR_TEXT_COLORS, TColor } from "./tiptapTColor";
import { ALIGNMENTS, TextAlign } from "./tiptapTextAlign";
import { Toggle, ToggleContent, ToggleSummary, toggleSummaryDepth } from "./tiptapToggle";

export function focusEditorBottom(editor) {
  if (!editor || editor.isDestroyed || !editor.isEditable) return false;
  const { doc } = editor.state;
  const last = doc.lastChild;
  if (last && last.type.name === "paragraph" && last.content.size === 0) {
    const pos = Math.max(0, doc.content.size - 1);
    return editor.chain().focus().setTextSelection(pos).scrollIntoView().run();
  }
  const paragraph = editor.state.schema.nodes.paragraph?.create?.();
  if (!paragraph) return false;
  return editor
    .chain()
    .focus()
    .command(({ tr }) => {
      closeHistory(tr);
      tr.insert(tr.doc.content.size, paragraph);
      const targetPos = Math.max(0, tr.doc.content.size - 1);
      tr.setSelection(TextSelection.create(tr.doc, targetPos));
      closeHistory(tr);
      return true;
    })
    .scrollIntoView()
    .run();
}

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
      Enter: () => {
        const { selection } = this.editor.state;
        if (!(selection instanceof NodeSelection) || !selection.node.isAtom) return false;
        const paragraph = this.editor.state.schema.nodes.paragraph?.create?.();
        if (!paragraph) return false;
        return this.editor
          .chain()
          .command(({ tr }) => {
            closeHistory(tr);
            tr.insert(selection.to, paragraph);
            const pos = Math.min(selection.to + 1, tr.doc.content.size);
            tr.setSelection(TextSelection.create(tr.doc, pos));
            closeHistory(tr);
            return true;
          })
          .scrollIntoView()
          .run();
      },
      ArrowDown: () => {
        const { selection, doc } = this.editor.state;
        if (!(selection instanceof NodeSelection) || selection.to < doc.content.size) return false;
        return focusEditorBottom(this.editor);
      },
      ArrowUp: () => {
        const { selection } = this.editor.state;
        if (!(selection instanceof NodeSelection) || selection.from !== 0) return false;
        const paragraph = this.editor.state.schema.nodes.paragraph?.create?.();
        if (!paragraph) return false;
        return this.editor
          .chain()
          .command(({ tr }) => {
            closeHistory(tr);
            tr.insert(0, paragraph);
            tr.setSelection(TextSelection.create(tr.doc, 1));
            closeHistory(tr);
            return true;
          })
          .scrollIntoView()
          .run();
      },
      "Mod-k": () => {
        openLinkEditor(this.editor);
        return true;
      },
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

const ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
function escapeAttrHtml(value) {
  return String(value || "").replace(/[&<>"]/g, (ch) => ESCAPE_MAP[ch]);
}

const mathLiveKey = new PluginKey("activecardMathLive");
const linkPopoverKey = new PluginKey("activecardLinkPopover");

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
const linkControllers = new WeakMap();

function createHostTracker(view, { onAttach, onDetach } = {}) {
  const resolveHost = () => view.dom.closest?.(".nf-root") || view.dom.parentElement || null;
  let host = null;

  const ensureHost = () => {
    const nextHost = resolveHost();
    if (!nextHost || nextHost === host) return host;
    if (host) onDetach?.(host);
    host = nextHost;
    onAttach?.(host);
    return host;
  };

  ensureHost();

  return {
    getHost: () => host,
    ensureHost,
    destroy() {
      if (host) onDetach?.(host);
      host = null;
    },
  };
}

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

          let current = null;
          let currentAnchor = null;

          const hostTracker = createHostTracker(view, {
            onAttach(nextHost) {
              if (popover.parentElement !== nextHost) nextHost.appendChild(popover);
              if (current) nextHost.classList.add("nf-math-editing");
              nextHost.addEventListener("nf:viewport", onViewport);
            },
            onDetach(prevHost) {
              prevHost.classList.remove("nf-math-editing");
              prevHost.removeEventListener("nf:viewport", onViewport);
            },
          });

          popover.addEventListener("focusin", () => {
            hostTracker.ensureHost()?.dispatchEvent(new Event("nf:restore-scroll", { bubbles: true }));
          });

          const updatePreview = (raw, display) => {
            const cleaned = String(raw || "").trim();
            if (!cleaned) {
              preview.innerHTML = '<span class="nf-math-popover-empty">Fórmula vacía</span>';
              return;
            }
            preview.innerHTML = renderMathDecorationHtml(cleaned, display) || "";
          };

          const positionPopover = () => {
            const host = hostTracker.ensureHost();
            if (!current || popover.hidden || !host || !host.isConnected) return;
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

          const revealPopover = () => {
            const host = hostTracker.getHost();
            if (!host || popover.hidden) return;
            const rootRect = host.getBoundingClientRect();
            const box = popover.getBoundingClientRect();
            const top = box.height
              ? Math.max(0, box.top - rootRect.top)
              : Math.max(0, parseFloat(popover.style.top) || 0);
            const bottom = box.height ? Math.max(top, box.bottom - rootRect.top) : top + (popover.offsetHeight || 120);
            host.dispatchEvent(new CustomEvent("nf:reveal-panel", { bubbles: true, detail: { top, bottom } }));
          };

          const close = ({ focusEditor = false } = {}) => {
            const host = hostTracker.getHost();
            if (!current && popover.hidden) return;
            current = null;
            currentAnchor = null;
            popover.hidden = true;
            host?.classList.remove("nf-math-editing");
            if (!editor.isDestroyed) {
              view.dispatch(view.state.tr.setMeta(mathLiveKey, null).setMeta("addToHistory", false));
              if (focusEditor) editor.commands.focus();
            }
            host?.dispatchEvent(new Event("nf:layout"));
          };

          const open = (entry, anchorEl, { selectAll = false } = {}) => {
            const host = hostTracker.ensureHost();
            if (!host || !editor.isEditable) return;
            if (current && current.from === entry.from && current.to === entry.to && !selectAll) {
              close({ focusEditor: true });
              return;
            }
            if (current) {
              commit({ focusEditor: false });
            }
            const linkCtrl = linkControllers.get(editor);
            if (linkCtrl?.isOpen()) linkCtrl.close({ focusEditor: false });

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
            input.focus({ preventScroll: true });
            input.setSelectionRange(selectAll ? 0 : input.value.length, input.value.length);
            revealPopover();
            host.dispatchEvent(new Event("nf:layout"));
          };

          const commit = ({ focusEditor = true } = {}) => {
            if (!current) return;
            const host = hostTracker.getHost();
            const snapshot = current;
            const normalizedInput = input.value.replace(/\r\n?/g, "\n").replace(/\s*\n+\s*/g, " ").trim();
            const normalizedOrig = (snapshot.latex || "").replace(/\r\n?/g, "\n").replace(/\s*\n+\s*/g, " ").trim();
            const docSize = editor.state.doc.content.size;
            const validRange = snapshot.from >= 0 && snapshot.to <= docSize && snapshot.from <= snapshot.to;

            current = null;
            currentAnchor = null;
            popover.hidden = true;
            host?.classList.remove("nf-math-editing");

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
            host?.dispatchEvent(new Event("nf:layout"));
          };

          const removeFormula = () => {
            if (!current) return;
            const host = hostTracker.getHost();
            const snapshot = current;
            const docSize = editor.state.doc.content.size;
            const validRange = snapshot.from >= 0 && snapshot.to <= docSize && snapshot.from <= snapshot.to;
            current = null;
            currentAnchor = null;
            popover.hidden = true;
            host?.classList.remove("nf-math-editing");
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
            host?.dispatchEvent(new Event("nf:layout"));
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
            hostTracker.getHost()?.dispatchEvent(new Event("nf:layout"));
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
          function onViewport() {
            positionPopover();
          }
          document.addEventListener("pointerdown", onOutsidePointer, true);
          window.addEventListener("resize", onViewport);
          window.addEventListener("scroll", onViewport, true);
          window.visualViewport?.addEventListener("resize", onViewport);

          return {
            update(nextView, prevState) {
              hostTracker.ensureHost();
              if (!current) return;
              if (nextView.state.doc !== prevState.doc && !mathLiveKey.getState(nextView.state)?.activeMath) {
                current = null;
                currentAnchor = null;
                popover.hidden = true;
                hostTracker.getHost()?.classList.remove("nf-math-editing");
                hostTracker.getHost()?.dispatchEvent(new Event("nf:layout"));
              }
            },
            destroy() {
              mathControllers.delete(editor);
              hostTracker.destroy();
              document.removeEventListener("pointerdown", onOutsidePointer, true);
              window.removeEventListener("resize", onViewport);
              window.removeEventListener("scroll", onViewport, true);
              window.visualViewport?.removeEventListener("resize", onViewport);
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

function getWebLinkMark(node) {
  if (!node?.isText) return null;
  return node.marks.find((m) => m.type.name === "webLink") || null;
}

function findLinkRangeAtPos(doc, pos) {
  if (pos < 0 || pos > doc.content.size) return null;
  const $pos = doc.resolve(pos);
  const parent = $pos.parent;
  if (!parent || !parent.isTextblock) return null;

  const blockStart = $pos.start();
  const children = [];
  let offset = 0;
  parent.forEach((child) => {
    children.push({ node: child, from: blockStart + offset, to: blockStart + offset + child.nodeSize });
    offset += child.nodeSize;
  });

  let hitIdx = children.findIndex((c) => c.node.isText && pos >= c.from && pos <= c.to && getWebLinkMark(c.node));
  if (hitIdx === -1 && pos > blockStart) {
    hitIdx = children.findIndex((c) => c.node.isText && pos - 1 >= c.from && pos - 1 < c.to && getWebLinkMark(c.node));
  }
  if (hitIdx === -1) return null;

  const targetMark = getWebLinkMark(children[hitIdx].node);
  const targetHref = targetMark.attrs.href;
  const targetDisplay = targetMark.attrs.display === "mention" ? "mention" : "inline";

  let from = children[hitIdx].from;
  let to = children[hitIdx].to;
  for (let i = hitIdx - 1; i >= 0; i -= 1) {
    const m = getWebLinkMark(children[i].node);
    if (!m || m.attrs.href !== targetHref || (m.attrs.display === "mention" ? "mention" : "inline") !== targetDisplay)
      break;
    from = children[i].from;
  }
  for (let i = hitIdx + 1; i < children.length; i += 1) {
    const m = getWebLinkMark(children[i].node);
    if (!m || m.attrs.href !== targetHref || (m.attrs.display === "mention" ? "mention" : "inline") !== targetDisplay)
      break;
    to = children[i].to;
  }

  return {
    kind: "inline",
    from,
    to,
    url: targetHref,
    title: doc.textBetween(from, to, " ", " "),
    description: "",
    mode: targetDisplay,
    existing: true,
  };
}

const LINK_MODES = [
  { key: "inline", label: "URL" },
  { key: "mention", label: "Mención" },
  { key: "bookmark", label: "Marcador" },
  { key: "card", label: "Tarjeta" },
];

const LinkInteractions = Extension.create({
  name: "activecardLinkInteractions",
  addKeyboardShortcuts() {
    return {
      Escape: () => {
        const ctrl = linkControllers.get(this.editor);
        if (ctrl?.isOpen()) {
          ctrl.close({ focusEditor: true });
          return true;
        }
        return false;
      },
    };
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: linkPopoverKey,
        view(view) {
          if (typeof document === "undefined") return {};

          const popover = document.createElement("div");
          popover.className = "nf-link-popover";
          popover.setAttribute("role", "dialog");
          popover.setAttribute("aria-label", "Editar enlace");
          popover.hidden = true;

          const modesRow = document.createElement("div");
          modesRow.className = "nf-link-modes";
          const modeButtons = {};
          for (const def of LINK_MODES) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "nf-link-mode-btn";
            btn.dataset.mode = def.key;
            btn.textContent = def.label;
            modesRow.appendChild(btn);
            modeButtons[def.key] = btn;
          }

          const expandBtn = document.createElement("button");
          expandBtn.type = "button";
          expandBtn.className = "nf-link-mode-expand";
          expandBtn.textContent = "✎";
          expandBtn.setAttribute("aria-label", "Editar enlace");
          expandBtn.title = "Editar enlace";
          expandBtn.hidden = true;
          modesRow.appendChild(expandBtn);

          const urlInput = document.createElement("input");
          urlInput.type = "url";
          urlInput.className = "nf-link-input nf-link-input-url";
          urlInput.placeholder = "https://ejemplo.com";
          urlInput.setAttribute("aria-label", "URL del enlace");
          urlInput.spellcheck = false;
          urlInput.autocomplete = "off";
          urlInput.setAttribute("autocapitalize", "off");

          const titleInput = document.createElement("input");
          titleInput.type = "text";
          titleInput.className = "nf-link-input nf-link-input-title";
          titleInput.placeholder = "Texto o título visible";
          titleInput.setAttribute("aria-label", "Texto visible del enlace");

          const descInput = document.createElement("input");
          descInput.type = "text";
          descInput.className = "nf-link-input nf-link-input-desc";
          descInput.placeholder = "Descripción breve (opcional)";
          descInput.setAttribute("aria-label", "Descripción del enlace");
          descInput.hidden = true;

          const errorEl = document.createElement("div");
          errorEl.className = "nf-link-error";
          errorEl.hidden = true;

          const actions = document.createElement("div");
          actions.className = "nf-link-actions";

          const openBtn = document.createElement("button");
          openBtn.type = "button";
          openBtn.className = "nf-link-popover-btn nf-link-popover-open";
          openBtn.textContent = "Abrir ↗";

          const delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "nf-link-popover-btn nf-link-popover-delete";
          delBtn.textContent = "Quitar";

          const doneBtn = document.createElement("button");
          doneBtn.type = "button";
          doneBtn.className = "nf-link-popover-btn nf-link-popover-done";
          doneBtn.textContent = "Listo";

          actions.append(openBtn, delBtn, doneBtn);
          popover.append(modesRow, urlInput, titleInput, descInput, errorEl, actions);

          const hoverBar = document.createElement("div");
          hoverBar.className = "nf-link-hover";
          hoverBar.setAttribute("role", "toolbar");
          hoverBar.setAttribute("aria-label", "Acciones del enlace");
          hoverBar.hidden = true;

          const hoverEditBtn = document.createElement("button");
          hoverEditBtn.type = "button";
          hoverEditBtn.className = "nf-link-hover-btn nf-link-hover-edit";
          hoverEditBtn.textContent = "Editar ✎";
          hoverEditBtn.setAttribute("aria-label", "Editar enlace");

          const hoverDelBtn = document.createElement("button");
          hoverDelBtn.type = "button";
          hoverDelBtn.className = "nf-link-hover-btn nf-link-hover-delete";
          hoverDelBtn.textContent = "Quitar";
          hoverDelBtn.setAttribute("aria-label", "Quitar enlace");

          hoverBar.append(hoverEditBtn, hoverDelBtn);

          let current = null;
          let currentAnchor = null;
          let selectedMode = "inline";
          let isCompact = false;
          let applyingLinkChange = false;
          let hoverTarget = null;
          let hoverAnchor = null;
          let hoverHideTimer = null;
          let touchPressTimer = null;
          let touchStartPos = null;
          let longPressTriggered = false;
          let longPressResetTimer = null;

          const clearTouchPress = () => {
            if (touchPressTimer != null) {
              clearTimeout(touchPressTimer);
              touchPressTimer = null;
            }
            touchStartPos = null;
          };

          const hostTracker = createHostTracker(view, {
            onAttach(nextHost) {
              if (popover.parentElement !== nextHost) nextHost.appendChild(popover);
              if (hoverBar.parentElement !== nextHost) nextHost.appendChild(hoverBar);
              if (current) nextHost.classList.add("nf-link-editing");
              nextHost.addEventListener("nf:viewport", onViewport);
            },
            onDetach(prevHost) {
              prevHost.classList.remove("nf-link-editing");
              prevHost.removeEventListener("nf:viewport", onViewport);
            },
          });

          popover.addEventListener("focusin", () => {
            hostTracker.ensureHost()?.dispatchEvent(new Event("nf:restore-scroll", { bubbles: true }));
          });

          const resolveAnchorElement = (target) => {
            if (!target) return null;
            try {
              if (target.kind === "block") {
                const nodeDom = view.nodeDOM(target.pos);
                return nodeDom?.nodeType === 1 ? nodeDom : null;
              }
              const clamped = Math.min(target.from + 1, editor.state.doc.content.size);
              const domPos = view.domAtPos(clamped);
              const baseEl = domPos.node?.nodeType === 1 ? domPos.node : domPos.node?.parentElement;
              return baseEl?.closest?.("a.nf-link") || null;
            } catch {
              return null;
            }
          };

          const syncModeUi = () => {
            for (const def of LINK_MODES) {
              const active = selectedMode === def.key;
              modeButtons[def.key].classList.toggle("is-active", active);
              modeButtons[def.key].setAttribute("aria-pressed", String(active));
            }
            popover.classList.toggle("is-compact", isCompact);
            expandBtn.hidden = !isCompact;
            urlInput.hidden = isCompact;
            titleInput.hidden = isCompact;
            descInput.hidden = isCompact || selectedMode === "inline" || selectedMode === "mention";
            actions.hidden = isCompact;
            if (isCompact) errorEl.hidden = true;
            const parsedUrl = sanitizeLinkUrl(urlInput.value, { autoScheme: true });
            openBtn.hidden = isCompact || !parsedUrl;
          };

          const showError = (msg) => {
            errorEl.textContent = msg || "";
            errorEl.hidden = !msg;
          };

          const cancelHoverHide = () => {
            if (hoverHideTimer != null) {
              clearTimeout(hoverHideTimer);
              hoverHideTimer = null;
            }
          };

          const hideHover = () => {
            cancelHoverHide();
            hoverTarget = null;
            hoverAnchor = null;
            if (!hoverBar.hidden) {
              hoverBar.hidden = true;
              hostTracker.getHost()?.dispatchEvent(new Event("nf:layout"));
            }
          };

          const scheduleHideHover = () => {
            cancelHoverHide();
            hoverHideTimer = setTimeout(hideHover, 180);
          };

          const positionHover = () => {
            const host = hostTracker.ensureHost();
            if (!hoverTarget || hoverBar.hidden || !host || !host.isConnected) return;
            if (!hoverAnchor || !hoverAnchor.isConnected) {
              hideHover();
              return;
            }
            const root = host.getBoundingClientRect();
            const anchor = hoverAnchor.getBoundingClientRect();
            const available = Math.max(140, (root.width || 320) - 16);
            hoverBar.style.maxWidth = `${available}px`;
            const measuredWidth = Math.min(
              available,
              hoverBar.offsetWidth || hoverBar.getBoundingClientRect().width || 156
            );
            const left = Math.min(
              Math.max(8, (anchor.left + anchor.right) / 2 - root.left - measuredWidth / 2),
              Math.max(8, (root.width || measuredWidth + 16) - measuredWidth - 8)
            );
            hoverBar.style.left = `${left}px`;
            positionEditorPanel(host, hoverBar, anchor, true, 6);
          };

          const showHoverForAnchor = (anchorEl) => {
            if (!editor.isEditable || current || editor.isDestroyed) return;
            if (window.matchMedia?.("(pointer: coarse)")?.matches) return;
            let pos = null;
            try {
              pos = view.posAtDOM(anchorEl, 0);
            } catch {
              pos = null;
            }
            const target = pos != null ? findLinkRangeAtPos(view.state.doc, pos) : null;
            if (!target) return;
            const host = hostTracker.ensureHost();
            if (!host) return;
            cancelHoverHide();
            hoverTarget = target;
            hoverAnchor = anchorEl;
            hoverBar.hidden = false;
            positionHover();
          };

          const positionPopover = () => {
            const host = hostTracker.ensureHost();
            if (!current || popover.hidden || !host || !host.isConnected) return;
            const anchorEl = currentAnchor && currentAnchor.isConnected ? currentAnchor : resolveAnchorElement(current);
            const root = host.getBoundingClientRect();
            const pos = current.kind === "block" ? current.pos : current.from;
            const clamped = Math.max(0, Math.min(pos, editor.state.doc.content.size));
            const anchor = anchorEl?.getBoundingClientRect?.() || view.coordsAtPos(clamped);
            const available = Math.max(240, (root.width || 320) - 16);
            const targetWidth = isCompact ? Math.min(380, available) : Math.min(360, available);
            popover.style.width = isCompact ? "max-content" : `${targetWidth}px`;
            popover.style.maxWidth = `${targetWidth}px`;
            const measuredWidth = Math.min(
              targetWidth,
              popover.offsetWidth || popover.getBoundingClientRect().width || targetWidth
            );
            const left = Math.min(
              Math.max(8, (anchor.left + anchor.right) / 2 - root.left - measuredWidth / 2),
              Math.max(8, (root.width || measuredWidth + 16) - measuredWidth - 8)
            );
            popover.style.left = `${left}px`;
            const coarse = !!window.matchMedia?.("(pointer: coarse)")?.matches;
            positionEditorPanel(host, popover, anchor, false, coarse ? 12 : 8);
          };

          const revealPopover = () => {
            const host = hostTracker.getHost();
            if (!host || popover.hidden) return;
            const rootRect = host.getBoundingClientRect();
            const box = popover.getBoundingClientRect();
            const top = box.height
              ? Math.max(0, box.top - rootRect.top)
              : Math.max(0, parseFloat(popover.style.top) || 0);
            const bottom = box.height ? Math.max(top, box.bottom - rootRect.top) : top + (popover.offsetHeight || 120);
            host.dispatchEvent(new CustomEvent("nf:reveal-panel", { bubbles: true, detail: { top, bottom } }));
          };

          const close = ({ focusEditor = false } = {}) => {
            const host = hostTracker.getHost();
            if (!current && popover.hidden) return;
            current = null;
            currentAnchor = null;
            isCompact = false;
            popover.hidden = true;
            popover.classList.remove("is-compact");
            showError("");
            host?.classList.remove("nf-link-editing");
            if (focusEditor && !editor.isDestroyed) editor.commands.focus();
            host?.dispatchEvent(new Event("nf:layout"));
          };

          const applyTarget = ({ focusEditor = false, keepOpen = false } = {}) => {
            if (!current) return false;
            const safeUrl = sanitizeLinkUrl(urlInput.value, { autoScheme: true });
            if (!safeUrl) {
              showError("Ingresá un enlace válido (http:// o https://)");
              syncModeUi();
              positionPopover();
              hostTracker.getHost()?.dispatchEvent(new Event("nf:layout"));
              return false;
            }
            showError("");

            const mode = selectedMode;
            const resolvedTitle = linkDisplayTitle(safeUrl, titleInput.value);
            const cleanDesc = descInput.value.replace(/\r\n?/g, " ").trim();
            const isBlockMode = mode === "bookmark" || mode === "card";
            const schema = editor.state.schema;
            const snapshot = current;
            let nextTarget = null;
            let applied = false;

            applyingLinkChange = true;
            try {
              applied = editor
                .chain()
                .command(({ tr }) => {
                  closeHistory(tr);
                  const docSize = tr.doc.content.size;
                  if (snapshot.kind === "block") {
                    const pos = snapshot.pos;
                    const node = tr.doc.nodeAt(pos);
                    if (!node || node.type.name !== "webBookmark") return false;
                    if (isBlockMode) {
                      tr.setNodeMarkup(pos, undefined, {
                        url: safeUrl,
                        title: resolvedTitle,
                        description: cleanDesc,
                        variant: mode,
                      });
                      nextTarget = {
                        kind: "block",
                        pos,
                        url: safeUrl,
                        title: resolvedTitle,
                        description: cleanDesc,
                        mode,
                        existing: true,
                      };
                    } else {
                      const mark = schema.marks.webLink.create({ href: safeUrl, display: mode });
                      const pNode = schema.nodes.paragraph.create(null, schema.text(resolvedTitle, [mark]));
                      tr.replaceWith(pos, pos + node.nodeSize, pNode);
                      const from = pos + 1;
                      const to = from + resolvedTitle.length;
                      tr.setSelection(TextSelection.create(tr.doc, to));
                      nextTarget = {
                        kind: "inline",
                        from,
                        to,
                        url: safeUrl,
                        title: resolvedTitle,
                        description: "",
                        mode,
                        existing: true,
                      };
                    }
                  } else {
                    const from = Math.max(0, Math.min(snapshot.from, docSize));
                    const to = Math.max(from, Math.min(snapshot.to, docSize));
                    if (!isBlockMode) {
                      const mark = schema.marks.webLink.create({ href: safeUrl, display: mode });
                      const textNode = schema.text(resolvedTitle, [mark]);
                      tr.replaceWith(from, to, textNode);
                      const newTo = from + resolvedTitle.length;
                      tr.setSelection(TextSelection.create(tr.doc, newTo));
                      nextTarget = {
                        kind: "inline",
                        from,
                        to: newTo,
                        url: safeUrl,
                        title: resolvedTitle,
                        description: "",
                        mode,
                        existing: true,
                      };
                    } else {
                      const $from = tr.doc.resolve(from);
                      const bookmarkNode = schema.nodes.webBookmark.create({
                        url: safeUrl,
                        title: resolvedTitle,
                        description: cleanDesc,
                        variant: mode,
                      });
                      const wholeTopParagraph =
                        $from.depth === 1 &&
                        $from.parent.type.name === "paragraph" &&
                        from <= $from.start(1) &&
                        to >= $from.end(1);
                      if (wholeTopParagraph) {
                        const blockFrom = $from.before(1);
                        const blockTo = $from.after(1);
                        const atDocEnd = blockTo >= tr.doc.content.size;
                        const replacement = atDocEnd ? [bookmarkNode, schema.nodes.paragraph.create()] : bookmarkNode;
                        tr.replaceWith(blockFrom, blockTo, replacement);
                        tr.setSelection(NodeSelection.create(tr.doc, blockFrom));
                        nextTarget = {
                          kind: "block",
                          pos: blockFrom,
                          url: safeUrl,
                          title: resolvedTitle,
                          description: cleanDesc,
                          mode,
                          existing: true,
                        };
                      } else {
                        if (snapshot.existing && to > from) {
                          tr.delete(from, to);
                        }
                        const mappedFrom = Math.min(tr.mapping.map(from), tr.doc.content.size);
                        const $mapped = tr.doc.resolve(mappedFrom);
                        const topIdx = $mapped.index(0);
                        let insertAt = 0;
                        for (let i = 0; i <= topIdx; i += 1) insertAt += tr.doc.child(i).nodeSize;
                        const atDocEnd = insertAt >= tr.doc.content.size;
                        const nodes = atDocEnd ? [bookmarkNode, schema.nodes.paragraph.create()] : bookmarkNode;
                        tr.insert(insertAt, nodes);
                        tr.setSelection(NodeSelection.create(tr.doc, insertAt));
                        nextTarget = {
                          kind: "block",
                          pos: insertAt,
                          url: safeUrl,
                          title: resolvedTitle,
                          description: cleanDesc,
                          mode,
                          existing: true,
                        };
                      }
                    }
                  }
                  closeHistory(tr);
                  return true;
                })
                .run();
            } finally {
              applyingLinkChange = false;
            }

            if (!applied) return false;
            if (keepOpen && nextTarget) {
              current = nextTarget;
              currentAnchor = resolveAnchorElement(nextTarget);
              titleInput.value = nextTarget.title || "";
              descInput.value = nextTarget.description || "";
              syncModeUi();
              positionPopover();
              revealPopover();
              hostTracker.getHost()?.dispatchEvent(new Event("nf:layout"));
              return true;
            }
            close({ focusEditor });
            return true;
          };

          const schemaHasMark = (tr, markType, from, to) => {
            if (!markType) return false;
            let found = false;
            tr.doc.nodesBetween(from, to, (node) => {
              if (node.isText && markType.isInSet(node.marks)) found = true;
            });
            return found;
          };
          const schemaMark = (ed) => ed.state.schema.marks.webLink;

          const removeTargetLink = (snapshot, { focusEditor = true } = {}) => {
            if (!snapshot?.existing) {
              if (focusEditor && !editor.isDestroyed) editor.commands.focus();
              return;
            }
            const chain = editor.chain();
            if (focusEditor) chain.focus();
            chain
              .command(({ tr }) => {
                closeHistory(tr);
                if (snapshot.kind === "block") {
                  const node = tr.doc.nodeAt(snapshot.pos);
                  if (node && node.type.name === "webBookmark") {
                    tr.delete(snapshot.pos, snapshot.pos + node.nodeSize);
                  }
                } else {
                  const from = Math.max(0, Math.min(snapshot.from, tr.doc.content.size));
                  const to = Math.max(from, Math.min(snapshot.to, tr.doc.content.size));
                  if (to > from && schemaHasMark(tr, schemaMark(editor), from, to)) {
                    tr.removeMark(from, to, editor.state.schema.marks.webLink);
                  }
                }
                closeHistory(tr);
                return true;
              })
              .run();
          };

          const removeLink = () => {
            if (!current) return;
            const snapshot = current;
            close({ focusEditor: false });
            removeTargetLink(snapshot, { focusEditor: true });
          };

          const open = (target, anchorEl = null, { compact = false } = {}) => {
            const host = hostTracker.ensureHost();
            if (!host || !editor.isEditable || !target) return;
            const mathCtrl = mathControllers.get(editor);
            if (mathCtrl?.isOpen()) mathCtrl.close({ focusEditor: false });
            hideHover();

            current = { ...target };
            currentAnchor = anchorEl || resolveAnchorElement(target);
            selectedMode = target.mode || "inline";
            isCompact = Boolean(compact);
            urlInput.value = target.url || "";
            titleInput.value = target.title || "";
            descInput.value = target.description || "";
            showError("");
            delBtn.textContent = target.existing ? "Quitar" : "Cancelar";
            syncModeUi();

            host.classList.add("nf-link-editing");
            host.dispatchEvent(new Event("nf:dismiss-controls"));
            popover.hidden = false;
            positionPopover();
            if (!isCompact) {
              if (!target.existing && !urlInput.value) {
                urlInput.focus({ preventScroll: true });
              } else {
                titleInput.focus({ preventScroll: true });
                titleInput.setSelectionRange(titleInput.value.length, titleInput.value.length);
              }
              revealPopover();
            }
            host.dispatchEvent(new Event("nf:layout"));
          };

          linkControllers.set(editor, {
            open,
            close,
            applyTarget,
            isOpen: () => Boolean(current),
          });

          hoverBar.addEventListener("mouseenter", cancelHoverHide);
          hoverBar.addEventListener("mouseleave", (event) => {
            if (hoverAnchor && event.relatedTarget && hoverAnchor.contains(event.relatedTarget)) return;
            scheduleHideHover();
          });
          hoverEditBtn.addEventListener("pointerdown", (event) => event.preventDefault());
          hoverEditBtn.addEventListener("mousedown", (event) => event.preventDefault());
          hoverEditBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const target = hoverTarget;
            const anchor = hoverAnchor;
            hideHover();
            if (target) open(target, anchor, { compact: false });
          });
          hoverDelBtn.addEventListener("pointerdown", (event) => event.preventDefault());
          hoverDelBtn.addEventListener("mousedown", (event) => event.preventDefault());
          hoverDelBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const target = hoverTarget;
            hideHover();
            if (target) removeTargetLink(target, { focusEditor: true });
          });

          expandBtn.addEventListener("pointerdown", (event) => event.preventDefault());
          expandBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!current) return;
            isCompact = false;
            syncModeUi();
            positionPopover();
            titleInput.focus({ preventScroll: true });
            titleInput.setSelectionRange(titleInput.value.length, titleInput.value.length);
            revealPopover();
            hostTracker.getHost()?.dispatchEvent(new Event("nf:layout"));
          });

          for (const def of LINK_MODES) {
            const btn = modeButtons[def.key];
            btn.addEventListener("pointerdown", (event) => event.preventDefault());
            btn.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!current || selectedMode === def.key) return;
              selectedMode = def.key;
              syncModeUi();
              if (current.existing && sanitizeLinkUrl(urlInput.value, { autoScheme: true })) {
                applyTarget({ focusEditor: false, keepOpen: true });
              } else {
                positionPopover();
                hostTracker.getHost()?.dispatchEvent(new Event("nf:layout"));
              }
            });
          }

          urlInput.addEventListener("input", () => {
            showError("");
            syncModeUi();
          });

          const onInputKeydown = (event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close({ focusEditor: true });
            } else if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              applyTarget({ focusEditor: true, keepOpen: false });
            }
          };
          urlInput.addEventListener("keydown", onInputKeydown);
          titleInput.addEventListener("keydown", onInputKeydown);
          descInput.addEventListener("keydown", onInputKeydown);

          openBtn.addEventListener("pointerdown", (event) => event.preventDefault());
          openBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            openExternalLink(urlInput.value, hostTracker.ensureHost());
          });

          doneBtn.addEventListener("pointerdown", (event) => event.preventDefault());
          doneBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            applyTarget({ focusEditor: true, keepOpen: false });
          });

          delBtn.addEventListener("pointerdown", (event) => event.preventDefault());
          delBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            removeLink();
          });

          const onEditBlockEvent = (event) => {
            const liveHost = hostTracker.ensureHost();
            if (!liveHost || event.target !== liveHost) return;
            const detail = event.detail;
            if (!detail || !detail.node) return;
            open(
              {
                kind: "block",
                pos: detail.pos,
                url: detail.node.attrs.url || "",
                title: detail.node.attrs.title || "",
                description: detail.node.attrs.description || "",
                mode: detail.node.attrs.variant === "card" ? "card" : "bookmark",
                existing: true,
              },
              detail.anchor || null,
              { compact: false }
            );
          };
          document.addEventListener("nf:edit-link-block", onEditBlockEvent);

          const onOutsidePointer = (event) => {
            if (!current || popover.contains(event.target)) return;
            if (event.target.closest?.(".nf-link-block-edit, .nf-link-hover")) return;
            if (isCompact) {
              close({ focusEditor: false });
              return;
            }
            if (sanitizeLinkUrl(urlInput.value, { autoScheme: true })) {
              applyTarget({ focusEditor: false, keepOpen: false });
            } else {
              close({ focusEditor: false });
            }
          };
          function onViewport() {
            positionPopover();
            positionHover();
          }
          document.addEventListener("pointerdown", onOutsidePointer, true);
          window.addEventListener("resize", onViewport);
          window.addEventListener("scroll", onViewport, true);
          window.visualViewport?.addEventListener("resize", onViewport);

          const onDomMouseOver = (event) => {
            const anchor = event.target?.closest?.("a.nf-link");
            if (anchor && view.dom.contains(anchor)) {
              showHoverForAnchor(anchor);
            }
          };
          const onDomMouseOut = (event) => {
            if (hoverBar.hidden) return;
            const fromAnchor = event.target?.closest?.("a.nf-link");
            if (!fromAnchor) return;
            const related = event.relatedTarget;
            if (related && (fromAnchor.contains(related) || hoverBar.contains(related))) return;
            scheduleHideHover();
          };
          const onDomPointerDown = (event) => {
            clearTouchPress();
            if (event.pointerType === "touch" && view.editable) {
              const anchor = event.target?.closest?.("a.nf-link");
              if (anchor && view.dom.contains(anchor)) {
                touchStartPos = { x: event.clientX, y: event.clientY };
                touchPressTimer = setTimeout(() => {
                  touchPressTimer = null;
                  longPressTriggered = true;
                  if (longPressResetTimer != null) clearTimeout(longPressResetTimer);
                  longPressResetTimer = setTimeout(() => {
                    longPressResetTimer = null;
                    longPressTriggered = false;
                  }, 800);
                  let pos = null;
                  try {
                    pos = view.posAtDOM(anchor, 0);
                  } catch {
                    pos = null;
                  }
                  const target = pos != null ? findLinkRangeAtPos(view.state.doc, pos) : null;
                  if (target) {
                    open(target, anchor, { compact: false });
                  }
                }, 380);
              }
            }
          };
          const onDomPointerMove = (event) => {
            if (touchPressTimer != null && touchStartPos) {
              if (Math.hypot(event.clientX - touchStartPos.x, event.clientY - touchStartPos.y) > 8) {
                clearTouchPress();
              }
            }
          };
          const onDomPointerEnd = () => clearTouchPress();
          const onDomContextMenu = (event) => {
            if (longPressTriggered && event.target?.closest?.("a.nf-link")) {
              event.preventDefault();
            }
          };
          const onDomKeydown = () => {
            hideHover();
          };

          view.dom.addEventListener("mouseover", onDomMouseOver);
          view.dom.addEventListener("mouseout", onDomMouseOut);
          view.dom.addEventListener("pointerdown", onDomPointerDown);
          view.dom.addEventListener("pointermove", onDomPointerMove);
          view.dom.addEventListener("pointerup", onDomPointerEnd);
          view.dom.addEventListener("pointercancel", onDomPointerEnd);
          view.dom.addEventListener("contextmenu", onDomContextMenu);
          view.dom.addEventListener("keydown", onDomKeydown);

          const onClickLink = (event) => {
            const anchor = event.target?.closest?.("a.nf-link");
            if (!anchor || !view.dom.contains(anchor)) return;
            event.preventDefault();
            event.stopPropagation();
            hideHover();
            if (longPressTriggered) {
              longPressTriggered = false;
              if (longPressResetTimer != null) {
                clearTimeout(longPressResetTimer);
                longPressResetTimer = null;
              }
              return;
            }
            const safeUrl = sanitizeLinkUrl(anchor.getAttribute("href"));
            if (safeUrl) {
              openExternalLink(safeUrl, anchor);
            }
          };
          view.dom.addEventListener("click", onClickLink);

          return {
            update(nextView, prevState) {
              hostTracker.ensureHost();
              if (current && isCompact && nextView.state.doc !== prevState.doc && !applyingLinkChange) {
                close({ focusEditor: false });
              }
            },
            destroy() {
              clearTouchPress();
              cancelHoverHide();
              if (longPressResetTimer != null) {
                clearTimeout(longPressResetTimer);
                longPressResetTimer = null;
              }
              linkControllers.delete(editor);
              hostTracker.destroy();
              document.removeEventListener("nf:edit-link-block", onEditBlockEvent);
              document.removeEventListener("pointerdown", onOutsidePointer, true);
              window.removeEventListener("resize", onViewport);
              window.removeEventListener("scroll", onViewport, true);
              window.visualViewport?.removeEventListener("resize", onViewport);
              view.dom.removeEventListener("mouseover", onDomMouseOver);
              view.dom.removeEventListener("mouseout", onDomMouseOut);
              view.dom.removeEventListener("pointerdown", onDomPointerDown);
              view.dom.removeEventListener("pointermove", onDomPointerMove);
              view.dom.removeEventListener("pointerup", onDomPointerEnd);
              view.dom.removeEventListener("pointercancel", onDomPointerEnd);
              view.dom.removeEventListener("contextmenu", onDomContextMenu);
              view.dom.removeEventListener("keydown", onDomKeydown);
              view.dom.removeEventListener("click", onClickLink);
              hoverBar.remove();
              popover.remove();
            },
          };
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
            if (payload.kind === "url") {
              const { from, to, empty, $from } = editor.state.selection;
              if (!empty && $from.parent.isTextblock) {
                const applied = editor
                  .chain()
                  .command(({ tr }) => {
                    closeHistory(tr);
                    const mark = editor.state.schema.marks.webLink.create({ href: payload.url, display: "inline" });
                    tr.addMark(from, to, mark);
                    closeHistory(tr);
                    return true;
                  })
                  .run();
                if (applied) event.preventDefault();
                return applied;
              }

              const title = linkDisplayTitle(payload.url);
              const linkHtml = `<a href="${escapeAttrHtml(payload.url)}" data-link-display="inline">${escapeAttrHtml(title)}</a>`;
              editor.commands.command(({ tr }) => {
                closeHistory(tr);
                return true;
              });
              const inserted = editor.commands.insertContent(linkHtml);
              if (inserted) {
                editor.commands.command(({ tr }) => {
                  closeHistory(tr);
                  return true;
                });
                event.preventDefault();
                const linkRange = findLinkRangeAtPos(editor.state.doc, editor.state.selection.from);
                if (linkRange) {
                  let anchorEl = null;
                  try {
                    const domPos = editor.view.domAtPos(Math.min(linkRange.from + 1, editor.state.doc.content.size));
                    const baseEl = domPos.node?.nodeType === 1 ? domPos.node : domPos.node?.parentElement;
                    anchorEl = baseEl?.closest?.("a.nf-link") || null;
                  } catch {
                    anchorEl = null;
                  }
                  linkControllers.get(editor)?.open(linkRange, anchorEl, { compact: true });
                }
              }
              return inserted;
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

export function openLinkEditor(editor, { defaultMode = "inline" } = {}) {
  if (!editor || !editor.isEditable) return false;
  const ctrl = linkControllers.get(editor);
  if (!ctrl) return false;

  const { selection, doc } = editor.state;
  if (selection instanceof NodeSelection && selection.node.type.name === "webBookmark") {
    const attrs = selection.node.attrs;
    ctrl.open({
      kind: "block",
      pos: selection.from,
      url: attrs.url || "",
      title: attrs.title || "",
      description: attrs.description || "",
      mode: attrs.variant === "card" ? "card" : "bookmark",
      existing: true,
    });
    return true;
  }

  const existingInline = findLinkRangeAtPos(doc, selection.from);
  if (existingInline) {
    ctrl.open(existingInline);
    return true;
  }

  const selectedText = !selection.empty ? doc.textBetween(selection.from, selection.to, " ", " ") : "";
  ctrl.open({
    kind: "inline",
    from: selection.from,
    to: selection.to,
    url: "",
    title: selectedText,
    description: "",
    mode: defaultMode,
    existing: false,
  });
  return true;
}

export function insertMathFormula(editor) {
  if (!editor || !editor.isEditable) return false;
  const linkCtrl = linkControllers.get(editor);
  if (linkCtrl?.isOpen()) linkCtrl.close({ focusEditor: false });

  const { from, to, empty, $from } = editor.state.selection;
  const selected =
    !empty && $from.sameParent(editor.state.selection.$to)
      ? editor.state.doc.textBetween(from, to, " ", " ").trim()
      : "";
  const latex = selected || "x";
  const core = `$${latex}$`;
  const charBefore = from > $from.start() ? editor.state.doc.textBetween(from - 1, from, "", "") : "";
  const charAfter = to < $from.end() ? editor.state.doc.textBetween(to, to + 1, "", "") : "";
  const padLeft = /[0-9A-Za-zÀ-ÿ]/.test(charBefore) ? " " : "";
  const padRight = /[0-9A-Za-zÀ-ÿ]/.test(charAfter) ? " " : "";
  const raw = `${padLeft}${core}${padRight}`;
  const insertAt = from + padLeft.length;
  const endPos = insertAt + core.length;

  const inserted = editor
    .chain()
    .focus()
    .command(({ tr }) => {
      closeHistory(tr);
      tr.insertText(raw, from, to);
      tr.setSelection(TextSelection.create(tr.doc, Math.min(endPos, tr.doc.content.size)));
      closeHistory(tr);
      return true;
    })
    .run();

  if (!inserted) return false;
  const entry = collectMathEntries(editor.state.doc).find((item) => item.from === insertAt && item.to === endPos);
  if (entry) {
    mathControllers.get(editor)?.open(entry, null, { selectAll: !selected });
  }
  return true;
}

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
    WebLink,
    WebBookmark,
    Placeholder.configure({ placeholder }),
    RichClipboard,
    MathLivePreview,
    LinkInteractions,
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
export const LINK_BTN_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
export const MATH_BTN_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6H7l6 6-6 6h11"/></svg>`;

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
  { key: "link", label: "Enlace", html: LINK_BTN_SVG },
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
  for (const b of BUBBLE_BUTTONS) {
    state[b.key] =
      b.key === "link" ? editor.isActive("webLink") || editor.isActive("webBookmark") : editor.isActive(b.key);
  }
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
  if (key === "link") {
    openLinkEditor(editor);
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
