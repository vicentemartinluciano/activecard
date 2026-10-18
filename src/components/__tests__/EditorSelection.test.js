/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import NotionField from "../NotionField.web";

let mockEditor;
jest.mock("@tiptap/react", () => {
  const actual = jest.requireActual("@tiptap/react");
  return { ...actual, useEditor: (...args) => { mockEditor = actual.useEditor(...args); return mockEditor; } };
});
jest.mock("react-native", () => jest.requireActual("react-native-web"));

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
