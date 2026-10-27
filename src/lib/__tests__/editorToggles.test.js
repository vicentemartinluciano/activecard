/** @jest-environment jsdom */
import { Editor } from "@tiptap/core";
import { buildExtensions, applyFormat } from "../editorSetup";
import { htmlToMarks, marksToHtml } from "../richhtml";
import { decodeToggle, encodeToggle, parseRich, toPlainText, TOGGLE_SENTINEL } from "../richtext";

const details = (summary, content) => `<details data-type="toggle"><summary>${summary}</summary><div data-type="toggle-content">${content}</div></details>`;
const key = (name) => editor.view.someProp("handleKeyDown", (handler) => handler(editor.view, new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true })));
let editor;
beforeEach(() => {
  window.scrollBy = jest.fn();
  editor = new Editor({ extensions: buildExtensions(), content: "<p></p>" });
});
afterEach(() => editor.destroy());

test("conserva título, formato, listas, imágenes, tablas y desplegables anidados al reabrir", () => {
  const html = details('<strong>Concepto</strong>', '<p><mark>Detalle</mark></p><ul><li><p>Primero</p></li></ul>' +
    '<img src="data:image/png;base64,AA==">' +
    '<table><tr><td><p>Celda</p>' + details("Dentro de tabla", "<p>Valor</p>") + '</td></tr></table>' + details("Más", "<p>Profundidad</p>"));
  editor.commands.setContent(html);
  const saved = htmlToMarks(editor.getHTML());
  expect(parseRich(saved)[0].type).toBe("toggle");
  editor.commands.setContent(marksToHtml(saved));
  expect(htmlToMarks(editor.getHTML())).toBe(saved);
  expect(toPlainText(saved)).toContain("Concepto\nDetalle\nPrimero");
  expect(toPlainText(saved)).toContain("Dentro de tabla\nValor");
  expect(toPlainText(saved)).toContain("Más\nProfundidad");
  expect(toPlainText(saved)).not.toMatch(/data:image|%7B|\uE031/);
  expect(editor.getHTML()).toContain("<strong>Concepto</strong>");
  expect(editor.getHTML()).toContain("<mark>Detalle</mark>");
});

test("convertir selección usa el primer bloque como título y conserva el resto como contenido; deshacer restaura", () => {
  editor.commands.setContent("<p><strong>Título</strong></p><p>Detalle</p><p>Fuera</p>");
  editor.commands.setTextSelection({ from: 1, to: 16 });
  applyFormat(editor, "toggle");
  const toggle = editor.state.doc.firstChild;
  expect(toggle.type.name).toBe("toggle");
  expect(toggle.firstChild.textContent).toBe("Título");
  expect(toggle.lastChild.textContent).toBe("Detalle");
  expect(editor.state.doc.lastChild.textContent).toBe("Fuera");
  expect(editor.commands.undo()).toBe(true);
  expect(editor.state.doc.firstChild.type.name).toBe("paragraph");
  expect(editor.state.doc.textContent).toBe("TítuloDetalleFuera");
});

test("se puede crear vacío, entrar al contenido y salir con Enter sin eliminar el bloque", () => {
  editor.commands.insertToggle();
  expect(editor.state.selection.$from.parent.type.name).toBe("toggleSummary");
  const positions = [];
  editor.state.doc.descendants((node, pos) => { if (node.type.name === "toggleSummary") positions.push(pos + 1); });
  editor.commands.setTextSelection(positions[0]);
  editor.commands.insertContent("Título");
  expect(key("Enter")).toBe(true);
  expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
  expect(editor.state.selection.$from.node(editor.state.selection.$from.depth - 1).type.name).toBe("toggleContent");
  key("Enter");
  expect(editor.state.selection.$from.depth).toBe(1);
  expect(editor.state.doc.firstChild.type.name).toBe("toggle");
});

test("insertar desde título crea un hermano y desde el cuerpo permite anidar", () => {
  editor.commands.setContent("<p>Título</p><p>Detalle</p>");
  editor.commands.setTextSelection({ from: 1, to: 5 });
  editor.commands.insertToggle();
  expect(editor.state.doc.textContent).toBe("TítuloDetalle");
  editor.commands.setContent(details("Título", "<p>Detalle</p>"));
  editor.commands.setTextSelection(2);
  editor.commands.insertToggle();
  expect(editor.state.doc.child(0).textContent).toBe("TítuloDetalle");
  expect(editor.state.doc.child(1).type.name).toBe("toggle");
  expect(editor.state.selection.$from.parent.type.name).toBe("toggleSummary");
  key("Enter");
  editor.commands.insertToggle();
  expect(editor.state.selection.$from.node(1).lastChild.firstChild.type.name).toBe("toggle");
});

test("beforeinput móvil entra al contenido de tabla sin duplicar Enter", () => {
  editor.commands.setContent(details("Título", "<table><tr><td><p>Celda</p></td></tr></table>"));
  editor.commands.setTextSelection(2);
  const event = new InputEvent("beforeinput", { inputType: "insertParagraph", bubbles: true, cancelable: true });
  editor.view.dom.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
  expect(editor.state.selection.$from.parent.textContent).toBe("Celda");
  expect(editor.state.selection.$from.parentOffset).toBe(0);
});

test("contraer es solo visual: no modifica contenido ni historial y retira el cursor del contenido oculto", () => {
  editor.commands.setContent(details("Título", "<p>Detalle</p>"));
  let bodyPos;
  editor.state.doc.descendants((node, pos) => { if (node.type.name === "paragraph" && node.textContent === "Detalle") bodyPos = pos + 2; });
  editor.commands.setTextSelection(bodyPos);
  const saved = htmlToMarks(editor.getHTML());
  const change = jest.fn(); editor.on("update", change);
  const button = editor.view.dom.querySelector(".ac-toggle-arrow");
  button.click();
  expect(button.getAttribute("aria-expanded")).toBe("false");
  expect(editor.state.selection.$from.parent.type.name).toBe("toggleSummary");
  expect(htmlToMarks(editor.getHTML())).toBe(saved);
  expect(change).not.toHaveBeenCalled();
  button.click();
  expect(button.getAttribute("aria-expanded")).toBe("true");
});

test("convertir a Texto y Backspace al inicio preservan el contenido", () => {
  const source = details("Título", "<p>Detalle</p>" + details("Anidado", "<p>Más</p>"));
  for (const action of [() => applyFormat(editor, "paragraph"), () => key("Backspace")]) {
    editor.commands.setContent(source);
    editor.commands.setTextSelection(2);
    action();
    expect(editor.state.doc.firstChild.type.name).toBe("paragraph");
    expect(toPlainText(htmlToMarks(editor.getHTML()))).toBe("Título\nDetalle\nAnidado\nMás");
  }
});

test("datos vacíos y dañados no se interpretan como estructuras válidas", () => {
  const empty = encodeToggle("", "");
  expect(decodeToggle(empty)).toEqual({ summary: "", content: "" });
  expect(htmlToMarks(marksToHtml(empty))).toBe(empty);
  for (const value of [TOGGLE_SENTINEL + "%broken", TOGGLE_SENTINEL + encodeURIComponent('{"summary":2,"content":"a"}')]) {
    expect(decodeToggle(value)).toBeNull();
    expect(parseRich(value)[0].type).toBe("p");
  }
});
