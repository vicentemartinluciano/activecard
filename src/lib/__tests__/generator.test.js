import { resolveImageMarkers } from "../generator";
import { IMG_SENTINEL } from "../richtext";

describe("resolveImageMarkers", () => {
  const DATA = "data:image/png;base64,AAAA";
  const map = { 1: DATA };
  const marker = `${IMG_SENTINEL}100 ${DATA}`;

  test("reemplaza [IMG:n] (en su propia línea) por el bloque imagen", () => {
    const [card] = resolveImageMarkers([{ front: "P", back: "texto\n[IMG:1]\nmás" }], map);
    expect(card.back).toBe(`texto\n${marker}\nmás`);
  });

  test("imagen al final del dorso", () => {
    const [card] = resolveImageMarkers([{ front: "P", back: "def\n[IMG:1]" }], map);
    expect(card.back).toBe(`def\n${marker}`);
  });

  test("[IMG:n] sin imagen en el mapa se elimina", () => {
    const [card] = resolveImageMarkers([{ front: "P", back: "def\n[IMG:9]\nfin" }], map);
    expect(card.back).toBe("def\nfin");
  });

  test("sin marcadores no cambia nada", () => {
    const [card] = resolveImageMarkers([{ front: "P", back: "solo texto" }], {});
    expect(card).toEqual({ front: "P", back: "solo texto" });
  });

  test("también resuelve en el frente", () => {
    const [card] = resolveImageMarkers([{ front: "[IMG:1]", back: "b" }], map);
    expect(card.front).toBe(marker);
  });
});
