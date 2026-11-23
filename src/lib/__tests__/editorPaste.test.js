/** @jest-environment jsdom */
import { Editor } from "@tiptap/core";

import { buildExtensions, insertImageFile } from "../editorSetup";
import {
  clipboardToEditorHtml,
  markdownClipboardToHtml,
  mathMlToLatex,
  normalizeClipboardHtml,
} from "../editorPaste";
import { describeBlock, groupDisplayMathBlocks, htmlToMarks, marksToHtml } from "../richhtml";
import { parseRich } from "../richtext";

jest.mock("../imageCompress", () => ({
  compressFile: jest.fn(async () => "data:image/jpeg;base64,FAKE_IMG"),
}));

const GEMINI_SCREENSHOT_HTML = `
<div style="color: rgb(227, 227, 227); background-color: rgb(27, 28, 29); font-family: Google Sans;">
  <p style="margin-top: 0px;">
    <strong style="font-weight: 700;">1. La ecuación de partida (la suma de los valores actuales):</strong>
  </p>
  <div class="math-block" data-math="V = c(1+i)^{-1} + c(1+i)^{-2} + \\cdots + c(1+i)^{-n}">
    <span class="katex-display">
      <span class="katex">
        <span class="katex-mathml">
          <math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
            <semantics>
              <mrow><mi>V</mi><mo>=</mo><mi>c</mi></mrow>
              <annotation encoding="application/x-tex">V = c(1+i)^{-1} + c(1+i)^{-2} + \\cdots + c(1+i)^{-n}</annotation>
            </semantics>
          </math>
        </span>
        <span class="katex-html" aria-hidden="true"><span>V=c(1+i)-1+c(1+i)-2+⋯+c(1+i)-n</span></span>
      </span>
    </span>
  </div>
</div>`;

function createMockClipboard({ html = "", plain = "", files = [] } = {}) {
  const items = files.map((file) => ({
    type: file.type,
    getAsFile: () => file,
  }));
  return {
    getData: (type) => (type === "text/html" ? html : type === "text/plain" ? plain : ""),
    items,
  };
}

function createPasteEvent(clipboardData) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: clipboardData });
  return event;
}

