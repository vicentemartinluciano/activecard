import { buildDailyQueue, cardWeight, endOfDay, monthKey } from "../queue";

const NOW = new Date("2026-07-10T12:00:00Z");

function card(id, deckId, due) {
  return { id, deck_id: deckId, due };
}

describe("cola de repaso diaria", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test("monthKey usa el mes local con dos dígitos", () => {
    expect(monthKey(NOW)).toMatch(/^2026-07$/);
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

  test("ordena por peso del mazo (desc) y luego la más vencida primero", () => {
    const cards = [
      card(1, 1, "2026-07-01T08:00:00Z"), // muy vencida, mazo normal
      card(2, 2, "2026-07-09T08:00:00Z"), // mazo prioritario
      card(3, 2, "2026-07-05T08:00:00Z"), // mazo prioritario, más vencida
    ];
    const priorities = [{ target_type: "deck", target_id: 2, weight: 3, month: monthKey(NOW) }];
    const queue = buildDailyQueue(cards, { priorities, now: NOW });
    expect(queue.map((c) => c.id)).toEqual([3, 2, 1]);
  });

  test("las prioridades por etiqueta pesan a través de deckTags", () => {
    const priorities = [{ target_type: "tag", target_id: 7, weight: 2, month: monthKey(NOW) }];
    const deckTags = { 1: [7] };
    expect(cardWeight(card(1, 1, ""), priorities, deckTags, monthKey(NOW))).toBe(2);
    expect(cardWeight(card(2, 2, ""), priorities, deckTags, monthKey(NOW))).toBe(1);
  });

  test("las prioridades de otro mes no cuentan", () => {
    const priorities = [{ target_type: "deck", target_id: 1, weight: 3, month: "2026-06" }];
    expect(cardWeight(card(1, 1, ""), priorities, {}, monthKey(NOW))).toBe(1);
  });

  test("Modo Enfoque filtra a los mazos elegidos", () => {
    const cards = [
      card(1, 1, "2026-07-09T08:00:00Z"),
      card(2, 2, "2026-07-09T08:00:00Z"),
    ];
    const queue = buildDailyQueue(cards, { now: NOW, focusDeckIds: [2] });
    expect(queue.map((c) => c.id)).toEqual([2]);
  });

  test("Modo Enfoque con pocas debidas completa con las próximas a vencer", () => {
    const cards = [
      card(1, 2, "2026-07-09T08:00:00Z"), // debida
      card(2, 2, "2026-07-20T08:00:00Z"), // futura cercana
      card(3, 2, "2026-07-25T08:00:00Z"), // futura lejana
      card(4, 1, "2026-07-11T08:00:00Z"), // otro mazo: afuera
    ];
    const queue = buildDailyQueue(cards, { now: NOW, focusDeckIds: [2], minFocus: 3 });
    expect(queue.map((c) => c.id)).toEqual([1, 2, 3]);
  });

  test("sin Modo Enfoque no se adelantan tarjetas futuras", () => {
    const cards = [card(1, 1, "2026-07-20T08:00:00Z")];
    const queue = buildDailyQueue(cards, { now: NOW, minFocus: 5 });
    expect(queue).toEqual([]);
  });
});
