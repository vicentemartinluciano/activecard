import { buildFailedRound, shuffle } from "../studySession";

describe("shuffle", () => {
  test("devuelve la misma cantidad de elementos", () => {
    const list = [1, 2, 3, 4, 5];
    expect(shuffle(list)).toHaveLength(5);
  });

  test("es un multiset idéntico al original (no pierde ni inventa elementos)", () => {
    const list = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = shuffle(list);
    expect(result.map((x) => x.id).sort()).toEqual([1, 2, 3]);
  });

  test("no muta el array original", () => {
    const list = [1, 2, 3];
    shuffle(list);
    expect(list).toEqual([1, 2, 3]);
  });

  test("con 0 o 1 elemento no rompe", () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle([1])).toEqual([1]);
  });
});

describe("buildFailedRound", () => {
  const cards = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

  test("sin falladas devuelve ronda vacía", () => {
    expect(buildFailedRound(cards, [])).toEqual([]);
    expect(buildFailedRound(cards, null)).toEqual([]);
  });

  test("incluye solo las tarjetas falladas", () => {
    const round = buildFailedRound(cards, [2, 4]);
    expect(round.map((c) => c.id).sort()).toEqual([2, 4]);
  });

  test("ignora ids falladas que ya no están en la lista de cards", () => {
    const round = buildFailedRound(cards, [2, 99]);
    expect(round.map((c) => c.id)).toEqual([2]);
  });
});
