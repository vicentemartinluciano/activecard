import { blocksToText, parsePageId } from "../notion";

function rt(text) {
  return { rich_text: [{ plain_text: text }] };
}

describe("parsePageId", () => {
  const ID = "89f0dbcc7f6a4c4ea2ed1f9a250e8b1c";
  const DASHED = "89f0dbcc-7f6a-4c4e-a2ed-1f9a250e8b1c";

  test("URL completa de Notion con slug", () => {
    expect(parsePageId(`https://www.notion.so/miespacio/Apuntes-Admin-${ID}`)).toBe(DASHED);
  });

  test("URL con query params", () => {
    expect(parsePageId(`https://notion.so/Pagina-${ID}?pvs=4`)).toBe(DASHED);
  });

  test("ID pelado sin guiones", () => {
    expect(parsePageId(ID)).toBe(DASHED);
  });

  test("ID ya con guiones", () => {
    expect(parsePageId(DASHED)).toBe(DASHED);
  });

  test("entrada inválida lanza error orientativo", () => {
    expect(() => parsePageId("https://google.com")).toThrow(/enlace completo/);
  });
});

describe("blocksToText", () => {
  test("convierte headings, párrafos y listas con jerarquía", () => {
    const blocks = [
      { type: "heading_1", heading_1: rt("Rol del administrador") },
      { type: "paragraph", paragraph: rt("Es quien planifica y controla.") },
      {
        type: "bulleted_list_item",
        bulleted_list_item: rt("Humanos"),
        has_children: false,
      },
      {
        type: "toggle",
        toggle: rt("Definición de GERENTE"),
        __children: [{ type: "paragraph", paragraph: rt("Persona que asigna recursos.") }],
      },
    ];
    const text = blocksToText(blocks);
    expect(text).toContain("# Rol del administrador");
    expect(text).toContain("Es quien planifica y controla.");
    expect(text).toContain("- Humanos");
    expect(text).toContain("Definición de GERENTE");
    expect(text).toContain("  Persona que asigna recursos.");
  });

  test("filas de tabla se vuelven filas legibles", () => {
    const blocks = [
      {
        type: "table_row",
        table_row: { cells: [[{ plain_text: "Año" }], [{ plain_text: "1953" }]] },
      },
    ];
    expect(blocksToText(blocks)).toBe("| Año | 1953 |");
  });

  test("bloques sin texto no generan líneas vacías", () => {
    const blocks = [{ type: "paragraph", paragraph: { rich_text: [] } }];
    expect(blocksToText(blocks)).toBe("");
  });

  test("imágenes → marcadores [IMG:n] y se acumulan en images", () => {
    const images = [];
    const blocks = [
      { type: "paragraph", paragraph: rt("Antes") },
      { type: "image", image: { type: "file", file: { url: "https://s3/img1.png" } } },
      { type: "image", image: { type: "external", external: { url: "https://ext/img2.jpg" } } },
      { type: "paragraph", paragraph: rt("Después") },
    ];
    const text = blocksToText(blocks, images);
    expect(text).toContain("[IMG:1]");
    expect(text).toContain("[IMG:2]");
    expect(images).toEqual([
      { n: 1, url: "https://s3/img1.png" },
      { n: 2, url: "https://ext/img2.jpg" },
    ]);
  });

  test("imagen sin URL utilizable no cuenta", () => {
    const images = [];
    blocksToText([{ type: "image", image: { type: "file" } }], images);
    expect(images).toEqual([]);
  });
});
