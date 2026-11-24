/** @jest-environment jsdom */
import { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";

import {
  attachEditorBlockControls,
  copyBlocksText,
  deleteBlocks,
  duplicateBlocks,
  moveBlocks,
} from "../editorBlockSelection";
import { buildExtensions, focusEditorBottom } from "../editorSetup";
import { attachEditorToolbar } from "../editorToolbar";

const tick = (ms = 32) => jest.advanceTimersByTime(ms);

const pointer = (target, type, x, y, extra = {}) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    ...extra,
  });
  Object.defineProperties(event, {
    pointerId: { value: extra.pointerId ?? 1 },
    isPrimary: { value: true },
    pointerType: { value: extra.pointerType ?? "mouse" },
  });
  target.dispatchEvent(event);
  return event;
};

describe("Navegación fluida estilo Notion: foco al pie, teclado en átomos y selección múltiple con cuadro azul", () => {
  let host;
  let bubble;
  let editor;
  let cleanup;
  let clipboardWrite;

  const blocks = () => Array.from(editor.view.dom.children);
  const blockTexts = () => blocks().map((n) => n.textContent);

  const mockBlockRects = () => {
    blocks().forEach((node, index) => {
      node.getBoundingClientRect = () => ({
        left: 40,
        right: 340,
        top: 100 + index * 44,
        bottom: 134 + index * 44,
        width: 300,
        height: 34,
      });
    });
  };

  beforeEach(() => {
    jest.useFakeTimers();
    clipboardWrite = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
    window.scrollBy = jest.fn();
    window.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
    const rect = { left: 40, right: 200, top: 100, bottom: 124, width: 160, height: 24 };
    Range.prototype.getClientRects = () => [rect];
    Range.prototype.getBoundingClientRect = () => rect;

    host = document.createElement("div");
    host.className = "nf-root nf-page";
    host.getBoundingClientRect = () => ({ left: 0, right: 400, top: 0, bottom: 600, width: 400, height: 600 });
    const mount = document.createElement("div");
    bubble = document.createElement("div");
    bubble.className = "nf-bubble";
    host.append(mount, bubble);
    document.body.appendChild(host);

    editor = new Editor({
      element: mount,
      extensions: buildExtensions(),
      content: "<p>Uno</p><p>Dos</p><p>Tres</p>",
    });
    editor.view.coordsAtPos = () => ({ left: 40, right: 120, top: 100, bottom: 124 });
    mockBlockRects();

    const toolbar = attachEditorToolbar(editor, host, bubble);
    const controls = attachEditorBlockControls(editor, host, {});
    cleanup = () => {
      controls();
      toolbar();
    };
    tick();
  });

  afterEach(() => {
    cleanup();
    editor.destroy();
    host.remove();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("focusEditorBottom crea párrafo al final tras texto o bloque y reutiliza el vacío existente", () => {
    editor.commands.setContent("<p>Texto final</p>");
    expect(editor.state.doc.childCount).toBe(1);

    expect(focusEditorBottom(editor)).toBe(true);
    expect(editor.state.doc.childCount).toBe(2);
    expect(editor.state.doc.lastChild.type.name).toBe("paragraph");
    expect(editor.state.doc.lastChild.textContent).toBe("");
    expect(editor.state.selection.from).toBe(editor.state.doc.content.size - 1);

    // Llamar de nuevo no duplica párrafos vacíos
    expect(focusEditorBottom(editor)).toBe(true);
    expect(editor.state.doc.childCount).toBe(2);

    // Tras bloque átomo deja foco utilizable en el párrafo final
    editor.commands.setContent(
      '<div data-link-url="https://example.com" data-link-title="Link" data-link-variant="bookmark"></div>'
    );
    expect(focusEditorBottom(editor)).toBe(true);
    expect(editor.state.doc.lastChild.type.name).toBe("paragraph");
    expect(editor.state.doc.lastChild.textContent).toBe("");
    expect(editor.state.selection.from).toBe(editor.state.doc.content.size - 1);
  });

  test("hacer clic debajo del último bloque abre un párrafo nuevo al final", () => {
    mockBlockRects();
    const clickBelow = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      clientX: 120,
      clientY: 290,
    });
    editor.view.dom.dispatchEvent(clickBelow);
    expect(editor.state.doc.childCount).toBe(4);
    expect(editor.state.doc.lastChild.textContent).toBe("");
    expect(editor.state.selection.from).toBe(editor.state.doc.content.size - 1);

    // También funciona tocando directamente el host fuera del último bloque
    editor.commands.setContent("<p>Solo uno</p>");
    mockBlockRects();
    const hostClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      clientX: 120,
      clientY: 260,
    });
    host.dispatchEvent(hostClick);
    expect(editor.state.doc.childCount).toBe(2);
  });

  test("atajos en bloque átomo: ArrowUp arriba, Enter debajo y ArrowDown al final", () => {
    editor.commands.setContent(
      '<div data-link-url="https://example.com" data-link-title="Ref" data-link-variant="card"></div>'
    );
    const initialCount = editor.state.doc.childCount;
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)));

    // ArrowUp al inicio inserta párrafo antes
    editor.view.someProp("handleKeyDown", (fn) =>
      fn(editor.view, new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }))
    );
    expect(editor.state.doc.firstChild.type.name).toBe("paragraph");
    expect(editor.state.doc.childCount).toBe(initialCount + 1);

    // Enter sobre bloque átomo en índice 1 inserta párrafo inmediatamente debajo
    const atomPos = editor.state.doc.firstChild.nodeSize;
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, atomPos)));
    editor.view.someProp("handleKeyDown", (fn) =>
      fn(editor.view, new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
    );
    expect(editor.state.doc.childCount).toBe(initialCount + 2);
    expect(editor.state.doc.child(2).type.name).toBe("paragraph");

    // Si un bloque átomo queda al final sin párrafo siguiente, ArrowDown abre uno
    editor.view.dispatch(
      editor.state.tr.replaceWith(
        0,
        editor.state.doc.content.size,
        editor.state.schema.nodes.webBookmark.create({
          url: "https://example.com",
          title: "Final",
          variant: "bookmark",
        })
      )
    );
    const lastPos = editor.state.doc.content.size - editor.state.doc.lastChild.nodeSize;
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, lastPos)));
    editor.view.someProp("handleKeyDown", (fn) =>
      fn(editor.view, new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }))
    );
    expect(editor.state.doc.lastChild.type.name).toBe("paragraph");
    expect(editor.state.doc.lastChild.textContent).toBe("");
  });

  test("arrastrar desde zona vacía muestra cuadro azul y selecciona múltiples bloques", () => {
    mockBlockRects();
    const marquee = host.querySelector(".nf-marquee");
    const multiBar = host.querySelector(".nf-multi-bar");
    expect(marquee.hidden).toBe(true);
    expect(multiBar.hidden).toBe(true);

    // Trigger A: desde el margen izquierdo (x=10 < left 40+6) cubriendo bloques 0 y 1
    pointer(host, "pointerdown", 10, 95);
    pointer(window, "pointermove", 250, 175);
    expect(marquee.hidden).toBe(false);
    expect(host.querySelectorAll('[data-nf-block-selected="true"]')).toHaveLength(2);
    expect(blocks()[0].getAttribute("data-nf-block-selected")).toBe("true");
    expect(blocks()[1].getAttribute("data-nf-block-selected")).toBe("true");
    expect(blocks()[2].hasAttribute("data-nf-block-selected")).toBe(false);

    pointer(window, "pointerup", 250, 175);
    tick();
    expect(marquee.hidden).toBe(true);
    expect(multiBar.hidden).toBe(false);
    expect(host.classList.contains("nf-multi-selecting")).toBe(true);
    expect(bubble.hidden).toBe(true);
    expect(multiBar.querySelector(".nf-multi-count").textContent).toBe("2 bloques");

    // Escape limpia la selección múltiple
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(multiBar.hidden).toBe(true);
    expect(host.querySelectorAll('[data-nf-block-selected="true"]')).toHaveLength(0);
  });

  test("doble clic + arrastre abre cuadro azul, mientras doble clic sin arrastre no lo activa", () => {
    mockBlockRects();
    const marquee = host.querySelector(".nf-marquee");
    const multiBar = host.querySelector(".nf-multi-bar");

    // Doble toque sin arrastre (>0 y <=8px): no activa cuadro azul
    pointer(blocks()[0], "pointerdown", 100, 115);
    pointer(window, "pointerup", 100, 115);
    tick(80);
    pointer(blocks()[0], "pointerdown", 102, 116);
    pointer(window, "pointermove", 104, 117);
    expect(marquee.hidden).toBe(true);
    pointer(window, "pointerup", 104, 117);
    expect(multiBar.hidden).toBe(true);

    // Doble clic seguido de arrastre sobre bloques 0, 1, 2
    tick(400);
    pointer(blocks()[0], "pointerdown", 100, 115);
    pointer(window, "pointermove", 100, 115);
    pointer(window, "pointerup", 100, 115);
    tick(80);
    pointer(blocks()[0], "pointerdown", 102, 116);
    pointer(window, "pointermove", 200, 210);
    expect(marquee.hidden).toBe(false);
    pointer(window, "pointerup", 200, 210);
    tick();
    expect(multiBar.hidden).toBe(false);
    expect(host.querySelectorAll('[data-nf-block-selected="true"]')).toHaveLength(3);
  });

  test("Shift+Click en margen/bloques, mover, duplicar, copiar y borrar en 1 solo undo", () => {
    mockBlockRects();
    blocks()[0].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: 10, clientY: 115, shiftKey: true }));
    blocks()[2].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: 100, clientY: 205, shiftKey: true }));
    tick();

    const multiBar = host.querySelector(".nf-multi-bar");
    expect(multiBar.hidden).toBe(false);
    expect(multiBar.querySelector(".nf-multi-count").textContent).toBe("2 bloques");

    // Copiar texto de bloques [0, 2]
    multiBar.querySelector(".nf-multi-copy").click();
    expect(clipboardWrite).toHaveBeenCalledWith("Uno\n\nTres");

    // Subir selección no contigua [0, 2] -> [0, 1] ("Uno", "Tres", "Dos")
    multiBar.querySelector(".nf-multi-up").click();
    tick();
    expect(blockTexts()).toEqual(["Uno", "Tres", "Dos"]);
    expect(host.querySelectorAll('[data-nf-block-selected="true"]')).toHaveLength(2);

    // Duplicar con botón -> inserta "Uno", "Tres" después del índice 1
    multiBar.querySelector(".nf-multi-dup").click();
    tick();
    expect(blockTexts()).toEqual(["Uno", "Tres", "Uno", "Tres", "Dos"]);
    expect(multiBar.querySelector(".nf-multi-count").textContent).toBe("2 bloques");

    // Borrar con Backspace y verificar 1 solo paso undo()
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }));
    expect(blockTexts()).toEqual(["Uno", "Tres", "Dos"]);
    expect(multiBar.hidden).toBe(true);
    expect(editor.commands.undo()).toBe(true);
    expect(blockTexts()).toEqual(["Uno", "Tres", "Uno", "Tres", "Dos"]);

    // Helpers puros directos: deleteBlocks todos -> deja párrafo vacío, moveBlocks & copyBlocksText
    expect(copyBlocksText(editor, [0, 1])).toBe("Uno\n\nTres");
    expect(duplicateBlocks(editor, [4])).toEqual([5]);
    expect(moveBlocks(editor, [4, 5], -1)).toEqual([3, 4]);
    expect(deleteBlocks(editor, [0, 1, 2, 3, 4, 5])).toBe(true);
    expect(blockTexts()).toEqual([""]);
  });
});
