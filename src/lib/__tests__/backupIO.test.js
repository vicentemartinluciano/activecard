import { nextAutoBackupSlot } from "../backupIO";

describe("rotación del respaldo automático", () => {
  test.each([
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 1],
    [null, 1],
    ["dato inválido", 1],
  ])("después de %p usa el slot %i", (lastSlot, expected) => {
    expect(nextAutoBackupSlot(lastSlot)).toBe(expected);
  });
});
