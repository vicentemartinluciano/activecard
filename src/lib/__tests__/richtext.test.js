import {
  parseRich,
  toPlainText,
  toggleListLines,
  wrapColor,
  wrapSelection,
} from "../richtext";

describe("parseRich", () => {
  test("texto plano sin marcas", () => {
    expect(parseRich("hola mundo")).toEqual([{ type: "p", spans: [{ text: "hola mundo" }] }]);
  });

  test("negrita", () => {
    expect(parseRich("**bold**")).toEqual([
      { type: "p", spans: [{ text: "bold", bold: true }] },
    ]);
  });

  test("cursiva", () => {
    expect(parseRich("*italic*")).toEqual([
      { type: "p", spans: [{ text: "italic", italic: true }] },
    ]);
  });

  test("subrayado", () => {
    expect(parseRich("__underline__")).toEqual([
      { type: "p", spans: [{ text: "underline", underline: true }] },
    ]);
  });

  test("resaltado", () => {
    expect(parseRich("==highlight==")).toEqual([
      { type: "p", spans: [{ text: "highlight", highlight: true }] },
    ]);
  });

  test("color de texto", () => {
    expect(parseRich("[[rojo:urgente]]")).toEqual([
      { type: "p", spans: [{ text: "urgente", color: "rojo" }] },
    ]);
  });

  test("marcas anidadas: negrita con resaltado adentro", () => {
    expect(parseRich("**negrita con ==resaltado==**")).toEqual([
      {
        type: "p",
        spans: [
          { text: "negrita con ", bold: true },
          { text: "resaltado", bold: true, highlight: true },
        ],
      },
    ]);
  });

  test("marca sin cierre queda literal, sin reinterpretarse como otra marca", () => {
    expect(parseRich("**no close")).toEqual([
      { type: "p", spans: [{ text: "**no close" }] },
    ]);
    expect(parseRich("texto *suelto sin cerrar")).toEqual([
      { type: "p", spans: [{ text: "texto *suelto sin cerrar" }] },
    ]);
  });

  test("color con sintaxis inválida (sin dos puntos o con dígitos) queda literal", () => {
    expect(parseRich("[[rojotexto]]")).toEqual([
      { type: "p", spans: [{ text: "[[rojotexto]]" }] },
    ]);
    expect(parseRich("[[123:texto]]")).toEqual([
      { type: "p", spans: [{ text: "[[123:texto]]" }] },
    ]);
  });

  test("líneas que empiezan con '- ' son ítems de lista", () => {
    expect(parseRich("- uno\n- dos\ntres")).toEqual([
      { type: "li", spans: [{ text: "uno" }] },
      { type: "li", spans: [{ text: "dos" }] },
      { type: "p", spans: [{ text: "tres" }] },
    ]);
  });

  test("varias marcas en la misma línea, cada una independiente", () => {
    expect(parseRich("**a** normal *b*")).toEqual([
      {
        type: "p",
        spans: [
          { text: "a", bold: true },
          { text: " normal " },
          { text: "b", italic: true },
        ],
      },
    ]);
  });

  test("texto vacío o null no rompe", () => {
    expect(parseRich("")).toEqual([{ type: "p", spans: [] }]);
    expect(parseRich(null)).toEqual([{ type: "p", spans: [] }]);
  });
});

describe("toPlainText", () => {
  test("quita todas las marcas y conserva el texto", () => {
    expect(toPlainText("**bold** y ==hl==\n- item de lista")).toBe(
      "bold y hl\nitem de lista"
    );
  });

  test("con color también queda solo el texto", () => {
    expect(toPlainText("[[azul:nota]] normal")).toBe("nota normal");
  });

  test("texto sin marcas queda igual", () => {
    expect(toPlainText("simple")).toBe("simple");
  });
});

describe("wrapSelection", () => {
  test("envuelve el rango seleccionado con el marcador", () => {
    expect(wrapSelection("hello world", 0, 5, "**")).toEqual({
      text: "**hello** world",
      start: 0,
      end: 9,
    });
  });

  test("aplicar el mismo marcador sobre un rango ya envuelto lo saca (toggle)", () => {
    const { text, start, end } = wrapSelection("hello world", 0, 5, "**");
    const toggled = wrapSelection(text, start, end, "**");
    expect(toggled).toEqual({ text: "hello world", start: 0, end: 5 });
  });

  test("sin selección (start === end) no hace nada", () => {
    expect(wrapSelection("hello", 2, 2, "**")).toEqual({ text: "hello", start: 2, end: 2 });
  });

  test("envuelve un rango en el medio del texto", () => {
    expect(wrapSelection("uno dos tres", 4, 7, "*")).toEqual({
      text: "uno *dos* tres",
      start: 4,
      end: 9,
    });
  });
});

describe("wrapColor", () => {
  test("envuelve el rango en la marca de color", () => {
    expect(wrapColor("nota importante", 5, 15, "rojo")).toEqual({
      text: "nota [[rojo:importante]]",
      start: 5,
      end: 24,
    });
  });

  test("sin selección no hace nada", () => {
    expect(wrapColor("nota", 1, 1, "rojo")).toEqual({ text: "nota", start: 1, end: 1 });
  });
});

describe("toggleListLines", () => {
  test("agrega '- ' a las líneas tocadas por la selección", () => {
    expect(toggleListLines("a\nb\nc", 0, 1)).toBe("- a\nb\nc");
  });

  test("agrega '- ' a varias líneas si la selección las abarca", () => {
    expect(toggleListLines("a\nb\nc", 0, 5)).toBe("- a\n- b\n- c");
  });

  test("si todas las líneas tocadas ya son lista, las saca (toggle off)", () => {
    expect(toggleListLines("- a\n- b", 0, 7)).toBe("a\nb");
  });
});
