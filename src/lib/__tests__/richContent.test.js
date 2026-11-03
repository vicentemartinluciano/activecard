import { htmlToMarks, marksToHtml } from "../richhtml";
import { hasRichContent, parseRich, toPlainText, encodeToggle, encodeTable } from "../richtext";
import { decodeFormatted, decodeList, encodeList, FORMATTED_SENTINEL, LIST_SENTINEL } from "../richContent";
import { buildDeckExport } from "../deckExport";
import { normalizeBackup } from "../backup";

const stable = html => {
  const saved = htmlToMarks(html);
  expect(htmlToMarks(marksToHtml(saved))).toBe(saved);
  return saved;
};
test.each(["**literal**", "*literal*", "__literal__", "==literal==", "~~literal~~", "[[rojo:literal]]", "- literal", "7. literal", "---", "2**3 + 4**5"])("texto literal conserva sus caracteres: %s", text => {
  const saved = stable(`<p>${text}</p>`);
  expect(toPlainText(saved)).toBe(text);
  expect(marksToHtml(saved)).toBe(`<p>${text}</p>`);
});
test.each(["<strong><em>ambas</em></strong>", "<em>uno<strong>dos</strong>tres</em>", "<u><s><mark><strong><em>todas</em></strong></mark></s></u>", '<strong><span data-color="azul"><em>azul</em></span></strong>'])("conserva estilos combinados: %s", inline => {
  const saved = stable(`<h2>${inline}<br>segunda línea</h2>`);
  const spans = parseRich(saved)[0].spans;
  expect(spans.some(span => span.bold && span.italic)).toBe(true);
  expect(toPlainText(saved)).toContain("\nsegunda línea");
  expect(marksToHtml(saved)).toContain("<h2>");
  expect(marksToHtml(saved)).toContain("<br>");
});
test.each(["ul", "ol"])("listas %s conservan tres niveles y párrafos adicionales", tag => {
  const html = `<${tag}${tag === "ol" ? ' start="4"' : ""}><li><p>Padre</p><p>Detalle</p><ul><li><p>Hijo</p><ol start="9"><li><p>Nieto</p></li></ol></li></ul></li><li><p>Hermano</p></li></${tag}>`;
  const saved = stable(html);
  expect(parseRich(saved)[0].type).toBe("list");
  expect(marksToHtml(saved)).toBe(html);
  expect(toPlainText(saved)).toContain("Padre\nDetalle\nHijo\n9. Nieto\nHermano");
});
test("listas dentro de tablas y desplegables conservan la estructura recursiva", () => {
  const inner = stable("<ul><li><p>Padre</p><ul><li><p><strong><em>Hijo</em></strong></p></li></ul></li></ul>");
  const table = encodeTable([[{ text: inner, header: true, colspan: 1, rowspan: 1 }]]);
  const toggle = encodeToggle("Título", table);
  const saved = stable(marksToHtml(toggle));
  expect(saved).toBe(toggle);
  expect(toPlainText(saved)).toBe("Título\nPadre\nHijo");
});
test("listas complejas con imágenes y desplegables conservan sus bloques", () => {
  const html = '<ul><li><p>Padre</p><details data-type="toggle"><summary><p>Título</p></summary><div data-type="toggle-content"><p>Cuerpo</p></div></details><img src="data:image/png;base64,AA=="></li></ul>';
  const saved = stable(html);
  expect(toPlainText(saved)).toContain("Padre\nTítulo\nCuerpo");
  expect(toPlainText(saved)).not.toMatch(/%7B|data:image|\uE03/);
  expect(marksToHtml(saved)).toContain("<details"); expect(marksToHtml(saved)).toContain("<img");
});
test("completar una cara reconoce una imagen dentro de una lista anidada", () => {
  const saved = stable('<ul><li><p></p><ul><li><p></p><img src="data:image/png;base64,AA=="></li></ul></li></ul>');
  expect(hasRichContent(saved)).toBe(true);
  expect(hasRichContent(encodeList({ ordered: false, start: 1, items: [""] }))).toBe(false);
});
test("datos de extensiones dañados vuelven a texto y no se ejecutan como HTML", () => {
  for (const value of [LIST_SENTINEL + "%broken", FORMATTED_SENTINEL + "%broken", FORMATTED_SENTINEL + encodeURIComponent('{"kind":"script","spans":[]}')]) {
    expect(parseRich(value)[0].type).toBe("p");
    expect(marksToHtml(value)).toContain("<p>");
  }
  expect(decodeList(LIST_SENTINEL + encodeURIComponent('{"ordered":false,"start":1,"items":[2]}'))).toBeNull();
  expect(decodeFormatted(FORMATTED_SENTINEL + encodeURIComponent('{"kind":"p","align":null,"spans":[null]}'))).toBeNull();
});
test("una cita vacía nueva no absorbe el párrafo normal siguiente", () => {
  const saved = stable("<blockquote><p></p></blockquote><p>Fuera</p>");
  expect(marksToHtml(saved)).toBe("<blockquote></blockquote><p>Fuera</p>");
});
test("compartir y normalizar un respaldo conserva el nuevo contenido sin reescribirlo", async () => {
  const front = stable('<ul><li><p>Padre</p><ul><li><p>Hijo</p></li></ul></li></ul>');
  const back = stable('<p><strong><em>Respuesta</em></strong><br>2**3 + 4**5</p>');
  const db = { getFirstAsync: async () => ({ name: "Mazo", icon: null }),
    getAllAsync: async sql => sql.includes("FROM cards") ? [{ front, back }] : [] };
  const exported = await buildDeckExport(db, 1, new Date("2026-11-03T12:00:00Z"));
  const restored = normalizeBackup(JSON.parse(JSON.stringify(exported)));
  expect(restored.cards[0]).toMatchObject({ front, back });
  expect(toPlainText(restored.cards[0].back)).toBe("Respuesta\n2**3 + 4**5");
});
