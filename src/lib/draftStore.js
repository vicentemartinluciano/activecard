// Puente entre la pantalla de creación y la de preselección. Mantiene una
// copia en memoria para navegar sin demora y otra en SQLite para sobrevivir a
// cierres de la app durante la revisión.

import { getSetting, setSetting } from "../db/settings";

export const DRAFT_KEY = "generationDraft";
let draft = null;

function normalizeDraft(value) {
  if (!value || !Array.isArray(value.cards) || !value.sourceLabel) return null;
  return {
    version: 2,
    sourceLabel: String(value.sourceLabel),
    deckId: value.deckId == null ? null : Number(value.deckId),
    folderId: value.folderId == null ? null : Number(value.folderId),
    createNewDeck: !!value.createNewDeck,
    newDeckName: String(value.newDeckName || ''),
    cards: value.cards.map((card, index) => ({
      ...card,
      key: card.key ?? `ai-${index}`,
      kept: card.kept !== false,
      manual: !!card.manual,
      savedCardId: card.savedCardId ?? null,
    })),
  };
}

// cards: [{front, back}], sourceLabel: texto corto de dónde salieron.
export async function setDraft(cards, sourceLabel, { folderId = null, createNewDeck = false } = {}) {
  const stamp = Date.now();
  draft = normalizeDraft({
    cards: cards.map((card, index) => ({
      ...card,
      key: `ai-${stamp}-${index}`,
      kept: true,
      savedCardId: null,
    })),
    sourceLabel,
    deckId: null,
    folderId,
    createNewDeck,
  });
  await setSetting(DRAFT_KEY, draft);
  return draft;
}

export function getDraft() {
  return draft;
}

export async function loadDraft() {
  if (draft) return draft;
  draft = normalizeDraft(await getSetting(DRAFT_KEY, null));
  return draft;
}

export async function persistDraft(nextDraft) {
  draft = normalizeDraft(nextDraft);
  await setSetting(DRAFT_KEY, draft);
  return draft;
}

export async function clearDraft() {
  draft = null;
  await setSetting(DRAFT_KEY, null);
}
