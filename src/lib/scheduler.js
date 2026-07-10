// Motor de repetición espaciada de ActiveCard.
// Envuelve ts-fsrs (algoritmo FSRS) con la calificación binaria de la app:
// "Lo recordaba" → Good, "No lo recordaba" → Again.
// El estado FSRS viaja siempre como objeto plano serializable (fechas en ISO),
// listo para guardarse como columnas de SQLite.

import { createEmptyCard, fsrs, generatorParameters, Rating } from "ts-fsrs";

// enable_short_term: false → todo se programa en DÍAS, nunca en minutos.
// Una tarjeta repasada hoy no vuelve a aparecer hasta otro día, que es el
// modelo mental de la app (una pasada diaria, sin repeticiones intra-sesión).
const engine = fsrs(generatorParameters({ enable_short_term: false }));

export const RATINGS = {
  good: Rating.Good,
  again: Rating.Again,
};

function toIso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

// Estado FSRS plano (ISO strings) → Card de ts-fsrs (Dates).
function toFsrsCard(state) {
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsed_days,
    scheduled_days: state.scheduled_days,
    reps: state.reps,
    lapses: state.lapses,
    learning_steps: state.learning_steps,
    state: state.state,
    last_review: state.last_review ? new Date(state.last_review) : undefined,
  };
}

// Card de ts-fsrs → estado plano serializable.
function toPlainState(card) {
  return {
    due: toIso(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    learning_steps: card.learning_steps,
    state: card.state,
    last_review: toIso(card.last_review),
  };
}

// Estado inicial para una tarjeta recién creada: debida ya mismo.
export function newCardState(now = new Date()) {
  return toPlainState(createEmptyCard(now));
}

// Aplica una calificación binaria y devuelve el nuevo estado plano.
// rating: 'good' | 'again'
export function rate(state, rating, now = new Date()) {
  const fsrsRating = RATINGS[rating];
  if (!fsrsRating) {
    throw new Error(`Calificación desconocida: ${rating} (usar 'good' o 'again')`);
  }
  const { card } = engine.next(toFsrsCard(state), now, fsrsRating);
  return toPlainState(card);
}
