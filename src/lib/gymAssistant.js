import { getCard, listAllCardsForSearch } from "../db/cards";
import { listDecks } from "../db/decks";
import { callOpenAIJson, REASONING } from "./openai";
import { GYM_ASSISTANT_SYSTEM } from "./prompts";
import { filterDeckCards } from "./search";
import { toPlainText } from "./richtext";

const ACTIONS = new Set([
  "search_cards",
  "edit_card",
  "create_card",
  "delete_card",
]);

const clip = (value, max = 900) => {
  const plain = toPlainText(value || "").trim();
  return plain.length > max ? `${plain.slice(0, max)}…` : plain;
};

export function validateGymTurn(result) {
  if (!result || typeof result.message !== "string" || !result.message.trim()) {
    throw new Error("El asistente no devolvió un mensaje válido.");
  }
  if (result.action == null) return { message: result.message.trim(), action: null };
  if (!result.action || !ACTIONS.has(result.action.type)) {
    throw new Error("El asistente propuso una acción inválida.");
  }
  const action = result.action;
  if (action.type === "search_cards" && typeof action.query !== "string") {
    throw new Error("La búsqueda propuesta no es válida.");
  }
  if (["edit_card", "delete_card"].includes(action.type) && !Number.isInteger(Number(action.cardId))) {
    throw new Error("La tarjeta propuesta no es válida.");
  }
  if (["edit_card", "create_card"].includes(action.type)) {
    if (typeof action.front !== "string" || !action.front.trim() || typeof action.back !== "string" || !action.back.trim()) {
      throw new Error("La propuesta necesita frente y dorso.");
    }
  }
  if (action.type === "create_card" && !Number.isInteger(Number(action.deckId))) {
    throw new Error("El mazo propuesto no es válido.");
  }
  const safeAction = { ...action };
  delete safeAction.status;
  delete safeAction.createdCardId;
  return {
    message: result.message.trim(),
    action: {
      ...safeAction,
      cardId: action.cardId == null ? undefined : Number(action.cardId),
      deckId: action.deckId == null ? undefined : Number(action.deckId),
      originCardId: action.originCardId == null ? undefined : Number(action.originCardId),
    },
  };
}

function serializeMessages(messages) {
  return messages.slice(-32).map((message) => {
    const action = message.metadata?.action;
    const actionSummary = action
      ? {
          type: action.type,
          cardId: action.cardId,
          deckId: action.deckId,
          source: action.source,
          status: action.status,
          front: clip(action.front, 500),
          back: clip(action.back, 900),
          reason: clip(action.reason, 300),
        }
      : null;
    return {
      role: message.role === "assistant" ? "assistant" : "user",
      content: actionSummary
        ? `${clip(message.text, 6000)}\n[Acción propuesta: ${JSON.stringify(actionSummary)}]`
        : clip(message.text, 6000),
    };
  });
}

async function collectAttachedCards(messages) {
  const byId = new Map();
  for (const message of messages) {
    for (const attachment of message.metadata?.attachments || []) {
      const cardId = Number(attachment.cardId);
      if (!Number.isInteger(cardId)) continue;
      byId.set(cardId, { ...attachment, cardId });
    }
  }
  const refs = [...byId.values()].slice(-12);
  const cards = await Promise.all(refs.map((item) => getCard(item.cardId)));
  return cards.map((card, index) => card ? {
    ...refs[index],
    cardId: card.id,
    deckId: card.deck_id,
    front: card.front,
    back: card.back,
  } : null).filter(Boolean);
}

