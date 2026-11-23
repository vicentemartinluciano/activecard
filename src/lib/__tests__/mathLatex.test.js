import { hasMathSyntax, matchMathAt, parseLatex, splitMathSegments } from "../mathLatex";
import { describeBlock, groupDisplayMathBlocks } from "../richhtml";
import { parseRich, toPlainText } from "../richtext";

describe("mathLatex scanner y parser", () => {
  test("detecta y separa sintaxis LaTeX inline y en bloque", () => {
    expect(hasMathSyntax("Costo $100 hoy")).toBe(false);
    expect(hasMathSyntax("Valor esperado $E[X] = \\mu$ hoy")).toBe(true);

    expect(splitMathSegments("Sea $H_k = \\sum_{i=1}^k \\frac{1}{i}$ finito.")).toEqual([
      { type: "text", text: "Sea ", from: 0, to: 4 },
      {
        type: "math",
        display: false,
        latex: "H_k = \\sum_{i=1}^k \\frac{1}{i}",
        raw: "$H_k = \\sum_{i=1}^k \\frac{1}{i}$",
        from: 4,
        to: 36,
      },
      { type: "text", text: " finito.", from: 36, to: 44 },
    ]);

    expect(splitMathSegments("Inline \\(a + b\\) y bloque \\[\\bar{h} \\implies \\cdots\\]")).toEqual([
      { type: "text", text: "Inline ", from: 0, to: 7 },
      { type: "math", display: false, latex: "a + b", raw: "\\(a + b\\)", from: 7, to: 16 },
      { type: "text", text: " y bloque ", from: 16, to: 26 },
      {
        type: "math",
        display: true,
        latex: "\\bar{h} \\implies \\cdots",
        raw: "\\[\\bar{h} \\implies \\cdots\\]",
        from: 26,
        to: 53,
      },
    ]);
  });

  test("no dispara modo matemático con precios o signos $ de moneda ni escapes", () => {
    const currency1 = "Cuesta $100 en efectivo";
    const currency2 = "Entre $50 y $80 pesos";
    const escaped = "Literal \\$x\\$ en prosa";

    expect(splitMathSegments(currency1)).toEqual([{ type: "text", text: currency1, from: 0, to: currency1.length }]);
    expect(splitMathSegments(currency2)).toEqual([{ type: "text", text: currency2, from: 0, to: currency2.length }]);
    expect(splitMathSegments(escaped)).toEqual([{ type: "text", text: escaped, from: 0, to: escaped.length }]);
    expect(matchMathAt("$ 50", 0)).toBeNull();
    expect(matchMathAt("50$", 2)).toBeNull();
  });

  test("parsea fracciones, sub/superíndices, acentos, raíces y casos a un AST estructurado", () => {
    const ast = parseLatex("(1+H_k)^{1/k} = \\bar{h} + \\sqrt[3]{\\frac{\\alpha}{\\beta}}");
    expect(ast.type).toBe("group");
    expect(ast.items.some((n) => n.type === "script")).toBe(true);
    expect(ast.items.some((n) => n.type === "accent" && n.accent === "bar")).toBe(true);
    expect(ast.items.some((n) => n.type === "sqrt" && n.index)).toBe(true);

    const casesAst = parseLatex("f(x) = \\begin{cases} 1 & x > 0 \\\\ 0 & x \\le 0 \\end{cases}");
    const matrix = casesAst.items.find((n) => n.type === "matrix");
    expect(matrix).toBeDefined();
    expect(matrix.env).toBe("cases");
    expect(matrix.rows).toHaveLength(2);
    expect(matrix.rows[0]).toHaveLength(2);
  });

  test("protege marcas markdown dentro de LaTeX en parseRich y agrupa bloques multilínea", () => {
    const rich = parseRich("**Crecimiento** de $x_1 * y_2 + \\bar{h}$ hoy");
    expect(rich[0].spans.some((s) => s.bold && s.text === "Crecimiento")).toBe(true);
    expect(rich[0].spans.some((s) => s.italic)).toBe(false);
    expect(toPlainText("**Crecimiento** de $x_1 * y_2$")).toBe("Crecimiento de $x_1 * y_2$");

    const multi = "Antes\n$$\nH_k = \\frac{1}{k}\n$$\nDespués";
    const parsed = parseRich(multi);
    expect(parsed).toHaveLength(5);
    const grouped = groupDisplayMathBlocks(parsed.map(describeBlock));
    expect(grouped).toHaveLength(3);
    expect(grouped[1]).toEqual({
      kind: "mathBlock",
      latex: "H_k = \\frac{1}{k}",
      align: null,
    });
  });
});
