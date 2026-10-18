/** @jest-environment jsdom */
import { Editor } from "@tiptap/core";
import { CellSelection } from "@tiptap/pm/tables";
import { buildExtensions, mountTableToolbar } from "../editorSetup";
import { htmlToMarks, marksToHtml } from "../richhtml";

let editor, host, cleanup;
const tick = () => jest.advanceTimersByTime(32);
const cells = () => {
  const positions = [];
  editor.state.doc.descendants((node, pos) => {
    if (["cell", "header_cell"].includes(node.type.spec.tableRole)) positions.push(pos);
  });
  return positions;
};
const select = (index) => {
  editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cells()[index])));
  editor.view.focus();
  tick();
};
const action = (label) => host.querySelector(`[aria-label="${label}"]`).click();

beforeEach(() => {
  jest.useFakeTimers();
  window.scrollBy = jest.fn();
  window.ResizeObserver = class { observe() {} disconnect() {} };
  host = document.createElement("div");
  host.className = "nf-root";
  document.body.append(host);
  host.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, bottom: 500 });
  const mount = document.createElement("div");
  host.append(mount);
  editor = new Editor({ element: mount, extensions: buildExtensions(), content:
    '<table><tr><th colwidth="80"><p><strong>Plan</strong></p></th><th colwidth="280">Detalle</th></tr><tr><td colwidth="80">A</td><td colwidth="280">B</td></tr></table><p>Fuera</p>' });
  editor.view.coordsAtPos = () => ({ left: 20, right: 21, top: 100, bottom: 124 });
  cleanup = mountTableToolbar(editor, host);
  tick();
});
afterEach(() => { cleanup(); editor.destroy(); host.remove(); jest.useRealTimers(); });

test("celular amplía columnas para leer sin cambiar los anchos persistidos", () => {
  expect([...host.querySelectorAll("colgroup col")].map((col) => col.style.width)).toEqual(["200px", "280px"]);
  const saved = htmlToMarks(editor.getHTML());
  editor.commands.setContent(marksToHtml(saved));
  expect(editor.state.doc.firstChild.firstChild.firstChild.attrs.colwidth).toEqual([80]);
  expect(htmlToMarks(editor.getHTML())).toBe(saved);
  expect(host.querySelector("strong").textContent).toBe("Plan");
});

test("agregar/quitar filas y columnas mantiene texto y formato al reabrir", () => {
  select(3); action("Agregar fila");
  select(3); action("Agregar columna");
  expect(host.querySelectorAll("tr")).toHaveLength(3);
  expect(host.querySelector("tr").children).toHaveLength(3);
  select(5); action("Quitar columna");
  select(4); action("Quitar fila");
  const saved = htmlToMarks(editor.getHTML());
  editor.commands.setContent(marksToHtml(saved));
  expect(htmlToMarks(editor.getHTML())).toBe(saved);
  expect(host.querySelector("strong").textContent).toBe("Plan");
});

test("encabezados de fila y columna conservan la intersección y el contenido", () => {
  select(3); action("Más opciones de tabla"); action("Columna de encabezado"); tick();
  expect(host.querySelectorAll("th")).toHaveLength(3);
  action("Fila de encabezado"); tick();
  expect(host.querySelectorAll("th")).toHaveLength(2);
  expect(host.querySelector("strong").textContent).toBe("Plan");
});

test("los seis puntos abren opciones y Escape las cierra", () => {
  editor.commands.setTextSelection(cells()[0] + 2); editor.view.focus(); tick();
  action("Seleccionar tabla y abrir opciones"); tick();
  expect(host.querySelector(".nf-table-panel").hidden).toBe(false);
  expect(host.querySelector(".nf-table-options").hidden).toBe(false);
  host.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
  expect(host.querySelector(".nf-table-options").hidden).toBe(true);
});
