import { buildDailyQueue, endOfDay, startOfDay } from "../queue";

const NOW = new Date("2026-07-10T12:00:00Z");

function card(id, deckId, due) {
  return { id, deck_id: deckId, due };
}

describe("cola de repaso diaria (prioridad porcentual)", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test("startOfDay y endOfDay delimitan el día local", () => {
    expect(startOfDay(NOW).getTime()).toBeLessThan(NOW.getTime());
    expect(endOfDay(NOW).getTime()).toBeGreaterThan(NOW.getTime());
    expect(endOfDay(NOW).getTime() - startOfDay(NOW).getTime()).toBe(86399999);
  });

  test("solo entran las tarjetas debidas hasta el fin de hoy", () => {
    const cards = [
      card(1, 1, "2026-07-09T08:00:00Z"), // vencida ayer
      card(2, 1, endOfDay(NOW).toISOString()), // justo hoy
      card(3, 1, "2026-07-15T08:00:00Z"), // futura
    ];
    const queue = buildDailyQueue(cards, { now: NOW });
    expect(queue.map((c) => c.id)).toEqual([1, 2]);
  });

  test("un mazo al 0% queda pausado (sus tarjetas no aparecen)", () => {
    const cards = [
      card(1, 1, "2026-07-09T08:00:00Z"),
      card(2, 2, "2026-07-09T08:00:00Z"),
    ];
    const queue = buildDailyQueue(cards, {
      deckPriorities: { 1: 0, 2: 100 },
      now: NOW,
    });
    expect(queue.map((c) => c.id)).toEqual([2]);
  });

  test("100% vs 50%: intercala 2 a 1", () => {
    const cards = [];
    for (let i = 0; i < 6; i++) cards.push(card(10 + i, 1, `2026-07-0${i + 1}T08:00:00Z`));
    for (let i = 0; i < 3; i++) cards.push(card(20 + i, 2, `2026-07-0${i + 1}T08:00:00Z`));
    const queue = buildDailyQueue(cards, {
      deckPriorities: { 1: 100, 2: 50 },
      now: NOW,
    });
    const deckSeq = queue.map((c) => c.deck_id);
    // En las primeras 6 emisiones, el mazo 1 (100%) debe aparecer el doble
    // de veces que el mazo 2 (50%).
    const first6 = deckSeq.slice(0, 6);
    expect(first6.filter((d) => d === 1)).toHaveLength(4);
    expect(first6.filter((d) => d === 2)).toHaveLength(2);
    // Y todas las tarjetas salen, ninguna se pierde.
    expect(queue).toHaveLength(9);
  });

  test("dentro de cada mazo sale primero la más vencida", () => {
    const cards = [
      card(1, 1, "2026-07-08T08:00:00Z"),
      card(2, 1, "2026-07-01T08:00:00Z"), // más vencida
      card(3, 1, "2026-07-05T08:00:00Z"),
    ];
    const queue = buildDailyQueue(cards, { now: NOW });
    expect(queue.map((c) => c.id)).toEqual([2, 3, 1]);
  });

  test("prioridades iguales intercalan parejo y determinístico", () => {
    const cards = [
      card(1, 1, "2026-07-01T08:00:00Z"),
      card(2, 1, "2026-07-02T08:00:00Z"),
      card(3, 2, "2026-07-01T08:00:00Z"),
      card(4, 2, "2026-07-02T08:00:00Z"),
    ];
    const a = buildDailyQueue(cards, { deckPriorities: { 1: 70, 2: 70 }, now: NOW });
    const b = buildDailyQueue(cards, { deckPriorities: { 1: 70, 2: 70 }, now: NOW });
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id)); // determinismo
    // Alterna 1-2-1-2 (empate de crédito → menor deckId primero).
    expect(a.map((c) => c.deck_id)).toEqual([1, 2, 1, 2]);
  });

  test("mazo sin prioridad configurada cuenta como 100", () => {
    const cards = [
      card(1, 1, "2026-07-01T08:00:00Z"),
      card(2, 2, "2026-07-01T08:00:00Z"),
    ];
    const queue = buildDailyQueue(cards, { deckPriorities: { 2: 100 }, now: NOW });
    expect(queue).toHaveLength(2);
  });

  test("sin tarjetas debidas la cola es vacía", () => {
    const cards = [card(1, 1, "2026-08-01T08:00:00Z")];
    expect(buildDailyQueue(cards, { now: NOW })).toEqual([]);
  });

  test("las falladas de hoy re-entran a la cola aunque FSRS las haya mandado a mañana", () => {
    const cards = [
      card(1, 1, "2026-07-11T08:00:00Z"), // fallada hoy → due mañana
      card(2, 1, "2026-07-09T08:00:00Z"), // debida normal
      card(3, 1, "2026-08-01T08:00:00Z"), // futura de verdad (no fallada)
    ];
    const queue = buildDailyQueue(cards, { now: NOW, retryIds: [1] });
    expect(queue.map((c) => c.id)).toEqual([2, 1]); // la fallada va al final (due mayor)
  });

  test("una fallada de mazo pausado NO re-entra", () => {
    const cards = [card(1, 1, "2026-07-11T08:00:00Z")];
    const queue = buildDailyQueue(cards, { deckPriorities: { 1: 0 }, now: NOW, retryIds: [1] });
    expect(queue).toEqual([]);
  });
});

