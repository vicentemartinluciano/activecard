/** @jest-environment jsdom */
import { Editor } from "@tiptap/core";

import { normalizeBackup } from "../backup";
import { buildDeckExport } from "../deckExport";
import { clipboardToEditorHtml } from "../editorPaste";
import { buildExtensions, insertMathFormula, openLinkEditor } from "../editorSetup";
import { attachEditorToolbar } from "../editorToolbar";
import { FORMATTED_SENTINEL, decodeFormatted } from "../richContent";
import { describeBlock, htmlToMarks, marksToHtml } from "../richhtml";
import {
  LINK_BLOCK_SENTINEL,
  decodeLinkBlock,
  encodeLinkBlock,
  isStandaloneUrl,
  linkPlatformInfo,
  matchMarkdownLinkAt,
  sanitizeLinkUrl,
} from "../richLink";
import { hasRichContent, parseRich, toPlainText } from "../richtext";

function createMockClipboard({ html = "", plain = "" } = {}) {
  return {
    getData: (type) => (type === "text/html" ? html : type === "text/plain" ? plain : ""),
    items: [],
  };
}

function createPasteEvent(clipboardData) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: clipboardData });
  return event;
}

describe("richLink — sanitización, plataformas y contrato de serialización", () => {
  test("permite únicamente URLs http/https válidas y rechaza esquemas inseguros", () => {
    expect(sanitizeLinkUrl("https://example.com/ruta?a=1&b=2")).toBe("https://example.com/ruta?a=1&b=2");
    expect(sanitizeLinkUrl("https://es.wikipedia.org/wiki/Media_(matem%C3%A1tica)")).toBe(
      "https://es.wikipedia.org/wiki/Media_(matem%C3%A1tica)"
    );
    expect(sanitizeLinkUrl("example.com/docs", { autoScheme: true })).toBe("https://example.com/docs");
    expect(sanitizeLinkUrl("example.com/docs")).toBeNull();
    expect(sanitizeLinkUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeLinkUrl("data:text/html,<script>1</script>")).toBeNull();
    expect(sanitizeLinkUrl("file:///etc/passwd")).toBeNull();
    expect(sanitizeLinkUrl("https://bad url.com")).toBeNull();

    expect(isStandaloneUrl("https://youtu.be/abc123")).toBe(true);
    expect(isStandaloneUrl("Ver https://youtu.be/abc123")).toBe(false);
    expect(isStandaloneUrl("https://a.com\nhttps://b.com")).toBe(false);
  });

  test("identifica plataformas locales sin red ni favicons externos", () => {
    expect(linkPlatformInfo("https://youtu.be/abc123").id).toBe("youtube");
    expect(linkPlatformInfo("https://github.com/openai/codex").id).toBe("github");
    expect(linkPlatformInfo("https://docs.google.com/document/d/1").id).toBe("gdocs");
    expect(linkPlatformInfo("https://docs.google.com/spreadsheets/d/1").id).toBe("gsheets");
    expect(linkPlatformInfo("https://drive.google.com/file/d/1").id).toBe("gdrive");
    expect(linkPlatformInfo("https://www.figma.com/file/1").id).toBe("figma");
    expect(linkPlatformInfo("https://es.wikipedia.org/wiki/LaTeX").id).toBe("wikipedia");
    expect(linkPlatformInfo("https://ejemplo.org/articulo").id).toBe("web");
  });

  test("round-trip idempotente de los 4 formatos Notion, mezcla con LaTeX y no colisión entre \\uE033 y \\uE034", async () => {
    expect(LINK_BLOCK_SENTINEL).toBe("\uE034");
    expect(LINK_BLOCK_SENTINEL).not.toBe(FORMATTED_SENTINEL);

    const bookmarkLine = encodeLinkBlock({
      url: "https://github.com/martin/activecard",
      title: "Repositorio ActiveCard",
      description: "Notas y mazos",
      variant: "bookmark",
    });
    const cardLine = encodeLinkBlock({
      url: "https://docs.google.com/document/d/123",
      title: "Plan de estudio",
      description: "Resumen semanal",
      variant: "card",
    });

    expect(bookmarkLine.startsWith("\uE034")).toBe(true);
    expect(decodeFormatted(bookmarkLine)).toBeNull();
    expect(decodeLinkBlock(bookmarkLine)).toEqual({
      url: "https://github.com/martin/activecard",
      title: "Repositorio ActiveCard",
      description: "Notas y mazos",
      variant: "bookmark",
    });

    // Span con enlace + negrita+cursiva (fallback a FORMATTED_SENTINEL \uE033) convive sin colisión con \uE034
    const formattedLinkLine = htmlToMarks(
      '<p><a href="https://example.com/e033" data-link-display="mention"><strong><em>Concepto clave</em></strong></a></p>'
    );
    expect(formattedLinkLine.startsWith(FORMATTED_SENTINEL)).toBe(true);
    expect(htmlToMarks(marksToHtml(formattedLinkLine))).toBe(formattedLinkLine);
    expect(parseRich(formattedLinkLine).map(describeBlock)[0].spans[0]).toMatchObject({
      text: "Concepto clave",
      bold: true,
      italic: true,
      link: { href: "https://example.com/e033", display: "mention" },
    });

    const docMarks = [
      'Leer [guía **clave**](https://example.com/a_b) y mención [Video 1](https://youtu.be/abc123 "mention")',
      "Repasar $E[X] = \\mu$ en [Wikipedia](https://es.wikipedia.org/wiki/Media_(matem%C3%A1tica))",
      bookmarkLine,
      cardLine,
    ].join("\n");

    const html = marksToHtml(docMarks);
    expect(html).toContain('<a href="https://example.com/a_b" data-link-display="inline">');
    expect(html).toContain('<a href="https://youtu.be/abc123" data-link-display="mention">Video 1</a>');
    expect(html).toContain('data-link-url="https://github.com/martin/activecard"');
    expect(html).toContain('data-link-variant="card"');

    const back = htmlToMarks(html);
    expect(back).toBe(docMarks);
    expect(htmlToMarks(marksToHtml(back))).toBe(back);

    const blocks = parseRich(docMarks).map(describeBlock);
    expect(blocks[0].spans[1]).toMatchObject({
      text: "guía ",
      link: { href: "https://example.com/a_b", display: "inline" },
    });
    expect(blocks[0].spans[2]).toMatchObject({
      text: "clave",
      bold: true,
      link: { href: "https://example.com/a_b", display: "inline" },
    });
    expect(blocks[0].spans[4]).toMatchObject({
      text: "Video 1",
      link: { href: "https://youtu.be/abc123", display: "mention" },
    });
    expect(blocks[2]).toMatchObject({
      kind: "linkBlock",
      link: { variant: "bookmark", title: "Repositorio ActiveCard" },
    });
    expect(blocks[3]).toMatchObject({
      kind: "linkBlock",
      link: { variant: "card", title: "Plan de estudio" },
    });

    expect(hasRichContent(bookmarkLine)).toBe(true);
    expect(toPlainText(docMarks)).toContain("Repositorio ActiveCard (https://github.com/martin/activecard)");
    expect(matchMarkdownLinkAt("Ver [nota](javascript:alert(1))", 4)).toBeNull();
    expect(matchMarkdownLinkAt("Ver [[rojo:texto]]", 4)).toBeNull();

    // Respaldo y deckExport preservan bloques \uE034 y enlaces formateados \uE033
    const db = {
      getFirstAsync: async () => ({ name: "Mazo Links", icon: null }),
      getAllAsync: async (sql) => (sql.includes("FROM cards") ? [{ front: formattedLinkLine, back: docMarks }] : []),
    };
    const exported = await buildDeckExport(db, 1, new Date("2026-11-24T12:00:00Z"));
    const restored = normalizeBackup(JSON.parse(JSON.stringify(exported)));
    expect(restored.cards[0]).toMatchObject({ front: formattedLinkLine, back: docMarks });
  });
});

