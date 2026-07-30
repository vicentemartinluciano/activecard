// reviewQueue compone la lógica pura de queue.js con la base. Lo que se testea
// acá es exactamente esa composición, que no estaba cubierta por nada:
//   · los topes diarios se aplican sobre lo que QUEDA del día, no sobre el tope
//     entero (si no, la cola se rellena y el día nunca termina);
//   · la aritmética de getDailyReviewStats, donde una fallada no cuenta como
//     hecha pero sí como pendiente.
//
// Las variables llevan prefijo `mock` porque jest.mock no deja que su factory
// referencie nada de afuera salvo con ese nombre.

const mockCards = [];
const mockEstado = {
  reviewed: 0,
  newIntroduced: 0,
  retryIds: [],
  limits: { maxReviews: 40, maxNew: 15 },
  lightReads: 0,
  hydrateReads: 0,
  hydratedIds: [],
};

jest.mock("../cards", () => ({
  listCardsForQueue: async () => {
    mockEstado.lightReads += 1;
    return mockCards;
  },
  listCardsByIds: async (ids) => {
    mockEstado.hydrateReads += 1;
    mockEstado.hydratedIds = [...ids];
    const byId = new Map(mockCards.map((card) => [card.id, card]));
    return ids.map((id) => ({ ...byId.get(id), front: `frente ${id}`, back: `dorso ${id}` }));
  },
  countDistinctReviewedSince: async () => mockEstado.reviewed,
  countNewIntroducedSince: async () => mockEstado.newIntroduced,
  listRetryTodayIds: async () => mockEstado.retryIds,
  countDueCards: async () => 0,
}));

jest.mock("../decks", () => ({ getDeckPriorities: async () => ({}) }));
jest.mock("../settings", () => ({ getSetting: async () => mockEstado.limits }));

// eslint-disable-next-line import/first
import { getDailyQueue, getDailyReviewStats } from "../reviewQueue";

const NOW = new Date(2026, 6, 29, 12, 0, 0);

// Todas vencidas ayer, mismo mazo. state 2 = ya repasada; state 0 = nueva.
function sembrar(cantidad, state = 2, desdeId = 1) {
  mockCards.length = 0;
  for (let i = 0; i < cantidad; i++) {
    mockCards.push({
      id: desdeId + i,
      deck_id: 1,
      due: "2026-07-28T08:00:00.000Z",
      state,
    });
  }
}

beforeEach(() => {
  mockCards.length = 0;
  mockEstado.reviewed = 0;
  mockEstado.newIntroduced = 0;
  mockEstado.retryIds = [];
  mockEstado.limits = { maxReviews: 40, maxNew: 15 };
  mockEstado.lightReads = 0;
  mockEstado.hydrateReads = 0;
  mockEstado.hydratedIds = [];
});

describe("getDailyQueue: los topes cuentan el día, no cada apertura", () => {
  test("decide con metadatos e hidrata únicamente los IDs finales", async () => {
    sembrar(300);
    const queue = await getDailyQueue(NOW);
    expect(mockEstado.lightReads).toBe(1);
    expect(mockEstado.hydrateReads).toBe(1);
    expect(mockEstado.hydratedIds).toEqual(queue.map((card) => card.id));
    expect(mockEstado.hydratedIds).toHaveLength(40);
    expect(queue[0]).toEqual(expect.objectContaining({ front: expect.any(String) }));
  });

  test("sin nada hecho, la cola llega hasta el tope", async () => {
    sembrar(300);
    expect(await getDailyQueue(NOW)).toHaveLength(40);
  });

  test("con la mitad del tope ya hecha, solo quedan las que faltan", async () => {
    sembrar(300);
    mockEstado.reviewed = 25;
    expect(await getDailyQueue(NOW)).toHaveLength(15);
  });

  test("completado el tope, la cola queda VACÍA aunque sobren vencidas", async () => {
    sembrar(300);
    mockEstado.reviewed = 40;
    // Este es el corazón del arreglo: antes devolvía 40 otra vez, para siempre.
    expect(await getDailyQueue(NOW)).toHaveLength(0);
  });

  test("pasarse del tope no da cupo negativo", async () => {
    sembrar(300);
    mockEstado.reviewed = 55; // estudió mazos sueltos además del repaso
    expect(await getDailyQueue(NOW)).toHaveLength(0);
  });

  test("las falladas de hoy no gastan cupo: siguen pendientes", async () => {
    sembrar(300);
    mockEstado.reviewed = 10;
    mockEstado.retryIds = [1, 2, 3]; // 3 de esas 10 quedaron en 'again'
    // Solo 7 avanzaron de verdad, así que quedan 33 de cupo.
    expect(await getDailyQueue(NOW)).toHaveLength(33);
  });

  test("el tope de nuevas descuenta las ya estrenadas hoy", async () => {
    sembrar(100, 0); // todas nuevas
    mockEstado.newIntroduced = 12;
    expect(await getDailyQueue(NOW)).toHaveLength(3); // 15 - 12
  });

  test("sin topes configurados la cola sale completa", async () => {
    sembrar(120);
    mockEstado.limits = null;
    expect(await getDailyQueue(NOW)).toHaveLength(120);
  });
});

describe("getDailyReviewStats: el día tiene que poder llegar a 100%", () => {
  test("cuenta con la consulta liviana y no carga frente, dorso ni imágenes", async () => {
    sembrar(10);
    await getDailyReviewStats(NOW);
    expect(mockEstado.lightReads).toBe(1);
    expect(mockEstado.hydrateReads).toBe(0);
  });

  test("recién empezado: nada hecho, el tope como total", async () => {
    sembrar(300);
    const s = await getDailyReviewStats(NOW);
    expect(s.done).toBe(0);
    expect(s.remaining).toBe(40);
    expect(s.total).toBe(40);
    expect(s.pct).toBe(0);
  });

  test("terminado el tope: 100% y sin pendientes, con 260 vencidas todavía", async () => {
    sembrar(300);
    mockEstado.reviewed = 40;
    const s = await getDailyReviewStats(NOW);
    expect(s.done).toBe(40);
    expect(s.remaining).toBe(0);
    expect(s.pct).toBe(100); // dispara el "Completado ✓" del hero
  });

  test("una fallada no cuenta como hecha pero sí como pendiente", async () => {
    sembrar(10);
    mockEstado.reviewed = 4;
    mockEstado.retryIds = [1];
    const s = await getDailyReviewStats(NOW);
    expect(s.done).toBe(3); // 4 repasadas, 1 sigue debiendo
    expect(s.remaining).toBeGreaterThan(0);
  });

  test("sin tarjetas no divide por cero", async () => {
    const s = await getDailyReviewStats(NOW);
    expect(s.total).toBe(0);
    expect(s.pct).toBe(0);
  });
});