describe("topes diarios", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  // state 0 = tarjeta nueva en FSRS; cualquier otro valor ya fue repasada.
  const vencidas = (n, state = 2) =>
    Array.from({ length: n }, (_, i) => ({
      ...card(i + 1, 1, "2026-07-09T08:00:00Z"),
      state,
    }));

  test("sin limits la cola sale completa (comportamiento histórico)", () => {
    expect(buildDailyQueue(vencidas(30), { now: NOW })).toHaveLength(30);
    expect(buildDailyQueue(vencidas(30), { now: NOW, limits: null })).toHaveLength(30);
  });

  test("maxReviews recorta el total del día", () => {
    const queue = buildDailyQueue(vencidas(30), {
      now: NOW,
      limits: { maxReviews: 10, maxNew: 100 },
    });
    expect(queue).toHaveLength(10);
  });

  test("maxNew limita las nuevas pero deja pasar los repasos", () => {
    const cards = [
      ...vencidas(5, 0).map((c) => ({ ...c, id: c.id })), // 5 nuevas: ids 1..5
      ...vencidas(5, 2).map((c) => ({ ...c, id: c.id + 100 })), // 5 repasos: ids 101..105
    ];
    const queue = buildDailyQueue(cards, {
      now: NOW,
      limits: { maxReviews: 100, maxNew: 2 },
    });
    const nuevas = queue.filter((c) => c.state === 0);
    const repasos = queue.filter((c) => c.state !== 0);
    expect(nuevas).toHaveLength(2);
    expect(repasos).toHaveLength(5); // los repasos NO los toca el tope de nuevas
  });

  test("maxReviews en 0 vacía la cola: cero es AGOTADO, no 'sin límite'", () => {
    // Los topes llegan ya descontando lo hecho hoy, así que 0 = el día está
    // completo. Un guard `maxReviews > 0 ? ... : Infinity` hacía que el día
    // completo se leyera como ilimitado y devolvía la cola entera.
    const queue = buildDailyQueue(vencidas(30), {
      now: NOW,
      limits: { maxReviews: 0, maxNew: 0 },
    });
    expect(queue).toEqual([]);
  });

  test("maxNew en 0 deja el día solo con repasos", () => {
    const cards = [...vencidas(3, 0), ...vencidas(2, 2).map((c) => ({ ...c, id: c.id + 100 }))];
    const queue = buildDailyQueue(cards, {
      now: NOW,
      limits: { maxReviews: 100, maxNew: 0 },
    });
    expect(queue.every((c) => c.state !== 0)).toBe(true);
    expect(queue).toHaveLength(2);
  });

  test("el recorte respeta el orden por prioridad: lo que queda afuera es lo de menor %", () => {
    // Mazo 1 al 100%, mazo 2 al 20%: con un tope chico casi todo debe ser del 1.
    const cards = [
      ...Array.from({ length: 10 }, (_, i) => ({ ...card(i + 1, 1, "2026-07-09T08:00:00Z"), state: 2 })),
      ...Array.from({ length: 10 }, (_, i) => ({ ...card(i + 101, 2, "2026-07-09T08:00:00Z"), state: 2 })),
    ];
    const queue = buildDailyQueue(cards, {
      deckPriorities: { 1: 100, 2: 20 },
      now: NOW,
      limits: { maxReviews: 6, maxNew: 100 },
    });
    const delMazo1 = queue.filter((c) => c.deck_id === 1).length;
    expect(queue).toHaveLength(6);
    expect(delMazo1).toBeGreaterThan(queue.length - delMazo1);
  });
});