describe("Notion links + MathLivePreview en DOM real", () => {
  let host;
  let bubble;
  let editor;
  let cleanupToolbar;
  let originalOpen;

  beforeEach(() => {
    originalOpen = window.open;
    window.open = jest.fn();
    delete window.ReactNativeWebView;
    window.scrollBy = jest.fn();
    window.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
    const rect = { left: 10, right: 200, top: 20, bottom: 44, width: 190, height: 24 };
    Range.prototype.getBoundingClientRect = () => rect;
    Range.prototype.getClientRects = () => [rect];

    host = document.createElement("div");
    host.className = "nf-root nf-page";
    host.getBoundingClientRect = () => ({ left: 0, right: 360, top: 0, bottom: 600, width: 360, height: 600 });
    const mount = document.createElement("div");
    bubble = document.createElement("div");
    bubble.className = "nf-bubble";
    host.append(mount, bubble);
    document.body.appendChild(host);

    editor = new Editor({
      element: mount,
      extensions: buildExtensions(),
      content: "<p>Leer documentación oficial ahora</p>",
    });
    editor.view.coordsAtPos = () => ({ left: 40, right: 120, top: 30, bottom: 52 });
    cleanupToolbar = attachEditorToolbar(editor, host, bubble);
    editor.view.focus();
  });

  afterEach(() => {
    cleanupToolbar?.();
    editor?.destroy();
    host?.remove();
    window.open = originalOpen;
    delete window.ReactNativeWebView;
    jest.clearAllMocks();
  });

  test("pegar URL sobre texto seleccionado lo convierte en enlace sin pisar el texto", () => {
    editor.commands.setTextSelection({ from: 6, to: 19 });
    const clip = createMockClipboard({ plain: "https://docs.example.com/guia" });
    expect(clipboardToEditorHtml(clip)).toEqual({ kind: "url", url: "https://docs.example.com/guia" });

    const pasteEvent = createPasteEvent(clip);
    const handled = editor.view.someProp("handlePaste", (fn) => fn(editor.view, pasteEvent));
    expect(handled).toBe(true);
    expect(pasteEvent.defaultPrevented).toBe(true);

    const anchor = editor.view.dom.querySelector("a.nf-link-inline");
    expect(anchor).not.toBeNull();
    expect(anchor.textContent).toBe("documentación");
    expect(anchor.getAttribute("href")).toBe("https://docs.example.com/guia");
  });

  test("pegar URL suelta abre selector compacto sin foco, convierte en 1 toque, expande y abre directo al tocar", () => {
    editor.commands.setContent("<p></p>");
    editor.commands.setTextSelection(1);
    const clip = createMockClipboard({ plain: "https://youtu.be/dQw4w9WgXcQ" });
    const pasteEvent = createPasteEvent(clip);
    const handled = editor.view.someProp("handlePaste", (fn) => fn(editor.view, pasteEvent));
    expect(handled).toBe(true);

    const popover = host.querySelector(".nf-link-popover");
    expect(popover.hidden).toBe(false);
    expect(popover.classList.contains("is-compact")).toBe(true);
    expect(popover.contains(document.activeElement)).toBe(false);
    expect(popover.querySelector(".nf-link-input-url").hidden).toBe(true);
    expect(popover.querySelector(".nf-link-actions").hidden).toBe(true);
    expect(popover.querySelector(".nf-link-mode-expand").hidden).toBe(false);
    expect(host.classList.contains("nf-link-editing")).toBe(true);
    expect(bubble.hidden).toBe(true);

    // 1. Mención en 1 toque desde modo compacto
    popover.querySelector('[data-mode="mention"]').click();
    const mention = editor.view.dom.querySelector("a.nf-link-mention");
    expect(mention).not.toBeNull();
    expect(mention.getAttribute("data-link-icon")).toBe("▶");
    expect(popover.hidden).toBe(false);
    expect(popover.classList.contains("is-compact")).toBe(true);

    // 2. Marcador en 1 toque
    popover.querySelector('[data-mode="bookmark"]').click();
    expect(editor.view.dom.querySelector(".nf-link-block-bookmark")).not.toBeNull();
    expect(popover.hidden).toBe(false);

    // 3. Expandir con ✎ y pasar a Tarjeta con descripción
    popover.querySelector(".nf-link-mode-expand").click();
    expect(popover.classList.contains("is-compact")).toBe(false);
    popover.querySelector('[data-mode="card"]').click();
    const descInput = popover.querySelector(".nf-link-input-desc");
    expect(descInput.hidden).toBe(false);
    descInput.value = "Video clave del módulo";

    // Cerrar popover y verificar persistencia round-trip
    popover.querySelector(".nf-link-popover-done").click();
    expect(popover.hidden).toBe(true);
    expect(host.classList.contains("nf-link-editing")).toBe(false);
    const card = editor.view.dom.querySelector(".nf-link-block-card");
    expect(card).not.toBeNull();
    expect(card.textContent).toContain("Video clave del módulo");

    const marks = htmlToMarks(editor.getHTML());
    expect(marks.startsWith(LINK_BLOCK_SENTINEL)).toBe(true);
    expect(decodeLinkBlock(marks.split("\n")[0])).toMatchObject({
      url: "https://youtu.be/dQw4w9WgXcQ",
      description: "Video clave del módulo",
      variant: "card",
    });

    // Tocar la tarjeta abre el enlace directo en web sin abrir popover
    card.click();
    expect(window.open).toHaveBeenCalledWith("https://youtu.be/dQw4w9WgXcQ", "_blank", "noopener,noreferrer");
    expect(popover.hidden).toBe(true);

    // En WebView nativo (Android), tocar la tarjeta emite nf:open-url burbujeante
    window.ReactNativeWebView = { postMessage: jest.fn() };
    const openedUrls = [];
    document.addEventListener("nf:open-url", (e) => openedUrls.push(e.detail?.url), { once: true });
    card.click();
    expect(openedUrls).toEqual(["https://youtu.be/dQw4w9WgXcQ"]);
    delete window.ReactNativeWebView;

    // Tocar ✎ en la tarjeta abre el popover y volver a URL la reconvierte a enlace inline
    card.querySelector(".nf-link-block-edit").click();
    expect(popover.hidden).toBe(false);
    expect(popover.classList.contains("is-compact")).toBe(false);
    popover.querySelector('[data-mode="inline"]').click();
    popover.querySelector(".nf-link-popover-done").click();
    expect(editor.view.dom.querySelector("a.nf-link-inline")).not.toBeNull();
    expect(editor.view.dom.querySelector(".nf-link-block")).toBeNull();
  });

  test("seguir escribiendo cierra la barra compacta tras pegar URL", () => {
    editor.commands.setContent("<p></p>");
    editor.commands.setTextSelection(1);
    const clip = createMockClipboard({ plain: "https://example.com/articulo" });
    editor.view.someProp("handlePaste", (fn) => fn(editor.view, createPasteEvent(clip)));

    const popover = host.querySelector(".nf-link-popover");
    expect(popover.hidden).toBe(false);
    expect(popover.classList.contains("is-compact")).toBe(true);

    editor.commands.insertContent(" hola");
    expect(popover.hidden).toBe(true);
    expect(host.classList.contains("nf-link-editing")).toBe(false);
  });

  test("clic directo abre URL y Mención sin mostrar caja; hover muestra Editar y Quitar", () => {
    editor.commands.setContent(
      '<p><a href="https://example.com" data-link-display="inline">Ejemplo</a> y <a href="https://youtu.be/abc" data-link-display="mention">Video</a></p>'
    );
    const popover = host.querySelector(".nf-link-popover");
    const hoverBar = host.querySelector(".nf-link-hover");

    const inlineAnchor = editor.view.dom.querySelector("a.nf-link-inline");
    const ev1 = new MouseEvent("click", { bubbles: true, cancelable: true });
    inlineAnchor.dispatchEvent(ev1);
    expect(ev1.defaultPrevented).toBe(true);
    expect(window.open).toHaveBeenCalledWith("https://example.com", "_blank", "noopener,noreferrer");
    expect(popover.hidden).toBe(true);

    const mentionAnchor = editor.view.dom.querySelector("a.nf-link-mention");
    const ev2 = new MouseEvent("click", { bubbles: true, cancelable: true });
    mentionAnchor.dispatchEvent(ev2);
    expect(ev2.defaultPrevented).toBe(true);
    expect(window.open).toHaveBeenCalledWith("https://youtu.be/abc", "_blank", "noopener,noreferrer");
    expect(popover.hidden).toBe(true);

    inlineAnchor.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(hoverBar.hidden).toBe(false);
    hoverBar.querySelector(".nf-link-hover-edit").click();
    expect(hoverBar.hidden).toBe(true);
    expect(popover.hidden).toBe(false);
    expect(popover.classList.contains("is-compact")).toBe(false);

    const urlInput = popover.querySelector(".nf-link-input-url");
    popover.querySelector(".nf-link-popover-open").click();
    expect(window.open).toHaveBeenCalledWith("https://example.com", "_blank", "noopener,noreferrer");

    urlInput.value = "javascript:alert(1)";
    popover.querySelector(".nf-link-popover-done").click();
    expect(popover.hidden).toBe(false);
    expect(popover.querySelector(".nf-link-error").hidden).toBe(false);

    popover.querySelector(".nf-link-popover-delete").click();
    expect(popover.hidden).toBe(true);
    expect(editor.view.dom.querySelector("a.nf-link-inline")).toBeNull();

    const remaining = editor.view.dom.querySelector("a.nf-link-mention");
    remaining.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(hoverBar.hidden).toBe(false);
    hoverBar.querySelector(".nf-link-hover-delete").click();
    expect(editor.view.dom.querySelector("a.nf-link")).toBeNull();
  });

  test("montaje diferido tipo @tiptap/react reubica popovers en .nf-root al insertar EditorContent", () => {
    const delayedRoot = document.createElement("div");
    delayedRoot.className = "nf-root nf-page";
    delayedRoot.getBoundingClientRect = () => ({ left: 0, right: 420, top: 0, bottom: 700, width: 420, height: 700 });
    const wrapperBeforeMount = document.createElement("div");
    const mountPoint = document.createElement("div");
    wrapperBeforeMount.appendChild(mountPoint);
    document.body.append(wrapperBeforeMount, delayedRoot);

    const lateEditor = new Editor({
      element: mountPoint,
      extensions: buildExtensions(),
      content:
        '<div data-link-url="https://github.com/martin" data-link-title="Repo" data-link-variant="bookmark"></div><p></p>',
    });
    lateEditor.view.coordsAtPos = () => ({ left: 60, right: 140, top: 40, bottom: 64 });

    delayedRoot.appendChild(mountPoint);

    const editBtn = lateEditor.view.dom.querySelector(".nf-link-block-edit");
    editBtn.click();

    const linkPopover = delayedRoot.querySelector(".nf-link-popover");
    expect(linkPopover).not.toBeNull();
    expect(linkPopover.parentElement).toBe(delayedRoot);
    expect(linkPopover.hidden).toBe(false);
    expect(wrapperBeforeMount.querySelector(".nf-link-popover")).toBeNull();
    linkPopover.querySelector(".nf-link-popover-done").click();

    lateEditor.commands.setTextSelection(lateEditor.state.doc.content.size - 1);
    expect(insertMathFormula(lateEditor)).toBe(true);
    const mathPopover = delayedRoot.querySelector(".nf-math-popover");
    expect(mathPopover).not.toBeNull();
    expect(mathPopover.parentElement).toBe(delayedRoot);
    expect(mathPopover.hidden).toBe(false);

    lateEditor.destroy();
    delayedRoot.remove();
    wrapperBeforeMount.remove();
  });

  test("insertMathFormula inserta fórmula con popover abierto y Android deleteContentBackward borra atómicamente", () => {
    editor.commands.setContent("<p>Valor </p>");
    editor.commands.setTextSelection(7);
    expect(insertMathFormula(editor)).toBe(true);

    const mathPopover = host.querySelector(".nf-math-popover");
    expect(mathPopover.hidden).toBe(false);
    expect(host.classList.contains("nf-math-editing")).toBe(true);

    const input = mathPopover.querySelector(".nf-math-popover-input");
    input.value = "x^2 + 1";
    mathPopover.querySelector(".nf-math-popover-done").click();
    expect(mathPopover.hidden).toBe(true);
    expect(editor.getHTML()).toContain("$x^2 + 1$");

    const endPos = editor.state.doc.content.size - 1;
    editor.commands.setTextSelection(endPos);
    const beforeInput = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "deleteContentBackward",
    });
    editor.view.dom.dispatchEvent(beforeInput);
    expect(beforeInput.defaultPrevented).toBe(true);
    expect(editor.getHTML()).not.toContain("$x^2 + 1$");
    expect(editor.commands.undo()).toBe(true);
    expect(editor.getHTML()).toContain("$x^2 + 1$");
  });

  test("openLinkEditor funciona con selección vacía", () => {
    editor.commands.setContent("<p>Hola</p>");
    editor.commands.setTextSelection(5);
    expect(openLinkEditor(editor)).toBe(true);
    const popover = host.querySelector(".nf-link-popover");
    expect(popover.hidden).toBe(false);
    popover.querySelector(".nf-link-input-url").value = "github.com/martin";
    popover.querySelector(".nf-link-input-title").value = "Mi GitHub";
    popover.querySelector(".nf-link-popover-done").click();
    const outHtml = editor.getHTML();
    expect(outHtml).toContain('href="https://github.com/martin"');
    expect(outHtml).toContain('data-link-display="inline"');
    expect(outHtml).toContain(">Mi GitHub</a>");
  });
});
