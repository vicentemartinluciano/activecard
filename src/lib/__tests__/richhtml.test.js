import { describeBlock, htmlToMarks, marksToHtml } from "../richhtml";
import { ALIGN_SENTINELS, IMG_SENTINEL, parseRich, toPlainText } from "../richtext";

// Criterio de equivalencia: dos textos de marcas son equivalentes si
// parseRich los ve igual (mismos bloques, mismos spans con los mismos
// estilos) — los merges de spans adyacentes no deben contar como diferencia.
function semantic(marcas) {
  return parseRich(marcas).map((b) => ({
    type: b.type,
    spans: b.spans
      .filter((s) => s.text !== "")
      .map((s) => ({
        text: s.text,
        bold: !!s.bold,
        italic: !!s.italic,
        underline: !!s.underline,
        highlight: !!s.highlight,
        color: s.color || null,
      })),
  }));
}

// El round-trip completo: marcas → HTML → marcas.
const roundTrip = (marcas) => htmlToMarks(marksToHtml(marcas));

function expectRoundTrip(marcas) {
  expect(semantic(roundTrip(marcas))).toEqual(semantic(marcas));
}

describe("marcas ↔ HTML: round-trip por marca", () => {
  test.each([
    ["negrita", "esto es **importante** acá"],
    ["cursiva", "esto es *sutil* acá"],
    ["subrayado", "esto es __clave__ acá"],
    ["resaltado", "ojo con ==esto== acá"],
    ["color", "marcá [[rojo:la excepción]] siempre"],
    ["lista", "- primero\n- segundo\n- tercero"],
    ["texto plano", "sin ninguna marca"],
  ])("%s sobrevive el round-trip", (_, marcas) => {
    expectRoundTrip(marcas);
  });
});

describe("marcas ↔ HTML: marcas anidadas", () => {
  test("negrita con resaltado adentro", () => {
    expectRoundTrip("**alerta ==roja== total**");
  });

  test("color con negrita adentro", () => {
    expectRoundTrip("[[azul:cuidado **mucho** acá]]");
  });

  test("resaltado con subrayado adentro", () => {
    expectRoundTrip("==__doble marca__==");
  });

  test("negrita+cursiva CON otra marca en el medio se conserva entera", () => {
    // El separador (__) evita que ** y * queden adyacentes.
    const html = "<p><strong><u><em>a</em></u></strong></p>";
    const marcas = htmlToMarks(html);
    const [span] = parseRich(marcas)[0].spans;
    expect(span).toMatchObject({ text: "a", bold: true, italic: true, underline: true });
  });

  test("negrita+cursiva SOLAS: se conserva negrita y se descarta cursiva (limitación heredada)", () => {
    // *** no es expresable en la gramática de richtext.js: la regla es
    // determinística (bold gana) y por lo tanto idempotente.
    const marcas = htmlToMarks("<p><strong><em>a</em></strong></p>");
    expect(marcas).toBe("**a**");
    const [span] = parseRich(marcas)[0].spans;
    expect(span.bold).toBe(true);
    expect(span.italic).toBeFalsy();
  });
});

describe("marcas ↔ HTML: bloques y listas", () => {
  test("lista con formato adentro", () => {
    expectRoundTrip("- **Integridad** → cuidar la coherencia\n- *Otro* ítem");
  });

  test("líneas sueltas y listas mezcladas", () => {
    expectRoundTrip("Intro del tema\n- uno\n- dos\nCierre del tema");
  });

  test("línea vacía intermedia se preserva y la final se recorta", () => {
    expect(roundTrip("uno\n\ndos")).toBe("uno\n\ndos");
    expect(roundTrip("uno\n\n")).toBe("uno");
  });

  test("una corrida de - genera un solo <ul> con <p> adentro de cada <li>", () => {
    expect(marksToHtml("- a\n- b")).toBe("<ul><li><p>a</p></li><li><p>b</p></li></ul>");
  });
});

