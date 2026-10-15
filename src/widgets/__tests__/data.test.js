import { listDecks } from '../../db/decks';
import { getDecksDailyProgress } from '../../db/progress';
import { getDailyReviewStats } from '../../db/reviewQueue';
import { loadWidgetData } from '../data';

jest.mock('../../db/decks', () => ({ listDecks: jest.fn() }));
jest.mock('../../db/progress', () => ({ getDecksDailyProgress: jest.fn() }));
jest.mock('../../db/reviewQueue', () => ({ getDailyReviewStats: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks();
  listDecks.mockResolvedValue([{ id: 7, name: 'Operaciones', created_at: '2026-10-01', card_count: 20 }]);
  getDailyReviewStats.mockResolvedValue({ done: 5, remaining: 8, total: 13, pct: 38 });
  getDecksDailyProgress.mockResolvedValue({ 7: { reviewedToday: 2, total: 20, pct: 10 } });
});
test('reutiliza cola y progreso con la misma fecha, sin recalcular FSRS', async () => {
  const now = new Date('2026-10-14T02:59:59Z');
  const result = await loadWidgetData(now);
  expect(getDailyReviewStats).toHaveBeenCalledWith(now);
  expect(getDecksDailyProgress).toHaveBeenCalledWith(now);
  expect(result.review).toEqual({ done: 5, remaining: 8, total: 13, pct: 38 });
  expect(result.inProgress.map((deck) => deck.id)).toEqual([7]);
  getDecksDailyProgress.mockResolvedValue({ 7: { reviewedToday: 0, total: 20, pct: 0 } });
  expect((await loadWidgetData(new Date('2026-10-14T03:00:01Z'))).recent.map((deck) => deck.id)).toEqual([7]);
});
test('no convierte un fallo de SQLite en cero pendientes', async () => {
  getDailyReviewStats.mockRejectedValue(new Error('SQLite busy'));
  await expect(loadWidgetData()).rejects.toThrow('SQLite busy');
});
