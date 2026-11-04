import { Node, mergeAttributes, InputRule } from "@tiptap/core";
import { DOMParser, Fragment, NodeRange, Slice } from "@tiptap/pm/model";
import { Plugin, TextSelection } from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";

export const TOGGLE_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg>';

export function toggleSummaryDepth($pos) {
  for (let depth = $pos.depth; depth > 0; depth--)
    if ($pos.node(depth).type.name === "toggleSummary") return depth;
  return null;
}

const firstTitlePosition = (doc, start) => TextSelection.near(doc.resolve(start + 2)).from;

function setOpen(editor, pos, open) {
  editor.view.nodeDOM(pos)?.dispatchEvent(new CustomEvent("ac:toggle-open", { detail: open }));
}

function paragraphTail(fragment, schema) {
  const children = [];
  fragment.forEach((node, _offset, index) => children.push(index === 0 && node.type.name === "heading" ? schema.nodes.paragraph.create(null, node.content) : node));
  return Fragment.from(children.length ? children : schema.nodes.paragraph.create());
}

function enterToggle(editor) {
  const { state } = editor;
  const { $from, $to, empty } = state.selection;
  const summaryDepth = toggleSummaryDepth($from);
  if (summaryDepth != null) {
    if (toggleSummaryDepth($to) !== summaryDepth || $from.before(summaryDepth) !== $to.before(summaryDepth)) return false;
    const start = $from.before(summaryDepth - 1);
    const wasOpen = editor.view.nodeDOM(start)?.classList.contains("is-open") !== false;
    const tr = closeHistory(state.tr).deleteSelection();
    const $cursor = tr.selection.$from;
    const toggle = $cursor.node(summaryDepth - 1), summary = toggle.firstChild, body = toggle.lastChild;
    const offset = $cursor.pos - $cursor.start(summaryDepth);
    const prefix = summary.copy(summary.content.cut(0, offset));
    const suffix = summary.content.cut(offset);
    let cursor;
    if (wasOpen) {
      const tail = paragraphTail(suffix, state.schema);
      const emptyBody = body.childCount === 1 && body.firstChild.type.name === "paragraph" && !body.firstChild.content.size;
      const nextBody = body.copy(emptyBody ? tail : tail.append(body.content));
      tr.replaceWith(start, start + toggle.nodeSize, toggle.copy(Fragment.from([prefix, nextBody])));
      cursor = TextSelection.near(tr.doc.resolve(start + prefix.nodeSize + 2)).from;
    } else {
      const nextSummary = summary.copy(suffix.size ? suffix : Fragment.from(state.schema.nodes.paragraph.create()));
      const previous = toggle.copy(Fragment.from([prefix, body]));
      const next = toggle.type.create(toggle.attrs, [nextSummary, body.type.create(null, state.schema.nodes.paragraph.create())]);
      tr.replaceWith(start, start + toggle.nodeSize, Fragment.from([previous, next]));
      cursor = firstTitlePosition(tr.doc, start + previous.nodeSize);
    }
    editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, cursor)).scrollIntoView());
    if (!wasOpen) {
      setOpen(editor, start, false);
      const previous = editor.state.doc.nodeAt(start);
      setOpen(editor, start + previous.nodeSize, false);
    }
    return true;
  }
  if (!empty) return false;
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

