import {
  buildEditMap,
  diffDisplays,
  displayToSource,
  editSource,
  getActiveMarks,
  parseRich,
  setColor,
  sourceToDisplay,
  toggleMark,
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

describe("parseRich — anidamiento profundo", () => {
  test("negrita con color adentro: **[[azul:concepto]]**", () => {
    expect(parseRich("**[[azul:concepto]]**")).toEqual([
      { type: "p", spans: [{ text: "concepto", bold: true, color: "azul" }] },
    ]);
  });

  test("color con negrita adentro: [[rojo:**x**]]", () => {
    expect(parseRich("[[rojo:**x**]]")).toEqual([
      { type: "p", spans: [{ text: "x", color: "rojo", bold: true }] },
    ]);
  });

  test("negrita + subrayado: **__x__**", () => {
    expect(parseRich("**__x__**")).toEqual([
      { type: "p", spans: [{ text: "x", bold: true, underline: true }] },
    ]);
  });

  test("triple anidado: **[[verde:__núcleo__]]**", () => {
    expect(parseRich("**[[verde:__núcleo__]]**")).toEqual([
      {
        type: "p",
        spans: [{ text: "núcleo", bold: true, color: "verde", underline: true }],
      },
    ]);
  });

  test("marcas cruzadas mal balanceadas no crashean y degradan a literal", () => {
    expect(parseRich("**a __b** c__")).toEqual([
      {
        type: "p",
        spans: [
          { text: "a __b", bold: true },
          { text: " c__" },
        ],
      },
    ]);
  });

  test("runs anidados y consecutivos en la misma línea", () => {
    expect(parseRich("**a *b* y **c** d**")).toEqual([
      {
        type: "p",
        spans: [
          { text: "a ", bold: true },
          { text: "b", bold: true, italic: true },
          { text: " y ", bold: true },
          { text: "c" },
          { text: " d", bold: true },
        ],
      },
    ]);
  });
});

describe("buildEditMap", () => {
  test("el display no tiene marcadores; el '- ' de lista y los \\n se conservan", () => {
    const map = buildEditMap("- **hola** mundo\n[[rojo:ojo]]");
    expect(map.display).toBe("- hola mundo\nojo");
  });

  test("texto plano mapea 1 a 1", () => {
    const map = buildEditMap("abc");
    expect(map.display).toBe("abc");
    expect(map.segments).toEqual([
      { dStart: 0, dEnd: 3, sStart: 0, sEnd: 3, styles: {} },
    ]);
  });

  test("los segments llevan los estilos del tramo", () => {
    const map = buildEditMap("**ab**cd");
    expect(map.display).toBe("abcd");
    expect(map.segments).toEqual([
      { dStart: 0, dEnd: 2, sStart: 2, sEnd: 4, styles: { bold: true } },
      { dStart: 2, dEnd: 4, sStart: 6, sEnd: 8, styles: {} },
    ]);
  });

  test("texto vacío", () => {
    expect(buildEditMap("")).toEqual({ display: "", segments: [] });
  });
});

describe("displayToSource / sourceToDisplay", () => {
  const map = buildEditMap("**abc**de");
  // source: **abc**de   display: abcde
  //           23456        01234

  test("dentro de un segment mapea directo", () => {
    expect(displayToSource(map, 1, "left")).toBe(3);
    expect(displayToSource(map, 4, "left")).toBe(8);
  });

  test("en la frontera, bias left cae dentro de la marca que cierra", () => {
    expect(displayToSource(map, 3, "left")).toBe(5);
  });

  test("en la frontera, bias right cae fuera de la marca (inicio del siguiente)", () => {
    expect(displayToSource(map, 3, "right")).toBe(7);
  });

  test("selección display [0,3) con right/left cae en el inner del run", () => {
    expect(displayToSource(map, 0, "right")).toBe(2);
    expect(displayToSource(map, 3, "left")).toBe(5);
  });

  test("source a display salta los marcadores", () => {
    expect(sourceToDisplay(map, 0)).toBe(0);
    expect(sourceToDisplay(map, 2)).toBe(0);
    expect(sourceToDisplay(map, 4)).toBe(2);
    expect(sourceToDisplay(map, 7)).toBe(3);
    expect(sourceToDisplay(map, 9)).toBe(5);
  });

  test("multilínea: los índices cruzan el \\n correctamente", () => {
    const m = buildEditMap("**a**\n- b");
    expect(m.display).toBe("a\n- b");
    expect(displayToSource(m, 2, "right")).toBe(6);
    expect(sourceToDisplay(m, 8)).toBe(4);
  });

  test("display vacío devuelve 0", () => {
    const empty = buildEditMap("");
    expect(displayToSource(empty, 0, "left")).toBe(0);
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

describe("getActiveMarks", () => {
  test("rango homogéneo con la marca", () => {
    expect(getActiveMarks("**hola**", 2, 6)).toEqual({
      bold: true,
      italic: false,
      underline: false,
      highlight: false,
      color: null,
      list: false,
    });
  });

  test("rango mixto no reporta la marca", () => {
    expect(getActiveMarks("**a**b", 2, 6).bold).toBe(false);
  });

  test("color común del rango", () => {
    expect(getActiveMarks("[[rojo:abc]]", 7, 10).color).toBe("rojo");
  });

  test("rango colapsado hereda los estilos del carácter a la izquierda", () => {
    expect(getActiveMarks("**ab**", 4, 4).bold).toBe(true);
    expect(getActiveMarks("**ab**cd", 8, 8).bold).toBe(false);
  });

  test("list solo si todas las líneas tocadas son lista", () => {
    expect(getActiveMarks("- a\n- b", 0, 7).list).toBe(true);
    expect(getActiveMarks("- a\nb", 0, 5).list).toBe(false);
  });

  test("estilos anidados se reportan juntos", () => {
    const marks = getActiveMarks("**[[azul:x]]**", 9, 10);
    expect(marks.bold).toBe(true);
    expect(marks.color).toBe("azul");
  });
});

describe("toggleMark", () => {
  test("envuelve el rango sin marca y deja la selección en el inner", () => {
    expect(toggleMark("hello world", 0, 5, "**")).toEqual({
      text: "**hello** world",
      start: 2,
      end: 7,
    });
  });

  test("quita la marca cuando la selección es el inner del run", () => {
    expect(toggleMark("**hello** world", 2, 7, "**")).toEqual({
      text: "hello world",
      start: 0,
      end: 5,
    });
  });

  test("quita la marca cuando la selección incluye los marcadores", () => {
    expect(toggleMark("**hello** world", 0, 9, "**")).toEqual({
      text: "hello world",
      start: 0,
      end: 5,
    });
  });

  test("parte el run quirúrgicamente cuando la selección está en el medio", () => {
    expect(toggleMark("**abc def ghi**", 6, 9, "**")).toEqual({
      text: "**abc **def** ghi**",
      start: 8,
      end: 11,
    });
  });

  test("quitar la marca externa conserva las anidadas", () => {
    expect(toggleMark("**[[azul:abc]]**", 9, 12, "**")).toEqual({
      text: "[[azul:abc]]",
      start: 7,
      end: 10,
    });
  });

  test("rango mixto aplica la marca a todo (unifica)", () => {
    expect(toggleMark("**a**b", 2, 6, "**")).toEqual({
      text: "**ab**",
      start: 2,
      end: 4,
    });
  });

  test("sin selección no hace nada", () => {
    expect(toggleMark("hola", 2, 2, "**")).toEqual({ text: "hola", start: 2, end: 2 });
  });
});

describe("setColor", () => {
  test("envuelve el rango sin color", () => {
    expect(setColor("nota importante", 5, 15, "rojo")).toEqual({
      text: "nota [[rojo:importante]]",
      start: 12,
      end: 22,
    });
  });

  test("reemplaza la clave si el rango ya tiene otro color", () => {
    expect(setColor("[[azul:texto]]", 7, 12, "verde")).toEqual({
      text: "[[verde:texto]]",
      start: 8,
      end: 13,
    });
  });

  test("mismo color hace toggle y lo quita", () => {
    expect(setColor("[[azul:texto]]", 7, 12, "azul")).toEqual({
      text: "texto",
      start: 0,
      end: 5,
    });
  });

  test("reemplazar el color conserva las otras marcas anidadas", () => {
    expect(setColor("**[[azul:x]]**", 9, 10, "verde")).toEqual({
      text: "**[[verde:x]]**",
      start: 10,
      end: 11,
    });
  });
});

describe("diffDisplays", () => {
  test("tipeo de un carácter", () => {
    expect(diffDisplays("abc", "abxc")).toEqual({ dStart: 2, dEnd: 2, inserted: "x" });
  });

  test("borrado de un carácter", () => {
    expect(diffDisplays("abc", "ac")).toEqual({ dStart: 1, dEnd: 2, inserted: "" });
  });

  test("reemplazo multi-carácter (IME/autocorrect)", () => {
    expect(diffDisplays("hola mundo", "hola guapo")).toEqual({
      dStart: 5,
      dEnd: 9,
      inserted: "guap",
    });
  });

  test("sin cambios", () => {
    expect(diffDisplays("ab", "ab")).toEqual({ dStart: 2, dEnd: 2, inserted: "" });
  });
});

describe("editSource", () => {
  test("tipear al final de un run hereda su estilo (bias izquierdo)", () => {
    expect(editSource("**ab**cd", 2, 2, "x")).toBe("**abx**cd");
  });

  test("tipear en texto plano no toca las marcas", () => {
    expect(editSource("**ab**cd", 3, 3, "x")).toBe("**ab**cxd");
  });

  test("borrar cruzando el límite de un run preserva las marcas", () => {
    expect(editSource("**ab**cd", 1, 3, "")).toBe("**a**d");
  });

  test("borrar todo el contenido de un run limpia el par vacío", () => {
    expect(editSource("**ab**cd", 0, 2, "")).toBe("cd");
    expect(editSource("[[rojo:x]]y", 0, 1, "")).toBe("y");
  });

  test("un salto de línea dentro de un run lo cierra y reabre", () => {
    expect(editSource("**abc**", 2, 2, "\n")).toBe("**ab**\n**c**");
    expect(editSource("[[rojo:ab]]", 1, 1, "\n")).toBe("[[rojo:a]]\n[[rojo:b]]");
  });

  test("tipear los marcadores a mano completa el par (colapso estilo Notion)", () => {
    const step1 = editSource("abc", 0, 0, "*");
    expect(step1).toBe("*abc");
    const step2 = editSource(step1, 4, 4, "*");
    expect(step2).toBe("*abc*");
    expect(parseRich(step2)).toEqual([
      { type: "p", spans: [{ text: "abc", italic: true }] },
    ]);
  });
});