describe("divisor (---) y lista numerada", () => {
  test("--- va y vuelve como <hr>", () => {
    expect(marksToHtml("arriba\n---\nabajo")).toBe("<p>arriba</p><hr><p>abajo</p>");
    expect(roundTrip("arriba\n---\nabajo")).toBe("arriba\n---\nabajo");
  });

  test("lista numerada va y vuelve como <ol>", () => {
    expect(marksToHtml("1. uno\n2. dos")).toBe("<ol><li><p>uno</p></li><li><p>dos</p></li></ol>");
    expect(roundTrip("1. uno\n2. dos")).toBe("1. uno\n2. dos");
  });

  test("la numeración se regenera consecutiva (aunque venga desordenada)", () => {
    expect(roundTrip("1. uno\n5. dos\n9. tres")).toBe("1. uno\n2. dos\n3. tres");
  });

  test("<ol start> respeta el número inicial en ambas direcciones", () => {
    expect(marksToHtml("3. tres\n4. cuatro")).toContain('<ol start="3">');
    expect(htmlToMarks('<ol start="3"><li><p>tres</p></li><li><p>cuatro</p></li></ol>')).toBe(
      "3. tres\n4. cuatro"
    );
  });

  test("numerada con formato adentro y mezclada con viñetas", () => {
    expectRoundTrip("1. **uno** fuerte\n2. dos");
    expectRoundTrip("- viñeta\n1. numerada");
  });

  test("un número suelto en medio de una oración NO se vuelve lista", () => {
    expect(roundTrip("Fue en 1994. Un buen año")).toBe("Fue en 1994. Un buen año");
  });
});

describe("alineación por bloque", () => {
  const C = ALIGN_SENTINELS.center;
  const R = ALIGN_SENTINELS.right;

  test("izquierda es el default: sin sentinel ni style", () => {
    expect(marksToHtml("hola")).toBe("<p>hola</p>");
    expect(describeBlock(parseRich("hola")[0]).align).toBe("left");
  });

  test("centro va a text-align y vuelve con el sentinel", () => {
    expect(marksToHtml(`${C}hola`)).toBe('<p style="text-align: center">hola</p>');
    expect(htmlToMarks('<p style="text-align: center">hola</p>')).toBe(`${C}hola`);
  });

  test("derecha va y vuelve", () => {
    expect(marksToHtml(`${R}hola`)).toBe('<p style="text-align: right">hola</p>');
    expect(htmlToMarks('<p style="text-align: right">hola</p>')).toBe(`${R}hola`);
  });

  test("describeBlock reconoce el sentinel y lo saca de los spans", () => {
    const b = describeBlock(parseRich(`${C}hola`)[0]);
    expect(b.align).toBe("center");
    expect(b.spans.map((s) => s.text).join("")).toBe("hola");
  });

  test("round-trip de centro/derecha (incluye izquierda de vuelta)", () => {
    expect(roundTrip(`${C}centrado`)).toBe(`${C}centrado`);
    expect(roundTrip(`${R}derecha`)).toBe(`${R}derecha`);
    expect(roundTrip(`izq\n${C}centro\n${R}der`)).toBe(`izq\n${C}centro\n${R}der`);
  });

  test("la alineación convive con formato inline", () => {
    expect(roundTrip(`${C}**negrita** y [[rojo:color]]`)).toBe(`${C}**negrita** y [[rojo:color]]`);
    expect(marksToHtml(`${C}**a**`)).toBe('<p style="text-align: center"><strong>a</strong></p>');
  });

  test("las listas ignoran la alineación (siempre izquierda)", () => {
    // Aunque TipTap ponga text-align en el <p> interno del <li>, se descarta.
    expect(htmlToMarks('<ul><li><p style="text-align: center">a</p></li></ul>')).toBe("- a");
  });

  test("toPlainText ignora el sentinel de alineación", () => {
    expect(toPlainText(`${C}hola`)).toBe("hola");
    expect(toPlainText(`izq\n${R}der`)).toBe("izq\nder");
  });

  test("una tarjeta con líneas alineadas sobrevive intacta", () => {
    const tarjeta = [`${C}**Título centrado**`, "cuerpo a la izquierda", `${R}pie a la derecha`].join(
      "\n"
    );
    expect(roundTrip(tarjeta)).toBe(tarjeta);
  });
});

describe("bloque imagen (data URI inline)", () => {
  // 1x1 png real — termina en "==" (padding base64), el caso límite que podría
  // colisionar con la marca de resaltado.
  const DATA_URI =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const img = `${IMG_SENTINEL}${DATA_URI}`;

  test("marcas → HTML emite <img src>", () => {
    expect(marksToHtml(img)).toBe(`<img src="${DATA_URI}">`);
  });

  test("HTML → marcas lee el <img>", () => {
    expect(htmlToMarks(`<img src="${DATA_URI}">`)).toBe(img);
  });

  test("round-trip conserva el data URI EXACTO (incluido el == final)", () => {
    expect(roundTrip(img)).toBe(img);
  });

  test("describeBlock devuelve kind img con el src", () => {
    const b = describeBlock(parseRich(img)[0]);
    expect(b.kind).toBe("img");
    expect(b.src).toBe(DATA_URI);
  });

  test("imagen intercalada entre texto sobrevive", () => {
    const card = `Antes de la imagen\n${img}\nDespués de la imagen`;
    expect(roundTrip(card)).toBe(card);
  });

  test("toPlainText omite la imagen (no vuelca el base64)", () => {
    expect(toPlainText(img)).toBe("");
    expect(toPlainText(`hola\n${img}\nchau`)).toBe("hola\n\nchau");
  });

  test("<img> de TipTap con atributos extra igual se lee", () => {
    expect(htmlToMarks(`<img src="${DATA_URI}" class="x" draggable="true">`)).toBe(img);
  });
});

