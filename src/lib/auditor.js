// Gimnasio Mental: charla con el Socio Exigente para construir una conexión.
// Mantiene la conversación completa (y las tarjetas propuestas) para que el
// socio recuerde lo hablado a lo largo de los turnos.

import { callClaudeJson } from "./claude";
import { AUDITOR_SYNTH_REQUEST, AUDITOR_SYSTEM, buildAuditorContext } from "./prompts";

// Valida y normaliza un turno del socio del Gimnasio Mental.
export function validateAuditorTurn(result) {
  if (!result || (result.modo !== "charla" && result.modo !== "sintesis")) {
    throw new Error("El auditor no devolvió un modo válido. Probá de nuevo.");
  }
  if (!result.mensaje || typeof result.mensaje !== "string" || !result.mensaje.trim()) {
    throw new Error("El auditor no devolvió mensaje. Probá de nuevo.");
  }
  const synthesis = result.modo === "sintesis";
  const card =
    synthesis &&
    result.tarjeta &&
    typeof result.tarjeta.front === "string" &&
    typeof result.tarjeta.back === "string" &&
    result.tarjeta.front.trim() &&
    result.tarjeta.back.trim()
      ? { front: result.tarjeta.front.trim(), back: result.tarjeta.back.trim() }
      : null;
  if (synthesis && !card) {
    // Propuso sintetizar pero sin tarjeta usable: error recuperable.
    throw new Error("El auditor propuso sintetizar pero no armó la tarjeta. Reintentá.");
  }
  return { mode: result.modo, message: result.mensaje.trim(), card };
}

// Serializa el transcript para la API. Los turnos del auditor que traían una
// tarjeta propuesta la re-inyectan en el contenido para que el modelo la
// recuerde si el usuario vuelve de la preview a seguir charlando.
// transcript: [{role: 'user'|'auditor', text, card?}] en orden cronológico.
export function buildAuditorMessages(card, transcript, { forceSynthesis = false } = {}) {
  const messages = [
    { role: "user", content: buildAuditorContext(card) },
    ...transcript.map((m) => ({
      role: m.role === "auditor" ? "assistant" : "user",
      content: m.card
        ? `${m.text}\n\n[TARJETA PROPUESTA]\nFrente: ${m.card.front}\nDorso: ${m.card.back}`
        : m.text,
    })),
  ];
  if (forceSynthesis) messages.push({ role: "user", content: AUDITOR_SYNTH_REQUEST });
  return messages;
}

export async function auditConnection(card, transcript, options = {}) {
  const result = await callClaudeJson({
    system: AUDITOR_SYSTEM,
    messages: buildAuditorMessages(card, transcript, options),
    maxTokens: 1500,
  });
  return validateAuditorTurn(result);
}
