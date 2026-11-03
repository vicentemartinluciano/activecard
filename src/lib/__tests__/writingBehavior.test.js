/** @jest-environment jsdom */
import { Editor } from "@tiptap/core";
import { buildExtensions, applyFormat, currentFormat, runBubbleAction, canStructureAction } from "../editorSetup";
import { htmlToMarks, marksToHtml } from "../richhtml";

let editor;
const details = (summary, body = "<p>Anterior</p>") => `<details data-type="toggle"><summary>${summary}</summary><div data-type="toggle-content">${body}</div></details>`;
const key = (name, modifiers = {}) => !!editor.view.someProp("handleKeyDown", handler => handler(editor.view, new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...modifiers })));
const select = (text, offset = 0, length = 0) => {
  let position;
  editor.state.doc.descendants((node, pos) => { if (position == null && node.isTextblock && node.textContent === text) position = pos + 1 + offset; });
  if (position == null) throw new Error(`No se encontró ${text}`);
  editor.commands.setTextSelection({ from: position, to: position + length });
};
const load = html => editor.chain().setContent(html).command(({ tr }) => { tr.setMeta("addToHistory", false); return true; }).run();
const reopen = () => { const saved = htmlToMarks(editor.getHTML()); editor.commands.setContent(marksToHtml(saved)); return saved; };
const input = (inputType, extra = {}) => {
  const event = new InputEvent("beforeinput", { inputType, bubbles: true, cancelable: true, ...extra });
  editor.view.dom.dispatchEvent(event);
  return event.defaultPrevented;
};
beforeEach(() => {
  window.scrollBy = jest.fn();
  const rect = { left: 0, right: 100, top: 0, bottom: 24, width: 100, height: 24 };
  Range.prototype.getBoundingClientRect = () => rect;
  Range.prototype.getClientRects = () => [rect];
  editor = new Editor({ extensions: buildExtensions(), content: "<p></p>" });
});
afterEach(() => { editor.state.doc.check(); editor.destroy(); });