// Unir únicamente texto en el límite encabezado/cuerpo. Tablas, imágenes y
// límites de celdas mantienen sus operaciones propias.
function joinToggleText(editor, backwards) {
  const { state } = editor;
  const { $from, empty } = state.selection;
  if (!empty || !$from.parent.isTextblock) return false;
  let depth;
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === "toggle") { depth = d; break; }
  if (depth == null) return false;
  const toggle = $from.node(depth), summary = toggle.firstChild, body = toggle.lastChild;
  if (body.firstChild.type.name !== "paragraph") return false;
  const start = $from.before(depth);
  let lastEnd;
  summary.descendants((node, pos) => { if (node.isTextblock) lastEnd = pos + 1 + node.content.size; });
  if (lastEnd == null) return false;
  const titleEnd = start + 2 + lastEnd;
  const bodyStart = start + summary.nodeSize + 3;
  if (backwards ? $from.pos !== bodyStart : $from.pos !== titleEnd) return false;
  const nextSummary = summary.replace(lastEnd, lastEnd, new Slice(body.firstChild.content, 0, 0));
  const remaining = body.content.cut(body.firstChild.nodeSize);
  const nextBody = body.copy(remaining.size ? remaining : Fragment.from(state.schema.nodes.paragraph.create()));
  const tr = closeHistory(state.tr).replaceWith(start, start + toggle.nodeSize, toggle.copy(Fragment.from([nextSummary, nextBody])));
  editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, titleEnd)).scrollIntoView());
  return true;
}

function indentToggle(state, dispatch, outdent) {
  const { $from, to, anchor, head } = state.selection;
  const summaryDepth = toggleSummaryDepth($from);
  if (summaryDepth == null) return false;
  const depth = summaryDepth - 1, node = $from.node(depth), start = $from.before(depth);
  if (to >= start + node.nodeSize) return false;
  let replaceFrom, replaceTo, replacement, destination;
  if (outdent) {
    if (depth < 3 || $from.node(depth - 1).type.name !== "toggleContent" || $from.node(depth - 2).type.name !== "toggle") return false;
    const body = $from.node(depth - 1), outer = $from.node(depth - 2), index = $from.index(depth - 1);
    const kept = [];
    body.forEach((child, _offset, i) => { if (i !== index) kept.push(child); });
    const nextBody = body.copy(Fragment.from(kept.length ? kept : state.schema.nodes.paragraph.create()));
    const nextOuter = outer.copy(Fragment.from([outer.firstChild, nextBody]));
    replaceFrom = $from.before(depth - 2); replaceTo = replaceFrom + outer.nodeSize;
    replacement = Fragment.from([nextOuter, node]); destination = replaceFrom + nextOuter.nodeSize;
    const parent = $from.node(depth - 3), outerIndex = $from.index(depth - 3);
    if (!parent.canReplace(outerIndex, outerIndex + 1, replacement)) return false;
  } else {
    const parent = $from.node(depth - 1), index = $from.index(depth - 1);
    const previous = index > 0 && parent.child(index - 1);
    if (!previous || previous.type.name !== "toggle") return false;
    const body = previous.lastChild;
    const placeholder = body.childCount === 1 && body.firstChild.type.name === "paragraph" && !body.firstChild.content.size;
    const kept = placeholder ? Fragment.empty : body.content;
    const merged = previous.copy(Fragment.from([previous.firstChild, body.copy(kept.append(Fragment.from(node)))]));
    replacement = Fragment.from(merged); replaceFrom = start - previous.nodeSize; replaceTo = start + node.nodeSize;
    if (!parent.canReplace(index - 1, index + 1, replacement)) return false;
    destination = replaceFrom + previous.firstChild.nodeSize + 2 + kept.size;
  }
  if (dispatch) {
    const tr = closeHistory(state.tr).replaceWith(replaceFrom, replaceTo, replacement);
    dispatch(tr.setSelection(TextSelection.create(tr.doc, destination + anchor - start, destination + head - start)).scrollIntoView());
  }
  return true;
}

