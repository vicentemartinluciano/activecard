import { MAX_CARD_RESULTS, normalizeSearch, searchLibrary } from "../search";

const folders = [
  { id: 1, name: "Facultad" },
  { id: 2, name: "Lógica Formal" },
];

const decks = [
  { id: 1, name: "Filosofía", tags: [{ id: 1, name: "facultad" }] },
  { id: 2, name: "Historia", tags: [] },
];

const cards = [
  { id: 1, deck_id: 1, front: "¿Qué produce la [[verde:mitocondria]]?", back: "==ATP==" },
  { id: 2, deck_id: 2, front: "Revolución de Mayo", back: "**1810**" },
];

describe("normalizeSearch", () => {
  test("baja a minúsculas y saca tildes", () => {
    expect(normalizeSearch("LÓGICA")).toBe("logica");
    expect(normalizeSearch("Filosofía")).toBe("filosofia");
  });
});

describe("searchLibrary", () => {
  test("query vacía o de espacios devuelve todo vacío", () => {
    for (const q of ["", "   ", null, undefined]) {
      expect(searchLibrary(q, { folders, decks, cards })).toEqual({
        folders: [],
        decks: [],
        cards: [],
      });
    }
  });

  test("matchea sin tildes ni mayúsculas", () => {
    const r = searchLibrary("logica", { folders, decks, cards });
    expect(r.folders.map((f) => f.id)).toEqual([2]);
    expect(searchLibrary("FILOSOFIA", { decks }).decks.map((d) => d.id)).toEqual([1]);
  });

  test("un mazo matchea por el nombre de sus etiquetas", () => {
    const r = searchLibrary("facultad", { folders, decks, cards });
    expect(r.decks.map((d) => d.id)).toEqual([1]);
    expect(r.folders.map((f) => f.id)).toEqual([1]); // la carpeta también se llama así
  });

  test("una tarjeta matchea por el texto dentro del markup, no por la clave de color", () => {
    expect(searchLibrary("mitocondria", { cards }).cards.map((c) => c.id)).toEqual([1]);
    expect(searchLibrary("ATP", { cards }).cards.map((c) => c.id)).toEqual([1]);
    expect(searchLibrary("1810", { cards }).cards.map((c) => c.id)).toEqual([2]);
    // "verde" es la clave del markup [[verde:...]], no contenido real.
    expect(searchLibrary("verde", { cards }).cards).toEqual([]);
  });

  test("limita los resultados de tarjetas a MAX_CARD_RESULTS", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      deck_id: 1,
      front: `concepto ${i}`,
      back: "x",
    }));
    const r = searchLibrary("concepto", { cards: many });
    expect(r.cards).toHaveLength(MAX_CARD_RESULTS);
  });

  test("tolera mazos sin tags y colecciones ausentes", () => {
    const r = searchLibrary("historia", { decks: [{ id: 9, name: "Historia" }] });
    expect(r.decks.map((d) => d.id)).toEqual([9]);
    expect(r.folders).toEqual([]);
    expect(r.cards).toEqual([]);
  });
});