test.each([0, 3, 6])("Enter divide el encabezado abierto en la posición %i y conserva estilos y cuerpo", offset => {
  load(details("<h2><strong>UnoDos</strong></h2>")); select("UnoDos", offset);
  const original = editor.getHTML();
  key("Enter");
  const toggle = editor.state.doc.firstChild;
  expect(toggle.firstChild.textContent).toBe("UnoDos".slice(0, offset));
  expect(toggle.lastChild.firstChild.type.name).toBe("paragraph");
  expect(toggle.lastChild.firstChild.textContent).toBe("UnoDos".slice(offset));
  expect(toggle.lastChild.lastChild.textContent).toBe("Anterior");
  if (offset < 6) expect(toggle.lastChild.firstChild.firstChild.marks[0].type.name).toBe("bold");
  const result = htmlToMarks(editor.getHTML());
  expect(editor.commands.undo()).toBe(true); expect(editor.getHTML()).toBe(original);
  expect(editor.commands.redo()).toBe(true); expect(htmlToMarks(editor.getHTML())).toBe(result);
  reopen(); expect(htmlToMarks(editor.getHTML())).toBe(result);
});
test("Enter con selección en el título reemplaza el rango y mueve el resto al cuerpo", () => {
  load(details("<h2>Uno QUITAR Dos</h2>")); select("Uno QUITAR Dos", 4, 7); key("Enter");
  expect(editor.state.doc.firstChild.firstChild.textContent).toBe("Uno ");
  expect(editor.state.doc.firstChild.lastChild.firstChild.textContent).toBe("Dos");
});
test.each(["<ul><li><p>UnoDos</p></li></ul>", "<blockquote><p>UnoDos</p><p>Otra línea</p></blockquote>"])("dividir un encabezado enriquecido mantiene un documento válido: %s", title => {
  load(details(title)); select("UnoDos", 3); key("Enter");
  expect(editor.state.doc.firstChild.firstChild.textContent).toBe("Uno");
  expect(editor.state.doc.firstChild.lastChild.textContent).toContain("Dos");
  const saved = reopen(); expect(htmlToMarks(editor.getHTML())).toBe(saved);
});
test("Enter cerrado divide en un hermano del mismo formato y conserva los dos cuerpos", () => {
  load(details("<h2>UnoDos</h2>")); select("UnoDos", 3);
  editor.view.dom.querySelector(".ac-toggle-arrow").click(); key("Enter");
  expect(editor.state.doc.child(0).firstChild.textContent).toBe("Uno");
  expect(editor.state.doc.child(0).lastChild.textContent).toBe("Anterior");
  expect(editor.state.doc.child(1).firstChild.firstChild.type.name).toBe("heading");
  expect(editor.state.doc.child(1).firstChild.textContent).toBe("Dos");
  expect(editor.state.doc.child(1).lastChild.textContent).toBe("");
  expect([...editor.view.dom.querySelectorAll(".ac-toggle-arrow")].map(button => button.getAttribute("aria-expanded"))).toEqual(["false", "false"]);
});
test("Shift+Enter permanece en el bloque y el salto interno sobrevive al reabrir", () => {
  load(details("<h2>UnoDos</h2>")); select("UnoDos", 3); key("Enter", { shiftKey: true });
  const saved = reopen();
  expect(editor.state.doc.firstChild.firstChild.childCount).toBe(1);
  expect(editor.getHTML()).toContain("Uno<br>Dos"); expect(htmlToMarks(editor.getHTML())).toBe(saved);
});
test.each(["Backspace", "Delete"])("%s une texto en el límite del desplegable y se deshace en una operación", operation => {
  load(details("<h2>Título</h2>", "<p><em>Detalle</em></p><p>Conservar</p>"));
  select(operation === "Backspace" ? "Detalle" : "Título", operation === "Backspace" ? 0 : 6);
  const original = editor.getHTML(); key(operation);
  expect(editor.state.doc.firstChild.firstChild.textContent).toBe("TítuloDetalle");
  expect(editor.state.doc.firstChild.lastChild.textContent).toBe("Conservar");
  editor.commands.undo(); expect(editor.getHTML()).toBe(original);
});
test("Delete desde el encabezado no elimina una tabla del cuerpo", () => {
  load(details("<p>Título</p>", "<table><tr><td><p>Celda</p></td></tr></table>"));
  select("Título", 6); key("Delete");
  expect(editor.getHTML()).toContain("<table"); expect(editor.state.doc.textContent).toBe("TítuloCelda");
});
test("borrar una selección entre título y cuerpo conserva el resto de la tarjeta", () => {
  load(details("<h2>UnoDos</h2>", "<p>TresCuatro</p><p>Conservar</p>") + "<p>Fuera</p>");
  select("UnoDos", 3); const from = editor.state.selection.from;
  select("TresCuatro", 4); const to = editor.state.selection.from;
  editor.commands.setTextSelection({ from, to }); key("Backspace");
  expect(editor.state.doc.textContent).toBe("UnoCuatroConservarFuera");
});
test("beforeinput móvil comparte Enter y borrado, respeta composición y admite salto interno", () => {
  load(details("<h2>UnoDos</h2>")); select("UnoDos", 3);
  const pos = editor.state.selection.from;
  expect(input("insertParagraph", { isComposing: true })).toBe(false);
  expect(editor.state.selection.from).toBe(pos);
  expect(input("insertParagraph")).toBe(true);
  expect(editor.state.doc.firstChild.firstChild.textContent).toBe("Uno");
  select("Dos"); expect(input("deleteContentBackward")).toBe(true);
  expect(editor.state.doc.firstChild.firstChild.textContent).toBe("UnoDos");
  select("UnoDos", 3); expect(input("insertLineBreak")).toBe(true);
  reopen(); expect(editor.getHTML()).toContain("Uno<br>Dos");
});
test("Ctrl+Enter pliega y despliega sin modificar el contenido", () => {
  load(details("<p>Título</p>")); select("Anterior"); const original = editor.getHTML();
  key("Enter", { ctrlKey: true });
  expect(editor.view.dom.querySelector(".ac-toggle-arrow").getAttribute("aria-expanded")).toBe("false");
  key("Enter", { ctrlKey: true });
  expect(editor.view.dom.querySelector(".ac-toggle-arrow").getAttribute("aria-expanded")).toBe("true");
  expect(editor.getHTML()).toBe(original);
});
test.each([[">", "toggle"], ['"', "blockquote"]])("%s y espacio crea el bloque esperado", (prefix, type) => {
  load(`<p>${prefix}</p>`); select(prefix, 1);
  editor.view.someProp("handleTextInput", handler => handler(editor.view, 2, 2, " "));
  expect(editor.state.doc.firstChild.type.name).toBe(type);
});
test("convertir un ítem conserva hermanos y la numeración original", () => {
  load('<ol start="4"><li><p>Uno</p></li><li><p>Dos</p></li><li><p>Tres</p></li></ol>');
  select("Dos"); applyFormat(editor, "toggle");
  expect(editor.state.doc.child(0).attrs.start).toBe(4);
  expect(editor.state.doc.child(1).firstChild.textContent).toBe("Dos");
  expect(editor.state.doc.child(1).firstChild.firstChild.attrs.start).toBe(5);
  expect(editor.state.doc.child(2).attrs.start).toBe(6);
  reopen(); expect(editor.state.doc.textContent).toBe("UnoDosTres");
});
test("la pill distingue formatos mezclados y quitar estilos respeta la estructura", () => {
  load(details("<h2><strong>Uno</strong></h2>", "<p><em>Dos</em></p>"));
  select("Uno"); const from = editor.state.selection.from; select("Dos", 3); const to = editor.state.selection.from;
  editor.commands.setTextSelection({ from, to });
  expect(currentFormat(editor)).toBe("mixed");
  runBubbleAction(editor, "clear");
  expect(editor.state.doc.firstChild.type.name).toBe("toggle");
  expect(editor.state.doc.firstChild.firstChild.firstChild.type.name).toBe("heading");
  expect(editor.getHTML()).not.toMatch(/<strong>|<em>/);
});
test("los controles de sangría mantienen la jerarquía al guardar y deshacer", () => {
  load("<ul><li><p>Uno</p></li><li><p>Dos</p></li></ul>"); select("Dos", 0, 3);
  expect(canStructureAction(editor, "indent")).toBe(true);
  runBubbleAction(editor, "indent"); const saved = reopen();
  expect(htmlToMarks(editor.getHTML())).toBe(saved);
  expect(editor.state.doc.firstChild.firstChild.child(1).type.name).toBe("bulletList");
  select("Dos", 0, 3); expect(canStructureAction(editor, "outdent")).toBe(true);
  runBubbleAction(editor, "outdent"); expect(editor.state.doc.firstChild.childCount).toBe(2);
});
test("Tab y los controles táctiles anidan y levantan desplegables conservando todo su contenido", () => {
  load(details("<h2>Padre</h2>", "<p>Detalle padre</p>") + details("<h3>Hijo</h3>", "<p>Detalle hijo</p>"));
  select("Hijo", 0, 4); const original = editor.getHTML();
  expect(canStructureAction(editor, "indent")).toBe(true); key("Tab");
  expect(editor.state.doc.firstChild.lastChild.lastChild.type.name).toBe("toggle");
  expect(editor.state.doc.firstChild.lastChild.lastChild.textContent).toBe("HijoDetalle hijo");
  editor.commands.undo(); expect(editor.getHTML()).toBe(original); editor.commands.redo();
  select("Hijo", 0, 4); expect(canStructureAction(editor, "outdent")).toBe(true);
  runBubbleAction(editor, "outdent"); expect(editor.getHTML()).toBe(original);
});
test.each(["bold", "clear", "heading2"])("deshacer %s no borra el texto recién escrito", action => {
  load("<p>Uno</p>"); select("Uno", 3); editor.commands.insertContent(" Dos");
  select("Uno Dos", 4, 3);
  if (action === "heading2") applyFormat(editor, action);
  else {
    if (action === "clear") { runBubbleAction(editor, "bold"); }
    runBubbleAction(editor, action);
  }
  editor.commands.undo(); expect(editor.state.doc.textContent).toBe("Uno Dos");
  expect(editor.state.doc.firstChild.type.name).toBe("paragraph");
  expect(editor.getHTML().includes("<strong>")).toBe(action === "clear");
});
