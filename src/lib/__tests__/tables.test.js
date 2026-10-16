import { htmlToMarks, marksToHtml } from "../richhtml";
import { parseRich, toPlainText } from "../richtext";

test("una tabla conserva filas, encabezados, formato, imágenes y texto alrededor", () => {
  const html = '<p>Antes</p><table><tbody><tr><th><p>Concepto</p></th><th><p>Ejemplo</p></th></tr><tr><td><p><strong>Oferta</strong></p><p>Segundo párrafo</p></td><td><p>A &amp; B</p><img src="data:image/png;base64,YWJj"></td></tr></tbody></table><p>Después</p>';
  const marks = htmlToMarks(html);
  expect(parseRich(marks).map((block) => block.type)).toEqual(["p", "table", "p"]);
  expect(toPlainText(marks)).toBe("Antes\nConcepto | Ejemplo\nOferta\nSegundo párrafo | A & B\n\nDespués");
  expect(marksToHtml(marks)).toContain("<strong>Oferta</strong>");
  expect(marksToHtml(marks)).toContain('src="data:image/png;base64,YWJj"');
  expect(htmlToMarks(marksToHtml(marks))).toBe(marks);
});

test("tablas consecutivas y caracteres de marcado no mezclan sus celdas", () => {
  const html = '<table><tr><td><p>1</p></td><td><p>2</p></td></tr></table><table><tr><th><p>Título</p></th></tr></table>';
  const marks = htmlToMarks(html);
  expect(parseRich(marks)).toHaveLength(2);
  expect(toPlainText(marks)).toBe("1 | 2\nTítulo");
  expect(htmlToMarks(marksToHtml(marks))).toBe(marks);
});

test("los spans de celdas se conservan y HTML ejecutable no se vuelve contenido", () => {
  const marks = htmlToMarks('<table><tr><td colspan="2"><p>Seguro</p><script>alert(1)</script></td></tr></table>');
  expect(marksToHtml(marks)).toContain('colspan="2"');
  expect(toPlainText(marks)).toBe("Seguro");
});
