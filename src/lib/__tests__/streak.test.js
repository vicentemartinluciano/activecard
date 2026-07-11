import { countStreak } from "../streak";

const NOW = new Date("2026-07-10T18:00:00");

describe("countStreak", () => {
  test("racha activa: repasó hoy y los 2 días previos", () => {
    const dates = ["2026-07-10", "2026-07-09", "2026-07-08"];
    expect(countStreak(dates, NOW)).toEqual({ days: 3, activeToday: true });
  });

  test("racha viva sin repasar todavía hoy: cuenta hasta ayer, sin cortar", () => {
    const dates = ["2026-07-09", "2026-07-08"];
    expect(countStreak(dates, NOW)).toEqual({ days: 2, activeToday: false });
  });

  test("racha cortada: no repasó hoy ni ayer", () => {
    const dates = ["2026-07-05"];
    expect(countStreak(dates, NOW)).toEqual({ days: 0, activeToday: false });
  });

  test("sin ningún repaso: racha en cero", () => {
    expect(countStreak([], NOW)).toEqual({ days: 0, activeToday: false });
  });

  test("un hueco en el medio corta el conteo ahí", () => {
    const dates = ["2026-07-10", "2026-07-09", "2026-07-06"]; // falta 07 y 08
    expect(countStreak(dates, NOW)).toEqual({ days: 2, activeToday: true });
  });

  test("primer día de racha (hoy, sin historial previo)", () => {
    expect(countStreak(["2026-07-10"], NOW)).toEqual({ days: 1, activeToday: true });
  });

  test("no le importa el orden de entrada de las fechas", () => {
    const dates = ["2026-07-08", "2026-07-10", "2026-07-09"];
    expect(countStreak(dates, NOW)).toEqual({ days: 3, activeToday: true });
  });
});
