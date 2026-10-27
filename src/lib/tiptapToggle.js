import { Node, mergeAttributes } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import { Plugin, TextSelection } from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";

export const TOGGLE_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg>';

function enterToggle(editor) {
  const { state } = editor;
  const { $from, empty } = state.selection;
  if (!empty) return false;
  if ($from.parent.type.name === "toggleSummary") {
    const start = $from.before($from.depth - 1);
    const toggle = $from.node($from.depth - 1);
    editor.commands.command(({ tr }) => {
      tr.setSelection(TextSelection.near(tr.doc.resolve(start + 2 + toggle.firstChild.nodeSize)));
      return true;
    });
    return true;
  }
  if ($from.parent.type.name !== "paragraph" || $from.parent.content.size || $from.depth < 3) return false;
  const body = $from.node($from.depth - 1);
  if (body.type.name !== "toggleContent" || $from.index($from.depth - 1) !== body.childCount - 1) return false;
  const end = $from.after($from.depth - 2);
  const tr = state.tr;
  if (body.childCount > 1) tr.delete($from.before(), $from.after());
  const pos = tr.mapping.map(end);
  tr.insert(pos, state.schema.nodes.paragraph.create());
  editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, pos + 1)).scrollIntoView());
  return true;
}

export const ToggleSummary = Node.create({
  name: "toggleSummary",
  content: "inline*",
  defining: true,
  parseHTML: () => [{ tag: "summary" }],
  renderHTML: ({ HTMLAttributes }) => ["summary", mergeAttributes(HTMLAttributes, { "data-type": "toggle-summary" }), 0],
  addNodeView() {
    return () => {
      const dom = document.createElement("div");
      dom.className = "nf-toggle-summary";
      dom.dataset.type = "toggle-summary";
      dom.dataset.placeholder = "Desplegable";
      return { dom, contentDOM: dom };
    };
  },
});

export const ToggleContent = Node.create({
  name: "toggleContent",
  content: "block+",
  defining: true,
  parseHTML: () => [{ tag: 'div[data-type="toggle-content"]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "toggle-content" }), 0],
});

export const Toggle = Node.create({
  name: "toggle",
  group: "block",
  content: "toggleSummary toggleContent",
  defining: true,
  isolating: true,
  parseHTML: () => [{ tag: 'details[data-type="toggle"]' }],
  renderHTML: ({ HTMLAttributes }) => ["details", mergeAttributes(HTMLAttributes, { "data-type": "toggle" }), 0],
  addCommands() {
    return {
      insertToggle: () => ({ chain, state }) => {
        // Desde un título, insertar después del bloque completo; nunca dividir
        // su estructura obligatoria ni absorber el contenido existente.
        const { $from } = state.selection;
        const position = $from.parent.type.name === "toggleSummary" ? $from.after($from.depth - 1) : state.selection.to;
        return chain().insertContentAt(position, { type: "toggle", content: [
          { type: "toggleSummary" }, { type: "toggleContent", content: [{ type: "paragraph" }] },
        ] }).command(({ tr }) => {
          const { $from } = tr.selection;
          for (let depth = $from.depth; depth > 0; depth--) {
            if ($from.node(depth).type.name !== "toggle") continue;
            tr.setSelection(TextSelection.create(tr.doc, $from.before(depth) + 2));
            break;
          }
          return true;
        }).run();
      },
      convertToToggle: () => ({ state, dispatch }) => {
        const range = state.selection.$from.blockRange(state.selection.$to);
        if (!range || !range.parent.canReplaceWith(range.startIndex, range.endIndex, this.type)) return false;
        const selected = [];
        for (let i = range.startIndex; i < range.endIndex; i++) selected.push(range.parent.child(i));
        const title = selected[0]?.isTextblock ? selected.shift().content : Fragment.empty;
        const body = selected.length ? selected : [state.schema.nodes.paragraph.create()];
        const node = this.type.create(null, [state.schema.nodes.toggleSummary.create(null, title), state.schema.nodes.toggleContent.create(null, body)]);
        if (dispatch) {
          const tr = closeHistory(state.tr).replaceWith(range.start, range.end, node);
          dispatch(tr.setSelection(TextSelection.create(tr.doc, range.start + 2)).scrollIntoView());
        }
        return true;
      },
      unwrapToggle: () => ({ state, dispatch }) => {
        const { $from } = state.selection;
        for (let depth = $from.depth; depth > 0; depth--) {
          const node = $from.node(depth);
          if (node.type !== this.type) continue;
          const start = $from.before(depth);
          const children = Fragment.from(state.schema.nodes.paragraph.create(null, node.firstChild.content)).append(node.lastChild.content);
          if (dispatch) {
            const tr = state.tr.replaceWith(start, start + node.nodeSize, children);
            dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(start + 1))).scrollIntoView());
          }
          return true;
        }
        return false;
      },
    };
  },
  addKeyboardShortcuts() {
    return {
      Enter: () => enterToggle(this.editor),
      Backspace: () => {
        const { $from, empty } = this.editor.state.selection;
        return empty && $from.parent.type.name === "toggleSummary" && $from.parentOffset === 0
          ? this.editor.commands.unwrapToggle() : false;
      },
    };
  },
  addProseMirrorPlugins() {
    return [new Plugin({ props: { handleDOMEvents: {
      // Algunos teclados móviles envían beforeinput sin keydown.
      beforeinput: (_view, event) => {
        if (event.inputType !== "insertParagraph" || event.isComposing || !event.cancelable || !enterToggle(this.editor)) return false;
        event.preventDefault();
        return true;
      },
    } } })];
  },
  addNodeView() {
    return ({ editor, getPos }) => {
      const dom = document.createElement("div");
      dom.className = "nf-toggle is-open";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ac-toggle-arrow";
      button.contentEditable = "false";
      button.innerHTML = TOGGLE_ICON;
      button.setAttribute("aria-label", "Contraer desplegable");
      button.setAttribute("aria-expanded", "true");
      const contentDOM = document.createElement("div");
      contentDOM.className = "nf-toggle-inner";
      dom.append(button, contentDOM);
      const setOpen = (open) => {
        dom.classList.toggle("is-open", open);
        button.setAttribute("aria-expanded", String(open));
        button.setAttribute("aria-label", open ? "Contraer desplegable" : "Expandir desplegable");
        dom.closest(".nf-root")?.dispatchEvent(new Event("nf:viewport"));
      };
      const revealSelection = () => {
        const pos = getPos();
        const node = typeof pos === "number" && editor.state.doc.nodeAt(pos);
        if (node && editor.state.selection.from > pos + node.firstChild.nodeSize && editor.state.selection.from < pos + node.nodeSize) setOpen(true);
      };
      editor.on("selectionUpdate", revealSelection);
      button.addEventListener("pointerdown", (event) => event.preventDefault());
      button.addEventListener("click", (event) => {
        event.preventDefault(); event.stopPropagation();
        const open = !dom.classList.contains("is-open");
        const pos = getPos();
        const node = typeof pos === "number" && editor.state.doc.nodeAt(pos);
        if (!open && node && editor.state.selection.from > pos + node.firstChild.nodeSize && editor.state.selection.from < pos + node.nodeSize) {
          editor.commands.setTextSelection(pos + node.firstChild.nodeSize);
        }
        setOpen(open);
      });
      return { dom, contentDOM, stopEvent: (event) => button.contains(event.target),
        destroy: () => editor.off("selectionUpdate", revealSelection),
        ignoreMutation: (mutation) => mutation.type !== "selection" && !contentDOM.contains(mutation.target) };
    };
  },
});
