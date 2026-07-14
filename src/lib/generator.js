// Generación de tarjetas con IA: texto plano o PDF → [{front, back}].
// Usa Haiku 4.5 (⅓ del costo de Sonnet, misma calidad para extracción). El
// contexto de 200K tokens cubre PDFs de hasta ~100 páginas; para material
// más grande, pegar el texto directo en vez de subir el archivo.

import { callClaudeJson, MODELS } from "./claude";
import { buildGeneratorMessage, buildGeneratorPdfPrompt, GENERATOR_SYSTEM } from "./prompts";

function validateCards(result) {
  if (!result || !Array.isArray(result.cards)) {
    throw new Error("La IA no devolvió tarjetas. Probá de nuevo.");
  }
  const cards = result.cards
    .filter((c) => c && typeof c.front === "string" && typeof c.back === "string")
    .map((c) => ({ front: c.front.trim(), back: c.back.trim() }))
    .filter((c) => c.front && c.back);
  if (cards.length === 0) {
    throw new Error("La IA no encontró conceptos para crear tarjetas en este material.");
  }
  return cards;
}

// mode: 'conceptos_clave' | 'completo' | 'personalizado'
export async function generateCardsFromText(text, mode, custom = "") {
  const result = await callClaudeJson({
    system: GENERATOR_SYSTEM,
    messages: [{ role: "user", content: buildGeneratorMessage({ text, mode, custom }) }],
    maxTokens: 8192,
    model: MODELS.haiku,
  });
  return validateCards(result);
}

export async function generateCardsFromPdf(base64, mode, custom = "") {
  const result = await callClaudeJson({
    system: GENERATOR_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          },
          { type: "text", text: buildGeneratorPdfPrompt(mode, custom) },
        ],
      },
    ],
    maxTokens: 8192,
    model: MODELS.haiku,
  });
  return validateCards(result);
}
