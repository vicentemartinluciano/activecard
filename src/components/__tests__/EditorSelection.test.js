/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import NotionField from "../NotionField.web";
import { encodeToggle, BLOCK_SENTINELS } from "../../lib/richtext";
import { htmlToMarks, marksToHtml } from "../../lib/richhtml";

let mockEditor;
jest.mock("@tiptap/react", () => {
  const actual = jest.requireActual("@tiptap/react");
  return { ...actual, useEditor: (...args) => { mockEditor = actual.useEditor(...args); return mockEditor; } };
});

test("el menú permite Título y Desplegable activos a la vez y Texto conserva el contenedor", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(globalThis, "fetch", { configurable: true, writable: true, value: jest.fn() });
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  const rect = { left: 0, right: 100, top: 0, bottom: 24, width: 100, height: 24 };
  Range.prototype.getBoundingClientRect = () => rect;
  Range.prototype.getClientRects = () => [rect];
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const button = (label) => host.querySelector(`[aria-label="${label}"]`);
  try {
    await act(async () => root.render(<NotionField value={encodeToggle(BLOCK_SENTINELS.heading2 + "**Título**", "Detalle")} onChangeText={() => {}} />));
    await act(async () => mockEditor.commands.setTextSelection({ from: 3, to: 9 }));
    expect(button("Título 2").getAttribute("aria-pressed")).toBe("true");
    expect(button("Desplegable").getAttribute("aria-pressed")).toBe("true");
    await act(async () => button("Título 1").click());
    expect(button("Título 1").getAttribute("aria-pressed")).toBe("true");
    expect(button("Desplegable").getAttribute("aria-pressed")).toBe("true");
    await act(async () => button("Texto").click());
    expect(button("Texto").getAttribute("aria-pressed")).toBe("true");
    expect(button("Desplegable").getAttribute("aria-pressed")).toBe("true");
    expect(mockEditor.state.doc.firstChild.lastChild.textContent).toBe("Detalle");
    await act(async () => button("Desplegable").click());
    expect(mockEditor.state.doc.firstChild.type.name).toBe("paragraph");
    expect(mockEditor.state.doc.textContent).toBe("TítuloDetalle");
    expect(button("Desplegable").getAttribute("aria-pressed")).toBe("false");
  } finally { await act(async () => root.unmount()); host.remove(); }
});
jest.mock("react-native", () => jest.requireActual("react-native-web"));
beforeEach(() => { window.scrollBy = jest.fn(); });

test("la pill permite sangría táctil y quitar estilos conservando la selección y la lista", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(globalThis, "fetch", { configurable: true, writable: true, value: jest.fn() });
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  const rect = { left: 0, right: 100, top: 0, bottom: 24, width: 100, height: 24 };
  Range.prototype.getBoundingClientRect = () => rect;
  Range.prototype.getClientRects = () => [rect];
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const button = label => host.querySelector(`[aria-label="${label}"]`);
  try {
    const source = htmlToMarks('<ul><li><p>Uno</p></li><li><p><strong><em>Dos</em></strong></p></li></ul>');
    await act(async () => root.render(<NotionField value={source} onChangeText={() => {}} />));
    let pos;
    mockEditor.state.doc.descendants((node, p) => { if (node.isTextblock && node.textContent === "Dos") pos = p + 1; });
    await act(async () => mockEditor.commands.setTextSelection({ from: pos, to: pos + 3 }));
    expect(button("Aumentar sangría").disabled).toBe(false);
    await act(async () => button("Aumentar sangría").click());
    expect(mockEditor.state.doc.firstChild.firstChild.child(1).type.name).toBe("bulletList");
    expect(mockEditor.state.doc.textBetween(mockEditor.state.selection.from, mockEditor.state.selection.to)).toBe("Dos");
    await act(async () => button("Quitar estilos del texto").click());
    expect(mockEditor.getHTML()).not.toMatch(/<strong>|<em>/);
    const saved = htmlToMarks(mockEditor.getHTML());
    await act(async () => mockEditor.commands.setContent(marksToHtml(saved)));
    mockEditor.state.doc.descendants((node, p) => { if (node.isTextblock && node.textContent === "Dos") pos = p + 1; });
    await act(async () => mockEditor.commands.setTextSelection({ from: pos, to: pos + 3 }));
    expect(button("Reducir sangría").disabled).toBe(false);
    await act(async () => button("Reducir sangría").click());
    expect(mockEditor.state.doc.firstChild.childCount).toBe(2);
  } finally { await act(async () => root.unmount()); host.remove(); }
});

test("la barra actualiza marcas, color y título al seleccionar otro texto sin editarlo", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(globalThis, "fetch", { configurable: true, writable: true, value: jest.fn() });
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  const rect = { left: 0, right: 100, top: 0, bottom: 24, width: 100, height: 24 };
  Range.prototype.getBoundingClientRect = () => rect;
  Range.prototype.getClientRects = () => [rect];
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<NotionField value={"**Uno**\nDos"} onChangeText={() => {}} />));
    await act(async () => mockEditor.commands.setTextSelection({ from: 1, to: 4 }));
    expect(document.querySelector('[aria-label="Negrita"]').classList.contains("is-active")).toBe(true);
    await act(async () => mockEditor.chain().setMark("tcolor", { color: "rojo" }).setHeading({ level: 1 }).run());
    expect(document.querySelector('[aria-label="Color del texto"]').classList.contains("is-active")).toBe(true);
    expect(document.querySelector('[aria-label="Título 1"]').classList.contains("is-active")).toBe(true);
    // El segundo párrafo cambió de posición al pasar el primero a heading,
    // pero conserva su contenido y no tiene ninguna de esas marcas.
    const pos = mockEditor.state.doc.firstChild.nodeSize + 1;
    await act(async () => mockEditor.commands.setTextSelection({ from: pos, to: pos + 3 }));
    for (const label of ["Negrita", "Color del texto", "Título 1"])
      expect(document.querySelector(`[aria-label="${label}"]`).classList.contains("is-active")).toBe(false);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
