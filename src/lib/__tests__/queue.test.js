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
