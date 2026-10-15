import { listDecks } from '../db/decks';
import { getDecksDailyProgress } from '../db/progress';
import { getDailyReviewStats } from '../db/reviewQueue';
import { getStreak } from '../db/streak';
import { selectWidgetDecks } from './model';

export async function loadWidgetData(now = new Date()) {
  // Una misma fecha para cola y mazos, incluso si la consulta cruza medianoche.
  const [review, decks, progress, streak] = await Promise.all([
    getDailyReviewStats(now), listDecks(), getDecksDailyProgress(now), getStreak(now),
  ]);
  return { review, streak, ...selectWidgetDecks(decks, progress) };
}
