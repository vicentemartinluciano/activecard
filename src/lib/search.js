// Búsqueda de la Biblioteca (lógica pura, en memoria): filtra carpetas,
// mazos y tarjetas por texto. Las tarjetas se comparan por su texto plano
// (toPlainText) para que el markup de rich text ([[verde:...]], **...**)
// no genere falsos positivos ni corte coincidencias.

import { toPlainText } from "./richtext";

export const MAX_CARD_RESULTS = 20;

// Normaliza para comparar: minúsculas y sin tildes/diacríticos.
export function normalizeSearch(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Devuelve { folders, decks, cards } con lo que matchea la query.
// - Carpetas: por nombre.
// - Mazos: por nombre o por nombre de alguna de sus etiquetas.
// - Tarjetas: por el texto plano del frente o del dorso (máx. MAX_CARD_RESULTS).
// Query vacía o solo espacios → todo vacío.
export function searchLibrary(query, { folders = [], decks = [], cards = [] } = {}) {
  const q = normalizeSearch((query || "").trim());
  if (!q) return { folders: [], decks: [], cards: [] };

  const matches = (text) => normalizeSearch(text).includes(q);

  return {
    folders: folders.filter((f) => matches(f.name)),
    decks: decks.filter(
      (d) => matches(d.name) || (d.tags || []).some((t) => matches(t.name))
    ),
    cards: cards
      .filter((c) => matches(toPlainText(c.front)) || matches(toPlainText(c.back)))
      .slice(0, MAX_CARD_RESULTS),
  };
}
