import { getReminderTarget, parseReminderTime } from "../notifications";

describe("hora del recordatorio", () => {
  test.each([
    ["20:30", { hour: 20, minute: 30, formatted: "20:30" }],
    ["8:05", { hour: 8, minute: 5, formatted: "08:05" }],
    ["24:00", null],
    ["20:70", null],
    ["texto", null],
  ])("interpreta %s", (value, expected) => {
    expect(parseReminderTime(value)).toEqual(expected);
  });

  test("usa hoy si la hora todavía no pasó", () => {
    const now = new Date(2026, 6, 29, 10, 0);
    expect(getReminderTarget(now, "20:30")).toEqual(new Date(2026, 6, 29, 20, 30));
  });

  test("pasa a mañana si la hora ya pasó o se fuerza", () => {
    const now = new Date(2026, 6, 29, 21, 0);
    expect(getReminderTarget(now, "20:30")).toEqual(new Date(2026, 6, 30, 20, 30));
    expect(getReminderTarget(now, "22:00", true)).toEqual(new Date(2026, 6, 30, 22, 0));
  });
});
