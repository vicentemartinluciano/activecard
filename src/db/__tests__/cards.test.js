const mockGetAllAsync = jest.fn();
const mockDb = { getAllAsync: mockGetAllAsync };

jest.mock("../client", () => ({
  getDb: jest.fn(),
}));

// eslint-disable-next-line import/first
import { getDb } from "../client";
// eslint-disable-next-line import/first
import { listCardsByIds } from "../cards";

getDb.mockResolvedValue(mockDb);

beforeEach(() => {
  mockGetAllAsync.mockReset();
  getDb.mockClear();
});

describe("listCardsByIds", () => {
  test("una lista vacía no abre ni consulta la base", async () => {
    expect(await listCardsByIds([])).toEqual([]);
    expect(getDb).not.toHaveBeenCalled();
    expect(mockGetAllAsync).not.toHaveBeenCalled();
  });

  test("preserva el orden solicitado y omite IDs inexistentes", async () => {
    const one = { id: 1, front: "uno" };
    const two = { id: 2, front: "dos" };
    mockGetAllAsync.mockResolvedValue([two, one]);

    const result = await listCardsByIds([1, 2, 1, 99]);

    expect(mockGetAllAsync).toHaveBeenCalledWith(
      "SELECT * FROM cards WHERE id IN (?, ?, ?)",
      [1, 2, 99]
    );
    expect(result).toEqual([one, two, one]);
  });

  test("divide 2.000 IDs en lotes seguros sin alterar el orden", async () => {
    const ids = Array.from({ length: 2000 }, (_, index) => index + 1).reverse();
    mockGetAllAsync.mockImplementation(async (_sql, chunk) =>
      [...chunk].reverse().map((id) => ({ id }))
    );

    const result = await listCardsByIds(ids);

    expect(mockGetAllAsync).toHaveBeenCalledTimes(4);
    for (const [, chunk] of mockGetAllAsync.mock.calls) {
      expect(chunk.length).toBeLessThanOrEqual(500);
    }
    expect(result.map((card) => card.id)).toEqual(ids);
  });
});
