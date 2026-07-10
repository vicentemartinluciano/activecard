// Gimnasio Mental: auditoría de conexiones con Claude.
// Mantiene la conversación completa para que el auditor recuerde sus críticas.

import { callClaudeJson } from "./claude";
import { AUDITOR_SYSTEM, buildAuditorContext } from "./prompts";

// Valida y normaliza la respuesta del auditor.
export function validateAuditorResult(result) {
  if (!result || (result.veredicto !== "valida" && result.veredicto !== "critica")) {
    throw new Error("El auditor no devolvió un veredicto válido. Probá de nuevo.");
  }
  if (!result.feedback || typeof result.feedback !== "string") {
    throw new Error("El auditor no devolvió feedback. Probá de nuevo.");
  }
  const validated = result.veredicto === "valida";
  const hybrid =
    validated &&
    result.hybrid_card &&
    typeof result.hybrid_card.front === "string" &&
    typeof result.hybrid_card.back === "string" &&
    result.hybrid_card.front.trim() &&
    result.hybrid_card.back.trim()
      ? {
          front: result.hybrid_card.front.trim(),
          back: result.hybrid_card.back.trim(),
        }
      : null;
  if (validated && !hybrid) {
    // Validó pero sin tarjeta usable: lo tratamos como error recuperable.
    throw new Error("El auditor validó pero no generó la tarjeta. Reintentá.");
  }
  return { validated, feedback: result.feedback.trim(), hybrid };
}

// transcript: [{role: 'user'|'auditor', text}] en orden cronológico.
export async function auditConnection(card, transcript) {
  const messages = [
    { role: "user", content: buildAuditorContext(card) },
    ...transcript.map((m) => ({
      role: m.role === "auditor" ? "assistant" : "user",
      content: m.text,
    })),
  ];
  const result = await callClaudeJson({
    system: AUDITOR_SYSTEM,
    messages,
    maxTokens: 1500,
  });
  return validateAuditorResult(result);
}
