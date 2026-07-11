// Parsea el texto que Quizlet exporta desde un set (⋯ → Exportar → copiar
// texto): pares término/definición separados por un delimitador de campo,
// una tarjeta por línea (separadas por otro delimitador).

export function parseQuizletExport(text, { fieldSep = "\t", cardSep = "\n" } = {}) {
  if (!text) return [];

  const normalized = text.replace(/\r\n/g, "\n");
  const rawCards = cardSep === "\n" ? normalized.split("\n") : normalized.split(cardSep);

  const cards = [];
  for (const raw of rawCards) {
    const line = raw.trim();
    if (!line) continue;
    const sepIdx = line.indexOf(fieldSep);
    if (sepIdx === -1) continue; // sin ambos campos, se descarta
    const front = line.slice(0, sepIdx).trim();
    const back = line.slice(sepIdx + fieldSep.length).trim();
    if (!front || !back) continue;
    cards.push({ front, back });
  }
  return cards;
}
