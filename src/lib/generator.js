// Generación de tarjetas con IA: texto plano o PDF → [{front, back}].
// Conserva la preselección obligatoria antes de guardar cualquier propuesta.

import { callOpenAIJson, MODELS, REASONING } from "./openai";
import { buildGeneratorMessage, buildGeneratorPdfPrompt, GENERATOR_SYSTEM } from "./prompts";
import { normalizeGeneratedCard } from "./generatedCardFormat";
import { decodeTable, decodeToggle, encodeTable, encodeToggle, IMG_SENTINEL } from "./richtext";
import { decodeList, encodeList } from "./richContent";

function validateCards(result) {
  if (!result || !Array.isArray(result.cards)) {
    throw new Error("La IA no devolvió tarjetas. Probá de nuevo.");
  }
  const cards = result.cards.map(normalizeGeneratedCard);
  if (cards.length === 0) {
    throw new Error("La IA no encontró conceptos para crear tarjetas en este material.");
  }
  return cards;
}

// Reemplaza los marcadores [IMG:n] que la IA conservó por el bloque imagen real
// (data URI ya descargado). Cada imagen queda en su propia línea. Un [IMG:n] sin
// imagen en el mapa (no se pudo bajar o no existe) se elimina. Ancho por defecto
// 100% (el usuario lo ajusta después si quiere).
export function resolveImageMarkers(cards, imageMap = {}) {
  const walk = (value) => value.split('\n').map((line) => {
    const toggle = decodeToggle(line);
    if (toggle) return encodeToggle(walk(toggle.summary), walk(toggle.content));
    const list = decodeList(line);
    if (list) return encodeList({ ...list, items: list.items.map(walk) });
    const table = decodeTable(line);
    if (table) return encodeTable(table.map((row) => row.map((cell) => ({ ...cell, text: walk(cell.text) }))));
    return line;
  }).join('\n').replace(/\n?[ \t]*\[IMG:(\d+)\][ \t]*\n?/g, (_, n) => imageMap[n] ? `\n${IMG_SENTINEL}100 ${imageMap[n]}\n` : '\n').replace(/\n{3,}/g, '\n\n').trim();
  return cards.map((c) => ({ front: walk(c.front), back: walk(c.back) }));
}

// mode: 'conceptos_clave' | 'completo' | 'personalizado'
export async function generateCardsFromText(text, mode, custom = "") {
  const result = await callOpenAIJson({
    system: GENERATOR_SYSTEM,
    messages: [{ role: "user", content: buildGeneratorMessage({ text, mode, custom }) }],
    maxTokens: 24000,
    model: MODELS.luna,
    reasoningEffort: REASONING.complex,
  });
  return validateCards(result);
}

export async function generateCardsFromPdf(base64, mode, custom = "") {
  const result = await callOpenAIJson({
    system: GENERATOR_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "input_file",
            filename: "material.pdf",
            file_data: `data:application/pdf;base64,${base64}`,
          },
          { type: "input_text", text: buildGeneratorPdfPrompt(mode, custom) },
        ],
      },
    ],
    maxTokens: 24000,
    model: MODELS.luna,
    reasoningEffort: REASONING.complex,
  });
  return validateCards(result);
}
