import { getCard, listAllCardsForSearch } from "../db/cards";
import { listDecks } from "../db/decks";
import { listFolders } from "../db/folders";
import { callOpenAIJson, REASONING } from "./openai";
import { GYM_ASSISTANT_SYSTEM } from "./prompts";
import { filterDeckCards } from "./search";
import { toPlainText } from "./richtext";

const ACTIONS = new Set([
  "search_cards",
  "edit_card",
  "create_card",
  "delete_card",
  "create_cards",
  "create_deck",
  "rename_deck",
  "move_deck",
  "delete_deck",
  "create_folder",
  "rename_folder",
  "delete_folder",
]);

const DECK_ACTIONS = new Set(["rename_deck", "move_deck", "delete_deck"]);
const FOLDER_ACTIONS = new Set(["rename_folder", "delete_folder"]);

function validCards(value) {
  return Array.isArray(value) && value.length > 0 && value.length <= 120 && value.every((card) =>
    typeof card?.front === "string" && card.front.trim() &&
    typeof card?.back === "string" && card.back.trim()
  );
}

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
  if (["create_cards", "create_deck"].includes(action.type) && action.cards != null && !validCards(action.cards)) {
    throw new Error("Las tarjetas propuestas no son válidas.");
  }
  if (action.type === "create_cards" && (!Number.isInteger(Number(action.deckId)) || !validCards(action.cards))) {
    throw new Error("La creación múltiple no es válida.");
  }
  if (["create_deck", "create_folder", "rename_deck", "rename_folder"].includes(action.type) &&
      (typeof action.name !== "string" || !action.name.trim())) {
    throw new Error("El nombre propuesto no es válido.");
  }
  if (DECK_ACTIONS.has(action.type) && !Number.isInteger(Number(action.deckId))) {
    throw new Error("El mazo propuesto no es válido.");
  }
  if (FOLDER_ACTIONS.has(action.type) && !Number.isInteger(Number(action.folderId))) {
    throw new Error("La carpeta propuesta no es válida.");
  }
  if (action.type === "delete_folder" && action.deleteDeckIds != null &&
      (!Array.isArray(action.deleteDeckIds) || action.deleteDeckIds.some((id) => !Number.isInteger(Number(id))))) {
    throw new Error("La selección de mazos a eliminar no es válida.");
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
      folderId: action.folderId == null ? undefined : Number(action.folderId),
      deleteDeckIds: action.deleteDeckIds?.map(Number),
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
          folderId: action.folderId,
          name: action.name,
          source: action.source,
          status: action.status,
          front: clip(action.front, 500),
          back: clip(action.back, 900),
          cards: action.cards?.slice(0, 120).map((card) => ({
            front: clip(card.front, 500),
            back: clip(card.back, 900),
          })),
          deleteDeckIds: action.deleteDeckIds,
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

function collectAttachedSources(messages) {
  const sources = [];
  const seen = new Set();
  for (const message of messages) {
    for (const source of message.metadata?.sources || []) {
      const key = `${source.name}:${source.base64?.length || source.text?.length || 0}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sources.push(source);
    }
  }
  return sources.slice(-6);
}

function sourceInput(sources) {
  if (!sources.length) return [];
  const content = [
    {
      type: "input_text",
      text: "Fuentes adjuntas por el usuario. Usalas según el pedido de la conversación; no asumas que quiere crear tarjetas.",
    },
  ];
  for (const source of sources) {
    if (source.kind === "text" && source.text) {
      content.push({ type: "input_text", text: `\nARCHIVO ${source.name}:\n${source.text}` });
    } else if (source.mimeType?.startsWith("image/") && source.base64) {
      content.push({
        type: "input_image",
        image_url: `data:${source.mimeType};base64,${source.base64}`,
        detail: "auto",
      });
    } else if (source.base64) {
      content.push({
        type: "input_file",
        filename: source.name || "documento",
        file_data: `data:${source.mimeType || "application/octet-stream"};base64,${source.base64}`,
      });
    }
  }
  return [{ role: "user", content }];
}

function buildContext(originCard, decks, folders, attachedCards = [], extra = "") {
  const origin = originCard
    ? `\nTARJETA DE CONTEXTO:\nID ${originCard.id}, mazo ${originCard.deck_id}\nFrente: ${originCard.front}\nDorso: ${originCard.back}`
    : "\nLa charla empezó libre, sin tarjeta de origen.";
  const folderCatalog = folders.map((folder) => `- ${folder.id}: ${folder.name}`).join("\n");
  const catalog = decks.map((deck) =>
    `- ${deck.id}: ${deck.name}; carpeta=${deck.folder_id || "sin carpeta"}; tarjetas=${deck.card_count || 0}; ideas=${deck.idea_count || 0}`
  ).join("\n");
  const attached = attachedCards.length
    ? `\n\nTARJETAS ADJUNTAS POR EL USUARIO:\n${attachedCards.map((item) =>
        `ID ${item.cardId}, mazo ${item.deckId}${item.deckName ? ` (${item.deckName})` : ""}\nFrente: ${clip(item.front, 900)}\nDorso: ${clip(item.back, 1800)}`
      ).join("\n\n")}`
    : "";
  return `CATÁLOGO DE CARPETAS:\n${folderCatalog || "(sin carpetas)"}\n\nCATÁLOGO DE MAZOS:\n${catalog || "(sin mazos)"}${origin}${attached}${extra ? `\n\n${extra}` : ""}`;
}

async function callTurn(messages, originCard, decks, folders, attachedCards = [], attachedSources = [], extra = "", allowedCardIds = []) {
  const result = await callOpenAIJson({
    system: `${GYM_ASSISTANT_SYSTEM}\n\n${buildContext(originCard, decks, folders, attachedCards, extra)}`,
    messages: [...serializeMessages(messages), ...sourceInput(attachedSources)],
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
  if (["create_cards", "rename_deck", "move_deck", "delete_deck"].includes(action?.type) &&
      !decks.some((deck) => deck.id === action.deckId)) {
    throw new Error("La IA intentó usar un mazo que no estaba en el contexto.");
  }
  if (["rename_folder", "delete_folder"].includes(action?.type) &&
      !folders.some((folder) => folder.id === action.folderId)) {
    throw new Error("La IA intentó usar una carpeta que no estaba en el contexto.");
  }
  if (["create_deck", "move_deck"].includes(action?.type) && action.folderId != null &&
      !folders.some((folder) => folder.id === action.folderId)) {
    throw new Error("La IA intentó usar una carpeta que no estaba en el contexto.");
  }
  if (action?.type === "delete_folder") {
    const children = new Set(decks.filter((deck) => Number(deck.folder_id) === action.folderId).map((deck) => deck.id));
    if ((action.deleteDeckIds || []).some((deckId) => !children.has(deckId))) {
      throw new Error("La IA intentó borrar un mazo ajeno a la carpeta.");
    }
  }
  if (action?.type === "create_card" && action.source === "hybrid" && action.originCardId !== originCard?.id) {
    throw new Error("La conexión propuesta no coincide con la tarjeta de origen.");
  }
  return turn;
}

export async function runGymAssistant({ originCard = null, messages }) {
  const [decks, folders] = await Promise.all([listDecks(), listFolders()]);
  const attachedCards = await collectAttachedCards(messages);
  const attachedSources = collectAttachedSources(messages);
  const allowedCardIds = [
    ...(originCard ? [originCard.id] : []),
    ...attachedCards.map((item) => item.cardId),
  ];
  const first = await callTurn(messages, originCard, decks, folders, attachedCards, attachedSources, "", allowedCardIds);
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
    folders,
  });
}

export async function resolveGymCardChoice({
  originCard = null,
  messages,
  cardId,
  intent = "discuss",
  instruction = "",
  decks: providedDecks,
  folders: providedFolders,
}) {
  const [card, decks, folders] = await Promise.all([
    getCard(cardId),
    providedDecks || listDecks(),
    providedFolders || listFolders(),
  ]);
  if (!card) throw new Error("La tarjeta elegida ya no existe.");
  const extra = `TARJETA ELEGIDA PARA ${intent}:\nID ${card.id}, mazo ${card.deck_id}\nFrente: ${card.front}\nDorso: ${card.back}\nPedido original: ${instruction}\nAhora respondé o prepará la acción correspondiente usando este ID real.`;
  return callTurn(messages, originCard, decks, folders, [], collectAttachedSources(messages), extra, [card.id]);
}