describe("editorPaste — normalización de fórmulas y formato rico al pegar", () => {
  let editor;
  let container;

  beforeEach(() => {
    const rect = { left: 0, right: 200, top: 0, bottom: 24, width: 200, height: 24 };
    Range.prototype.getBoundingClientRect = () => rect;
    Range.prototype.getClientRects = () => [rect];
    container = document.createElement("div");
    document.body.appendChild(container);
    editor = new Editor({
      element: container,
      extensions: buildExtensions(),
      content: "<p></p>",
    });
  });

  afterEach(() => {
    editor?.destroy();
    container?.remove();
    jest.clearAllMocks();
  });

  test("extrae HTML estilo Gemini de la captura sin duplicar KaTeX ni arrastrar estilos oscuros y renderiza de inmediato", () => {
    const clip = createMockClipboard({
      html: GEMINI_SCREENSHOT_HTML,
      plain: "1. La ecuación de partida...\nV = c(1+i)−1",
    });
    const payload = clipboardToEditorHtml(clip);
    expect(payload?.kind).toBe("html");
    expect(payload.html).not.toContain("rgb(227");
    expect(payload.html).not.toContain("katex-html");
    expect(payload.html).toContain("<strong>1. La ecuación de partida (la suma de los valores actuales):</strong>");
    expect(payload.html).toContain("$$V = c(1+i)^{-1} + c(1+i)^{-2} + \\cdots + c(1+i)^{-n}$$");

    editor.view.focus();
    const pasteEvent = createPasteEvent(clip);
    const handled = editor.view.someProp("handlePaste", (fn) => fn(editor.view, pasteEvent));
    expect(handled).toBe(true);
    expect(pasteEvent.defaultPrevented).toBe(true);

    const marks = htmlToMarks(editor.getHTML());
    expect(marks).toBe(
      htmlToMarks(
        "<p><strong>1. La ecuación de partida (la suma de los valores actuales):</strong></p>" +
          "<p>$$V = c(1+i)^{-1} + c(1+i)^{-2} + \\cdots + c(1+i)^{-n}$$</p>"
      )
    );
    expect(marks).not.toContain("V=c");
    expect(marks).toContain("$$V = c(1+i)^{-1} + c(1+i)^{-2} + \\cdots + c(1+i)^{-n}$$");

    // El widget matemático se renderiza de inmediato (sin quedar atrapado como código crudo)
    // y el cursor queda fuera de .nf-math-hidden-src listo para seguir escribiendo debajo.
    const widget = editor.view.dom.querySelector(".nf-math-widget.nf-math-block");
    expect(widget).not.toBeNull();
    expect(editor.view.dom.querySelector(".nf-math-source")).toBeNull();

    // Round-trip hacia RichText (lectura en repaso / nota) y reapertura del editor.
    const richBlocks = groupDisplayMathBlocks(parseRich(marks).map(describeBlock));
    expect(richBlocks[0].spans[0]).toMatchObject({
      text: "1. La ecuación de partida (la suma de los valores actuales):",
      bold: true,
    });
    expect(richBlocks[1]).toEqual({
      kind: "mathBlock",
      latex: "V = c(1+i)^{-1} + c(1+i)^{-2} + \\cdots + c(1+i)^{-n}",
      align: null,
    });

    editor.commands.setContent(marksToHtml(marks));
    expect(htmlToMarks(editor.getHTML())).toBe(marks);
  });

  test("soporta ChatGPT KaTeX inline/display, MathJax, Wikipedia, Gimnasio y MathML puro sin annotation", () => {
    const html = [
      '<p>Sea <span class="katex"><span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">H_k</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">Hk</span></span> finito.</p>',
      '<mjx-container display="true"><mjx-assistive-mml><math alttext="a^2 + b^2 = c^2"></math></mjx-assistive-mml><svg></svg></mjx-container>',
      '<span class="mwe-math-element"><math><annotation encoding="application/x-tex">{\\displaystyle \\int_0^1 x\\,dx}</annotation></math><img class="mwe-math-fallback-image-inline" src="https://x.test/eq.png"></span>',
      '<div class="ac-math-block"><math><annotation encoding="application/x-tex">\\bar{h} \\implies \\cdots</annotation></math></div>',
      '<button>Copiar</button>',
    ].join("");

    const normalized = normalizeClipboardHtml(html);
    expect(normalized).toContain("<p>Sea $H_k$ finito.</p>");
    expect(normalized).toContain("<p>$$a^2 + b^2 = c^2$$</p>");
    expect(normalized).toContain("$\\int_0^1 x\\,dx$");
    expect(normalized).toContain("<p>$$\\bar{h} \\implies \\cdots$$</p>");
    expect(normalized).not.toContain("Hk");
    expect(normalized).not.toContain("Copiar");
    expect(normalized).not.toContain("<img");

    const pureMathDoc = new DOMParser().parseFromString(
      "<math><mfrac><msup><mi>x</mi><mn>2</mn></msup><msqrt><msub><mi>a</mi><mi>n</mi></msub></msqrt></mfrac></math>",
      "text/html"
    );
    expect(mathMlToLatex(pureMathDoc.body.querySelector("math"))).toBe("\\frac{x^2}{\\sqrt{a_n}}");
  });

  test("separa fórmulas en bloque aunque vengan envueltas en strong o párrafo", () => {
    const html =
      '<p><strong>Intro: <span class="katex-display"><span class="katex-mathml"><math display="block"><annotation encoding="application/x-tex">E = mc^2</annotation></math></span></span> final</strong></p>';
    const normalized = normalizeClipboardHtml(html);
    expect(normalized).toContain("<strong>Intro: </strong>");
    expect(normalized).toContain("<p>$$E = mc^2$$</p>");
    expect(normalized).toContain("<strong> final</strong>");
  });

  test("convierte Markdown + LaTeX multilínea de botón Copiar y protege sintaxis dentro de $...$", () => {
    const md = [
      "### Resumen",
      "",
      "**1. La ecuación de partida (la suma de los valores actuales):**",
      "",
      "$$",
      "V = c(1+i)^{-1} + c(1+i)^{-2} + \\cdots + c(1+i)^{-n}",
      "$$",
      "",
      "Sea \\(x_1 * y_2\\) con **énfasis**.",
      "",
      "- Punto ==clave==",
      "> Cita ~~vieja~~",
    ].join("\n");

    const html = markdownClipboardToHtml(md);
    expect(html).toContain("<h3>Resumen</h3>");
    expect(html).toContain("<p><strong>1. La ecuación de partida (la suma de los valores actuales):</strong></p>");
    expect(html).toContain("<p>$$V = c(1+i)^{-1} + c(1+i)^{-2} + \\cdots + c(1+i)^{-n}$$</p>");
    expect(html).toContain("<p>Sea $x_1 * y_2$ con <strong>énfasis</strong>.</p>");
    expect(html).toContain("<ul><li><p>Punto <mark>clave</mark></p></li></ul>");
    expect(html).toContain("<blockquote><p>Cita <s>vieja</s></p></blockquote>");
  });

  test("deduplica texto plano de KaTeX, convierte ecuación Unicode independiente y respeta prosa normal", () => {
    const unicodeEq = "V = c(1+i)⁻¹ + c(1+i)⁻² + ⋯ + c(1+i)⁻ⁿ";
    const eqHtml = markdownClipboardToHtml(unicodeEq);
    expect(eqHtml).toBe("<p>$$V = c(1+i)^{-1} + c(1+i)^{-2} + \\cdots + c(1+i)^{-n}$$</p>");

    const katexPlainDup = "H_k = \\sum_{i=1}^k \\frac{1}{i}\nH_k = ∑_{i=1}^k 1/i";
    expect(markdownClipboardToHtml(katexPlainDup)).toBe("<p>$$H_k = \\sum_{i=1}^k \\frac{1}{i}$$</p>");

    // Prosa cotidiana, precios y multiplicaciones no deben disparar conversión matemática.
    expect(markdownClipboardToHtml("El departamento mide 120 m² y cuesta $100 por mes.")).toBeNull();
    expect(markdownClipboardToHtml("2 * 3 * 4 = 24")).toBeNull();
    expect(markdownClipboardToHtml("Texto común sin marcas.")).toBeNull();

    // Si text/html viene solo como envoltorio plano de Chrome (<pre>/<span>), usa text/plain Markdown.
    const textareaCopy = createMockClipboard({
      html: '<pre style="color: #fff;">**Negrita** y \\(a+b\\)</pre>',
      plain: "**Negrita** y \\(a+b\\)",
    });
    expect(clipboardToEditorHtml(textareaCopy)).toEqual({
      kind: "html",
      html: "<p><strong>Negrita</strong> y $a+b$</p>",
    });
  });

  test("conserva el pegado de imágenes puras sin doble inserción", () => {
    const file = new File(["png"], "captura.png", { type: "image/png" });
    const imgOnlyClip = createMockClipboard({
      html: '<img src="https://example.com/formula.png">',
      plain: "",
      files: [file],
    });
    const payload = clipboardToEditorHtml(imgOnlyClip);
    expect(payload).toEqual({ kind: "image", file });

    const pasteEvent = createPasteEvent(imgOnlyClip);
    const handled = editor.view.someProp("handlePaste", (fn) => fn(editor.view, pasteEvent));
    expect(handled).toBe(true);
    expect(pasteEvent.defaultPrevented).toBe(true);
    expect(insertImageFile).toBeDefined();
  });

  test("MathLivePreview renderiza bloques multilínea $$...$$ y permite editar al hacer click en el widget", () => {
    editor.view.focus();
    editor.commands.setContent("<p>$$</p><p>V = c(1+i)^{-1}</p><p>$$</p><p>Siguiente</p>");
    const lastBlockPos = editor.state.doc.content.size - 2;
    editor.commands.setTextSelection(lastBlockPos);

    const widget = editor.view.dom.querySelector(".nf-math-widget.nf-math-block");
    expect(widget).not.toBeNull();
    expect(editor.view.dom.querySelectorAll(".nf-math-hidden-line")).toHaveLength(2);

    widget.click();
    expect(editor.view.dom.querySelector(".nf-math-source")).not.toBeNull();
    expect(editor.view.dom.querySelector(".nf-math-widget")).toBeNull();

    // Al mover el cursor al párrafo siguiente vuelve a renderizar como bloque visual.
    editor.commands.setTextSelection(editor.state.doc.content.size - 2);
    expect(editor.view.dom.querySelector(".nf-math-widget.nf-math-block")).not.toBeNull();
  });
});
