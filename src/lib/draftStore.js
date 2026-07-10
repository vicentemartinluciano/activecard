// Puente en memoria entre la pantalla de creación y la de preselección.
// Evita serializar tarjetas por los params de navegación.

let draft = null;

// cards: [{front, back}], sourceLabel: texto corto de dónde salieron.
export function setDraft(cards, sourceLabel) {
  draft = { cards, sourceLabel };
}

export function getDraft() {
  return draft;
}

export function clearDraft() {
  draft = null;
}