function buildContext(originCard, decks, attachedCards = [], extra = "") {
  const origin = originCard
    ? `\nTARJETA DE CONTEXTO:\nID ${originCard.id}, mazo ${originCard.deck_id}\nFrente: ${originCard.front}\nDorso: ${originCard.back}`
    : "\nLa charla empezó libre, sin tarjeta de origen.";
  const catalog = decks.map((deck) => `- ${deck.id}: ${deck.name}`).join("\n");
  const attached = attachedCards.length
    ? `\n\nTARJETAS ADJUNTAS POR EL USUARIO:\n${attachedCards.map((item) =>
        `ID ${item.cardId}, mazo ${item.deckId}${item.deckName ? ` (${item.deckName})` : ""}\nFrente: ${clip(item.front, 900)}\nDorso: ${clip(item.back, 1800)}`
      ).join("\n\n")}`
    : "";
  return `CATÁLOGO DE MAZOS:\n${catalog || "(sin mazos)"}${origin}${attached}${extra ? `\n\n${extra}` : ""}`;
}

async function callTurn(messages, originCard, decks, attachedCards = [], extra = "", allowedCardIds = []) {
  const result = await callOpenAIJson({
    system: `${GYM_ASSISTANT_SYSTEM}\n\n${buildContext(originCard, decks, attachedCards, extra)}`,
    messages: serializeMessages(messages),
    maxTokens: 3200,
    reasoningEffort: REASONING.chat,
  });
  const turn = validateGymTurn(result);
  const action = turn.action;
  if (["edit_card", "delete_card"].includes(action?.type) && !allowedCardIds.includes(action.cardId)) {
    throw new Error("La IA intentó usar una tarjeta que no estaba en el contexto.");
  }
  if (action?.type === "create_card" && !decks.some((deck) => deck.id === action.deckId)) {
    throw new Error("La IA intentó usar un mazo que no estaba en el contexto.");
  }
  if (action?.type === "create_card" && action.source === "hybrid" && action.originCardId !== originCard?.id) {
    throw new Error("La conexión propuesta no coincide con la tarjeta de origen.");
  }
  return turn;
}

export async function runGymAssistant({ originCard = null, messages }) {
  const decks = await listDecks();
  const attachedCards = await collectAttachedCards(messages);
  const allowedCardIds = [
    ...(originCard ? [originCard.id] : []),
    ...attachedCards.map((item) => item.cardId),
  ];
  const first = await callTurn(messages, originCard, decks, attachedCards, "", allowedCardIds);
  if (first.action?.type !== "search_cards") return first;

  const allCards = await listAllCardsForSearch();
  const deckNames = Object.fromEntries(decks.map((deck) => [deck.id, deck.name]));
  const matches = filterDeckCards(allCards, first.action.query || "")
    .slice(0, 6)
    .map((card) => ({
      cardId: card.id,
      deckId: card.deck_id,
      deckName: deckNames[card.deck_id] || "Mazo",
      front: clip(card.front, 220),
      back: clip(card.back, 300),
    }));

  if (matches.length === 0) {
    return { message: "No encontré tarjetas que coincidan con esa búsqueda.", action: null };
  }
  if (matches.length > 1) {
    return {
      message: `Encontré ${matches.length} tarjetas que podrían coincidir. Elegí una.`,
      action: {
        type: "choose_card",
        intent: first.action.intent || "discuss",
        instruction: first.action.instruction || messages[messages.length - 1]?.text || "",
        options: matches,
      },
    };
  }
  return resolveGymCardChoice({
    originCard,
    messages,
    cardId: matches[0].cardId,
    intent: first.action.intent,
    instruction: first.action.instruction,
    decks,
  });
}

export async function resolveGymCardChoice({
  originCard = null,
  messages,
  cardId,
  intent = "discuss",
  instruction = "",
  decks: providedDecks,
}) {
  const [card, decks] = await Promise.all([getCard(cardId), providedDecks || listDecks()]);
  if (!card) throw new Error("La tarjeta elegida ya no existe.");
  const extra = `TARJETA ELEGIDA PARA ${intent}:\nID ${card.id}, mazo ${card.deck_id}\nFrente: ${card.front}\nDorso: ${card.back}\nPedido original: ${instruction}\nAhora respondé o prepará la acción correspondiente usando este ID real.`;
  return callTurn(messages, originCard, decks, [], extra, [card.id]);
}
