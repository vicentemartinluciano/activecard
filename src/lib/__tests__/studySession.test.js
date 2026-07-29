import { rate } from "../scheduler";
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

// Este bloque existe por un bug real: la pantalla de estudio guardaba el estado
// FSRS nuevo en una variable local y NUNCA lo devolvía a `round`. Como la ronda
// de falladas se arma DESDE `round`, al acertar en la ronda extra se recalculaba
// desde el estado de ANTES del fallo y el UPDATE pisaba `lapses` con el valor
// viejo — así que "Puntos débiles" (que lee cards.lapses) quedaba vacío por más
// que fallaras, y la tarjeta olvidada se iba a semanas.
// `buildFailedRound` siempre estuvo bien; el contrato que se rompía es el de
// quien la llama, y es lo que se fija acá.
describe("ronda de falladas: el ciclo completo no puede perder el fallo", () => {
  const AHORA = new Date("2026-07-29T12:00:00Z");

  // Tarjeta madura y ya fallada dos veces en su vida.
  const tarjetaMadura = () => ({
    id: 7,
    due: "2026-07-29T00:00:00.000Z",
    stability: 30,
    difficulty: 6,
    elapsed_days: 30,
    scheduled_days: 30,
    reps: 11,
    lapses: 2,
    learning_steps: 0,
    state: 2, // Review
    last_review: "2026-06-29T00:00:00.000Z",
  });

  test("el estado de la ronda extra ya tiene el fallo contado", () => {
    const original = tarjetaMadura();

    // 1. La fallo en la ronda normal.
    const trasFallar = rate(original, "again", AHORA);
    expect(trasFallar.lapses).toBe(3);

    // 2. La pantalla mergea el estado nuevo en la ronda (esto es lo que faltaba).
    const round = [{ ...original, ...trasFallar }];

    // 3. La ronda de falladas se arma desde ahí.
    const extra = buildFailedRound(round, [7]);
    expect(extra).toHaveLength(1);
    expect(extra[0].lapses).toBe(3);
    // La estabilidad se derrumba al fallar: es lo que hace que vuelva pronto.
    // (El `state` sigue en Review porque la app corre con enable_short_term:
    // false — nunca entra en Relearning, todo se programa en días.)
    expect(extra[0].stability).toBeLessThan(original.stability);
  });

  test("acertar en la ronda extra NO borra el fallo ni manda la tarjeta a semanas", () => {
    const original = tarjetaMadura();
    const trasFallar = rate(original, "again", AHORA);
    const extra = buildFailedRound([{ ...original, ...trasFallar }], [7]);

    // La acierto en la ronda extra.
    const trasAcertar = rate(extra[0], "good", AHORA);

    // El fallo sigue contado: es lo que alimenta "Puntos débiles".
    expect(trasAcertar.lapses).toBe(3);

    // Y vuelve pronto, no al intervalo de la tarjeta madura que era antes.
    const diasHastaLaProxima =
      (new Date(trasAcertar.due) - AHORA) / (24 * 60 * 60 * 1000);
    expect(diasHastaLaProxima).toBeLessThan(30);
  });

  test("sin el merge, acertar en la ronda extra REVIERTE el fallo (el bug)", () => {
    const original = tarjetaMadura();
    const trasFallar = rate(original, "again", AHORA);
    expect(trasFallar.lapses).toBe(3);

    // Así estaba antes: la ronda se armaba con el objeto SIN actualizar.
    const extraConEstadoViejo = buildFailedRound([original], [7]);
    const trasAcertar = rate(extraConEstadoViejo[0], "good", AHORA);

    // El lapse desaparece y la tarjeta se va lejos: exactamente el sintoma.
    expect(trasAcertar.lapses).toBe(2);
    const diasHastaLaProxima =
      (new Date(trasAcertar.due) - AHORA) / (24 * 60 * 60 * 1000);
    expect(diasHastaLaProxima).toBeGreaterThan(30);
  });
});
