import { formatIntervalDays, newCardState, previewIntervals, rate } from "../scheduler";

describe("scheduler (FSRS binario)", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-10T12:00:00Z"));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test("una tarjeta nueva queda debida ya mismo", () => {
    const s = newCardState();
    expect(new Date(s.due).getTime()).toBeLessThanOrEqual(Date.now());
    expect(s.reps).toBe(0);
    expect(s.state).toBe(0); // New
    expect(s.last_review).toBeNull();
  });

  test("'good' programa en días (nunca minutos) y aleja el due", () => {
    const s = rate(newCardState(), "good");
    const diffDays = (new Date(s.due) - Date.now()) / 86400000;
    expect(diffDays).toBeGreaterThanOrEqual(1);
    expect(s.reps).toBe(1);
    expect(s.last_review).toBe(new Date().toISOString());
  });

  test("'again' programa antes que 'good'", () => {
    const base = newCardState();
    const good = rate(base, "good");
    const again = rate(base, "again");
    expect(new Date(again.due).getTime()).toBeLessThan(new Date(good.due).getTime());
  });

  test("'hard' ('Más o menos') programa entre 'again' y 'good'", () => {
    const base = newCardState();
    const again = rate(base, "again");
    const hard = rate(base, "hard");
    const good = rate(base, "good");
    expect(new Date(again.due).getTime()).toBeLessThan(new Date(hard.due).getTime());
    expect(new Date(hard.due).getTime()).toBeLessThan(new Date(good.due).getTime());
  });

  test("olvidar una tarjeta ya aprendida suma un lapse y acerca el due", () => {
    const learned = rate(newCardState(), "good");
    const later = new Date("2026-07-13T12:00:00Z");
    const forgotten = rate(learned, "again", later);
    const remembered = rate(learned, "good", later);
    expect(forgotten.lapses).toBe(1);
    expect(new Date(forgotten.due).getTime()).toBeLessThan(new Date(remembered.due).getTime());
  });

  test("el estado es siempre serializable (fechas como ISO strings)", () => {
    const s = rate(newCardState(), "good");
    expect(typeof s.due).toBe("string");
    expect(typeof s.last_review).toBe("string");
    expect(() => JSON.stringify(s)).not.toThrow();
  });

  test("una calificación desconocida lanza error", () => {
    expect(() => rate(newCardState(), "easy")).toThrow(/Calificación desconocida/);
  });

  test("formatIntervalDays formatea días, meses y años", () => {
    expect(formatIntervalDays(0)).toBe("Hoy");
    expect(formatIntervalDays(1)).toBe("1 d");
    expect(formatIntervalDays(14)).toBe("14 d");
    expect(formatIntervalDays(120)).toBe("4 mes");
    expect(formatIntervalDays(365)).toBe("1 a");
    expect(formatIntervalDays(548)).toBe("1,5 a");
  });

  test("previewIntervals calcula intervalos proyectados y tolera tarjetas sin estado FSRS", () => {
    const fresh = previewIntervals(newCardState());
    expect(fresh.again).toBe("Hoy");
    expect(fresh.hard).toMatch(/^\d+ d|Hoy$/);
    expect(fresh.good).toMatch(/^\d+ d$/);

    const noFsrs = previewIntervals({ id: 99, front: "F", back: "B" });
    expect(noFsrs).toEqual(fresh);

    const learned = rate(newCardState(), "good");
    const later = new Date("2026-07-20T12:00:00Z");
    const mature = previewIntervals(learned, later);
    expect(mature.again).toBe("Hoy");
    expect(mature.good).not.toBe("Hoy");
  });
});