describe("HTML de TipTap real", () => {
  test("<li><p> anidado no genera bloque vacío", () => {
    expect(htmlToMarks("<ul><li><p>uno</p></li><li><p>dos</p></li></ul>")).toBe("- uno\n- dos");
  });

  test("span con data-color", () => {
    expect(htmlToMarks('<p><span data-color="verde">ok</span></p>')).toBe("[[verde:ok]]");
  });

  test("span con style color en hex o rgb() se mapea contra textColors", () => {
    expect(htmlToMarks('<p><span style="color: #E5484D">x</span></p>')).toBe("[[rojo:x]]");
    expect(htmlToMarks('<p><span style="color: rgb(229, 72, 77)">x</span></p>')).toBe("[[rojo:x]]");
  });

  test("un color desconocido se degrada a texto plano", () => {
    expect(htmlToMarks('<p><span style="color: #123456">x</span></p>')).toBe("x");
  });

  test("<br> corta línea", () => {
    expect(htmlToMarks("<p>uno<br>dos</p>")).toBe("uno\ndos");
  });
});

describe("HTML ajeno degradado", () => {
  test("títulos y tablas se degradan a bloques de texto", () => {
    expect(htmlToMarks("<h1>Título</h1><p>cuerpo</p>")).toBe("Título\ncuerpo");
    expect(htmlToMarks("<table><tr><td>a</td></tr><tr><td>b</td></tr></table>")).toBe("a\nb");
  });

  test("<script> y <style> se eliminan con su contenido", () => {
    expect(htmlToMarks('<p>hola</p><script>alert("x")</script>')).toBe("hola");
    expect(htmlToMarks("<style>p{color:red}</style><p>hola</p>")).toBe("hola");
  });

  test("tags sin cerrar no rompen el texto", () => {
    expect(htmlToMarks("<p><strong>a</p>")).toBe("**a**");
  });

  test("tags desconocidos se ignoran conservando el texto", () => {
    expect(htmlToMarks("<p>ho<custom>la</custom></p>")).toBe("hola");
  });
});

describe("entidades y escape", () => {
  test("los caracteres especiales se escapan al ir a HTML", () => {
    expect(marksToHtml("5 < 6 & 7 > 2")).toBe("<p>5 &lt; 6 &amp; 7 &gt; 2</p>");
  });

  test("y vuelven intactos", () => {
    expect(roundTrip("5 < 6 & 7 > 2")).toBe("5 < 6 & 7 > 2");
  });

  test("entidades nombradas y numéricas se decodifican", () => {
    expect(htmlToMarks("<p>&amp; &lt; &gt; &quot; &apos; &nbsp;fin</p>")).toBe("& < > \" '  fin");
    expect(htmlToMarks("<p>&#8594; &#x2192;</p>")).toBe("→ →");
  });

  test("la flecha → sobrevive como carácter literal", () => {
    expectRoundTrip("- **Integridad** → coherencia");
  });
});

describe("vacíos e idempotencia", () => {
  test.each([
    ["string vacío", ""],
    ["null", null],
    ["undefined", undefined],
  ])("%s → HTML vacío-seguro y vuelta a string vacío", (_, value) => {
    expect(htmlToMarks(marksToHtml(value))).toBe("");
  });

  test("<p></p> vuelve como string vacío", () => {
    expect(htmlToMarks("<p></p>")).toBe("");
  });

  test("aplicar el round-trip dos veces da lo mismo que una", () => {
    const casos = [
      "- **a** → b\n- ==c==",
      "[[violeta:x **y**]]",
      "1. uno\n2. dos",
      "arriba\n---\nabajo",
      "**a**", // el caso del italic descartado, ya normalizado
    ];
    for (const marcas of casos) {
      const once = roundTrip(marcas);
      expect(roundTrip(once)).toBe(once);
    }
  });

  test("una tarjeta real completa sobrevive intacta", () => {
    const tarjeta = [
      "Es el conjunto de: **C.H.A.A**",
      "---",
      "- **Conocimientos** → lo que sabés",
      "- **Habilidades** → lo que podés hacer",
      "1. Primero esto",
      "2. Después esto otro",
      "==NO confundir con [[rojo:actitudes]]==",
      "*Aclaración al pie*",
    ].join("\n");
    expectRoundTrip(tarjeta);
    expect(roundTrip(tarjeta)).toBe(tarjeta);
  });
});