export const ToggleSummary = Node.create({
  name: "toggleSummary",
  content: "(paragraph | heading | bulletList | orderedList | blockquote)+",
  defining: true,
  // Los desplegables anteriores tenían texto inline en <summary>. El parser
  // lo envuelve en un párrafo y conserva sus marcas, sin modificar los datos.
  parseHTML: () => [{ tag: "summary", getContent: (element, schema) => DOMParser.fromSchema(schema).parse(element).content }],
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
  priority: 300,
  group: "block",
  content: "toggleSummary toggleContent",
  defining: true,
  isolating: true,
  parseHTML: () => [{ tag: 'details[data-type="toggle"]' }],
  renderHTML: ({ HTMLAttributes }) => ["details", mergeAttributes(HTMLAttributes, { "data-type": "toggle" }), 0],
  addCommands() {
    return {
      indentToggle: () => ({ state, dispatch }) => indentToggle(state, dispatch, false),
      outdentToggle: () => ({ state, dispatch }) => indentToggle(state, dispatch, true),
      insertToggle: () => ({ chain, state }) => {
        // Desde un título, insertar después del bloque completo; nunca dividir
        // su estructura obligatoria ni absorber el contenido existente.
        const { $from } = state.selection;
        const summaryDepth = toggleSummaryDepth($from);
        const position = summaryDepth != null ? $from.after(summaryDepth - 1) : state.selection.to;
        return chain().insertContentAt(position, { type: "toggle", content: [
          { type: "toggleSummary", content: [{ type: "paragraph" }] }, { type: "toggleContent", content: [{ type: "paragraph" }] },
        ] }).command(({ tr }) => {
          const { $from } = tr.selection;
          for (let depth = $from.depth; depth > 0; depth--) {
            if ($from.node(depth).type.name !== "toggle") continue;
            tr.setSelection(TextSelection.create(tr.doc, firstTitlePosition(tr.doc, $from.before(depth))));
            break;
          }
          return true;
        }).run();
      },
      convertToToggle: () => ({ state, dispatch }) => {
        const { $from, $to } = state.selection;
        if (toggleSummaryDepth($from) != null) return false;
        let range = $from.blockRange($to);
        // El rango de ítems se convierte por separado para no absorber hermanos.
        if (range?.parent.type.name === "listItem") range = new NodeRange($from, $to, range.depth - 1);
        if (["bulletList", "orderedList"].includes(range?.parent.type.name)) {
          const list = range.parent, listStart = $from.before(range.depth);
          const before = [], chosen = [], after = [];
          list.forEach((item, _offset, index) => (index < range.startIndex ? before : index < range.endIndex ? chosen : after).push(item));
          const replacement = [];
          if (before.length) replacement.push(list.copy(Fragment.from(before)));
          const selectedList = list.type.create({ ...list.attrs, ...(list.type.name === "orderedList" ? { start: list.attrs.start + range.startIndex } : {}) }, chosen);
          const node = this.type.create(null, [state.schema.nodes.toggleSummary.create(null, selectedList), state.schema.nodes.toggleContent.create(null, state.schema.nodes.paragraph.create())]);
          replacement.push(node);
          if (after.length) replacement.push(list.type.create({ ...list.attrs, ...(list.type.name === "orderedList" ? { start: list.attrs.start + range.endIndex } : {}) }, after));
          // Un desplegable dentro de un listItem tiene que conservar su párrafo
          // inicial obligatorio. En ese caso, levantar el ítem es más seguro.
          const parent = $from.node(range.depth - 1);
          if (!parent.canReplace($from.index(range.depth - 1), $from.index(range.depth - 1) + 1, Fragment.from(replacement))) return false;
          if (dispatch) {
            const tr = closeHistory(state.tr).replaceWith(listStart, listStart + list.nodeSize, replacement);
            const pos = listStart + (before.length ? replacement[0].nodeSize : 0);
            dispatch(tr.setSelection(TextSelection.create(tr.doc, firstTitlePosition(tr.doc, pos))).scrollIntoView());
          }
          return true;
        }
        // Una lista/cita es parte del formato del encabezado, no un envoltorio
        // externo que se pueda perder al serializar el desplegable.
        while (range?.depth > 0 && ["listItem", "bulletList", "orderedList", "blockquote"].includes(range.parent.type.name))
          range = new NodeRange($from, $to, range.depth - 1);
        if (!range || !range.parent.canReplaceWith(range.startIndex, range.endIndex, this.type)) return false;
        const selected = [];
        for (let i = range.startIndex; i < range.endIndex; i++) selected.push(range.parent.child(i));
        const title = ["paragraph", "heading", "bulletList", "orderedList", "blockquote"].includes(selected[0]?.type.name)
          ? selected.shift() : state.schema.nodes.paragraph.create();
        const body = selected.length ? selected : [state.schema.nodes.paragraph.create()];
        const node = this.type.create(null, [state.schema.nodes.toggleSummary.create(null, title), state.schema.nodes.toggleContent.create(null, body)]);
        if (dispatch) {
          const tr = closeHistory(state.tr).replaceWith(range.start, range.end, node);
          dispatch(tr.setSelection(TextSelection.create(tr.doc, firstTitlePosition(tr.doc, range.start))).scrollIntoView());
        }
        return true;
      },
      unwrapToggle: () => ({ state, dispatch }) => {
        const { $from } = state.selection;
        for (let depth = $from.depth; depth > 0; depth--) {
          const node = $from.node(depth);
          if (node.type !== this.type) continue;
          const start = $from.before(depth);
          const body = node.lastChild;
          const emptyBody = body.childCount === 1 && body.firstChild.type.name === "paragraph" && !body.firstChild.content.size;
          const children = emptyBody ? node.firstChild.content : node.firstChild.content.append(body.content);
          if (dispatch) {
            const tr = closeHistory(state.tr).replaceWith(start, start + node.nodeSize, children);
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
      Enter: () => !this.editor.view.composing && enterToggle(this.editor),
      Tab: () => this.editor.commands.indentToggle(),
      "Shift-Tab": () => this.editor.commands.outdentToggle(),
      "Mod-Enter": () => {
        const { $from } = this.editor.state.selection;
        for (let depth = $from.depth; depth > 0; depth--) {
          if ($from.node(depth).type.name !== "toggle") continue;
          const pos = $from.before(depth);
          setOpen(this.editor, pos, !this.editor.view.nodeDOM(pos)?.classList.contains("is-open"));
          return true;
        }
        return false;
      },
      Delete: () => joinToggleText(this.editor, false),
      Backspace: () => {
        const { $from, empty } = this.editor.state.selection;
        const depth = toggleSummaryDepth($from);
        return empty && depth != null && $from.pos === firstTitlePosition($from.doc, $from.before(depth - 1))
          ? this.editor.commands.unwrapToggle() : joinToggleText(this.editor, true);
      },
    };
  },
  addInputRules() {
    return [new InputRule({ find: /^>\s$/, handler: ({ range, chain }) => chain().deleteRange(range).convertToToggle().run() })];
  },
  addProseMirrorPlugins() {
    return [new Plugin({ props: { handleDOMEvents: {
      // Algunos teclados móviles envían beforeinput sin keydown.
      beforeinput: (_view, event) => {
        if (event.isComposing || !event.cancelable) return false;
        const handled = event.inputType === "insertParagraph" ? enterToggle(this.editor)
          : event.inputType === "deleteContentBackward" ? joinToggleText(this.editor, true)
            : event.inputType === "deleteContentForward" ? joinToggleText(this.editor, false) : false;
        if (!handled) return false;
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
        const pos = getPos();
        const node = typeof pos === "number" && editor.state.doc.nodeAt(pos);
        if (!open && node && editor.state.selection.to > pos + node.firstChild.nodeSize && editor.state.selection.from < pos + node.nodeSize)
          editor.commands.setTextSelection(TextSelection.near(editor.state.doc.resolve(pos + node.firstChild.nodeSize), -1).from);
        dom.classList.toggle("is-open", open);
        button.setAttribute("aria-expanded", String(open));
        button.setAttribute("aria-label", open ? "Contraer desplegable" : "Expandir desplegable");
        dom.closest(".nf-root")?.dispatchEvent(new Event("nf:viewport"));
      };
      dom.addEventListener("ac:toggle-open", event => setOpen(event.detail));
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
        setOpen(open);
      });
      return { dom, contentDOM, stopEvent: (event) => button.contains(event.target),
        destroy: () => editor.off("selectionUpdate", revealSelection),
        ignoreMutation: (mutation) => mutation.type !== "selection" && !contentDOM.contains(mutation.target) };
    };
  },
});
