import { buildBackup, normalizeBackup } from "./backup";

const cleanName = (value) => String(value || "").trim().toLocaleLowerCase("es");
const cardKey = (card) => `${String(card.front || "")}\u0000${String(card.back || "")}`;
const chatKey = (chat, messages) => JSON.stringify([
  String(chat.title || ""),
  messages
    .filter((message) => Number(message.chat_id) === Number(chat.id))
    .map((message) => [message.role, message.text]),
]);

function uniqueImportedName(name, used) {
  if (!used.has(cleanName(name))) {
    used.add(cleanName(name));
    return name;
  }
  let suffix = 1;
  let candidate = `${name} (importado)`;
  while (used.has(cleanName(candidate))) {
    suffix += 1;
    candidate = `${name} (importado ${suffix})`;
  }
  used.add(cleanName(candidate));
  return candidate;
}

function previewCard(card) {
  return {
    id: Number(card.id),
    front: String(card.front || ""),
    back: String(card.back || ""),
  };
}

export function buildAdditiveImportPlan(currentBackup, incomingBackup) {
  const current = normalizeBackup(currentBackup);
  const incoming = normalizeBackup(incomingBackup);
  const seenCardKeys = new Set(current.cards.map(cardKey));
  const seenChatKeys = new Set(current.gym_chats.map((chat) => chatKey(chat, current.gym_messages)));
  const duplicateCardIds = new Set();
  const novelCardsByDeck = new Map();

  for (const card of incoming.cards) {
    const key = cardKey(card);
    if (seenCardKeys.has(key)) {
      duplicateCardIds.add(Number(card.id));
      continue;
    }
    seenCardKeys.add(key);
    const deckId = Number(card.deck_id);
    const list = novelCardsByDeck.get(deckId) || [];
    list.push(previewCard(card));
    novelCardsByDeck.set(deckId, list);
  }

  const usedFolderNames = new Set(current.folders.map((folder) => cleanName(folder.name)));
  const usedDeckNames = new Set(current.decks.map((deck) => cleanName(deck.name)));
  const folderById = new Map(incoming.folders.map((folder) => [Number(folder.id), folder]));
  const folderNodes = new Map();
  const looseDecks = [];

  for (const deck of incoming.decks) {
    const cards = novelCardsByDeck.get(Number(deck.id)) || [];
    if (!cards.length) continue;
    const importName = uniqueImportedName(deck.name, usedDeckNames);
    const deckNode = {
      id: Number(deck.id),
      name: deck.name,
      importName,
      renamed: importName !== deck.name,
      duplicateCount: incoming.cards.filter(
        (card) => Number(card.deck_id) === Number(deck.id) && duplicateCardIds.has(Number(card.id))
      ).length,
      cards,
    };
    const sourceFolder = folderById.get(Number(deck.folder_id));
    if (!sourceFolder) {
      looseDecks.push(deckNode);
      continue;
    }
    let folderNode = folderNodes.get(Number(sourceFolder.id));
    if (!folderNode) {
      const folderImportName = uniqueImportedName(sourceFolder.name, usedFolderNames);
      folderNode = {
        id: Number(sourceFolder.id),
        name: sourceFolder.name,
        importName: folderImportName,
        renamed: folderImportName !== sourceFolder.name,
        decks: [],
      };
      folderNodes.set(Number(sourceFolder.id), folderNode);
    }
    folderNode.decks.push(deckNode);
  }

  const chats = incoming.gym_chats
    .filter((chat) => {
      const key = chatKey(chat, incoming.gym_messages);
      if (seenChatKeys.has(key)) return false;
      seenChatKeys.add(key);
      return true;
    })
    .map((chat) => ({
      id: Number(chat.id),
      title: chat.title || "Nueva charla",
      messageCount: incoming.gym_messages.filter(
        (message) => Number(message.chat_id) === Number(chat.id)
      ).length,
    }));

  const allDecks = [...folderNodes.values()].flatMap((folder) => folder.decks).concat(looseDecks);
  const cardIds = allDecks.flatMap((deck) => deck.cards.map((card) => card.id));
  return {
    folders: [...folderNodes.values()],
    looseDecks,
    chats,
    initialSelection: {
      cardIds,
      chatIds: chats.map((chat) => chat.id),
    },
    counts: {
      cards: cardIds.length,
      chats: chats.length,
      duplicateCards: duplicateCardIds.size,
      duplicateChats: incoming.gym_chats.length - chats.length,
      decks: allDecks.length,
      folders: folderNodes.size,
    },
  };
}

export async function prepareAdditiveImport(db, incomingBackup) {
  const current = await buildBackup(db);
  return buildAdditiveImportPlan(current, incomingBackup);
}

async function insertRow(db, table, row) {
  const cols = Object.keys(row);
  const placeholders = cols.map(() => "?").join(", ");
  const result = await db.runAsync(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`,
    cols.map((column) => row[column])
  );
  return Number(result.lastInsertRowId);
}

function without(row, ...keys) {
  const copy = { ...row };
  for (const key of keys) delete copy[key];
  return copy;
}

function parseMetadata(value) {
  if (!value) return null;
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

function remapNumber(value, map) {
  if (value == null) return undefined;
  return map.get(Number(value));
}

function remapMessageMetadata(value, maps) {
  const metadata = parseMetadata(value);
  if (!metadata) return null;
  const next = { ...metadata };
  if (Array.isArray(next.attachments)) {
    next.attachments = next.attachments.map((attachment) => {
      const cardId = remapNumber(attachment.cardId, maps.cards);
      if (!cardId) return null;
      const card = maps.currentCards.get(cardId);
      return { ...attachment, cardId, deckId: card?.deck_id || remapNumber(attachment.deckId, maps.decks) };
    }).filter(Boolean);
    if (!next.attachments.length) delete next.attachments;
  }
  if (next.action) {
    const action = { ...next.action, status: "done", importedHistory: true };
    const scalarMaps = {
      cardId: maps.cards,
      selectedCardId: maps.cards,
      createdCardId: maps.cards,
      originCardId: maps.cards,
      deckId: maps.decks,
      createdDeckId: maps.decks,
      folderId: maps.folders,
      createdFolderId: maps.folders,
    };
    for (const [key, map] of Object.entries(scalarMaps)) {
      if (action[key] == null) continue;
      const mapped = remapNumber(action[key], map);
      if (mapped) action[key] = mapped;
      else delete action[key];
    }
    for (const [key, map] of [["createdCardIds", maps.cards], ["deleteDeckIds", maps.decks]]) {
      if (!Array.isArray(action[key])) continue;
      action[key] = action[key].map((id) => remapNumber(id, map)).filter(Boolean);
    }
    next.action = action;
  }
  return Object.keys(next).length ? JSON.stringify(next) : null;
}

export async function applyAdditiveImport(db, incomingBackup, selection, plan) {
  const incoming = normalizeBackup(incomingBackup);
  const selectedCards = new Set((selection?.cardIds || []).map(Number));
  const selectedChats = new Set((selection?.chatIds || []).map(Number));
  const current = await buildBackup(db);
  const currentCardByKey = new Map(current.cards.map((card) => [cardKey(card), card]));
  const currentChatKeys = new Set(current.gym_chats.map((chat) => chatKey(chat, current.gym_messages)));
  const incomingDeckById = new Map(incoming.decks.map((deck) => [Number(deck.id), deck]));
  const folderNameById = new Map((plan?.folders || []).map((folder) => [Number(folder.id), folder.importName]));
  const deckNameById = new Map(
    [...(plan?.folders || []).flatMap((folder) => folder.decks), ...(plan?.looseDecks || [])]
      .map((deck) => [Number(deck.id), deck.importName])
  );
  const maps = {
    cards: new Map(),
    decks: new Map(),
    folders: new Map(),
    currentCards: new Map(current.cards.map((card) => [Number(card.id), card])),
  };
  const incomingIdsByCardKey = new Map();
  for (const card of incoming.cards) {
    const key = cardKey(card);
    const ids = incomingIdsByCardKey.get(key) || [];
    ids.push(Number(card.id));
    incomingIdsByCardKey.set(key, ids);
    const duplicate = currentCardByKey.get(cardKey(card));
    if (duplicate) maps.cards.set(Number(card.id), Number(duplicate.id));
  }

  const queuedCardKeys = new Set();
  const cardsToCreate = incoming.cards.filter((card) => {
    const key = cardKey(card);
    if (!selectedCards.has(Number(card.id)) || maps.cards.has(Number(card.id)) || queuedCardKeys.has(key)) return false;
    queuedCardKeys.add(key);
    return true;
  });
  const neededDeckIds = new Set(cardsToCreate.map((card) => Number(card.deck_id)));
  const neededFolderIds = new Set(
    [...neededDeckIds]
      .map((deckId) => Number(incomingDeckById.get(deckId)?.folder_id))
      .filter((id) => Number.isInteger(id) && incoming.folders.some((folder) => Number(folder.id) === id))
  );
  const counts = { folders: 0, decks: 0, cards: 0, review_logs: 0, connections: 0, gym_chats: 0, gym_messages: 0 };

  await db.execAsync("BEGIN");
  try {
    for (const folder of incoming.folders) {
      if (!neededFolderIds.has(Number(folder.id))) continue;
      const newId = await insertRow(db, "folders", {
        ...without(folder, "id", "name"),
        name: folderNameById.get(Number(folder.id)) || folder.name,
      });
      maps.folders.set(Number(folder.id), newId);
      counts.folders += 1;
    }
    for (const deck of incoming.decks) {
      if (!neededDeckIds.has(Number(deck.id))) continue;
      const newId = await insertRow(db, "decks", {
        ...without(deck, "id", "name", "folder_id"),
        name: deckNameById.get(Number(deck.id)) || deck.name,
        folder_id: maps.folders.get(Number(deck.folder_id)) || null,
      });
      maps.decks.set(Number(deck.id), newId);
      counts.decks += 1;
    }

    const neededTagIds = new Set(
      incoming.deck_tags
        .filter((link) => neededDeckIds.has(Number(link.deck_id)))
        .map((link) => Number(link.tag_id))
    );
    const currentTagsByName = new Map(current.tags.map((tag) => [cleanName(tag.name), Number(tag.id)]));
    const tagMap = new Map();
    for (const tag of incoming.tags) {
      if (!neededTagIds.has(Number(tag.id))) continue;
      let tagId = currentTagsByName.get(cleanName(tag.name));
      if (!tagId) {
        tagId = await insertRow(db, "tags", without(tag, "id"));
        currentTagsByName.set(cleanName(tag.name), tagId);
      }
      tagMap.set(Number(tag.id), tagId);
    }
    for (const link of incoming.deck_tags) {
      const deckId = maps.decks.get(Number(link.deck_id));
      const tagId = tagMap.get(Number(link.tag_id));
      if (deckId && tagId) await insertRow(db, "deck_tags", { deck_id: deckId, tag_id: tagId });
    }

    const insertedCards = [];
    for (const card of cardsToCreate) {
      const deckId = maps.decks.get(Number(card.deck_id));
      if (!deckId) continue;
      const newId = await insertRow(db, "cards", {
        ...without(card, "id", "deck_id", "origin_card_id"),
        deck_id: deckId,
        origin_card_id: null,
      });
      maps.cards.set(Number(card.id), newId);
      for (const equivalentId of incomingIdsByCardKey.get(cardKey(card)) || []) {
        maps.cards.set(equivalentId, newId);
      }
      const stored = { ...card, id: newId, deck_id: deckId };
      maps.currentCards.set(newId, stored);
      insertedCards.push({ source: card, id: newId });
      counts.cards += 1;
    }
    for (const item of insertedCards) {
      const originId = maps.cards.get(Number(item.source.origin_card_id));
      if (originId) await db.runAsync("UPDATE cards SET origin_card_id = ? WHERE id = ?", [originId, item.id]);
    }
    for (const log of incoming.review_logs) {
      if (!selectedCards.has(Number(log.card_id)) || !insertedCards.some((item) => Number(item.source.id) === Number(log.card_id))) continue;
      await insertRow(db, "review_logs", {
        ...without(log, "id", "card_id"),
        card_id: maps.cards.get(Number(log.card_id)),
      });
      counts.review_logs += 1;
    }

    const connectionKeys = new Set(current.connections.map((connection) => JSON.stringify([
      Number(connection.card_id), connection.final_text, connection.transcript || "",
    ])));
    for (const connection of incoming.connections) {
      const followsSelectedCard = selectedCards.has(Number(connection.card_id)) ||
        selectedCards.has(Number(connection.hybrid_card_id));
      if (!followsSelectedCard) continue;
      const cardId = maps.cards.get(Number(connection.card_id));
      if (!cardId) continue;
      const key = JSON.stringify([cardId, connection.final_text, connection.transcript || ""]);
      if (connectionKeys.has(key)) continue;
      await insertRow(db, "connections", {
        ...without(connection, "id", "card_id", "hybrid_card_id"),
        card_id: cardId,
        hybrid_card_id: maps.cards.get(Number(connection.hybrid_card_id)) || null,
      });
      connectionKeys.add(key);
      counts.connections += 1;
    }

    for (const chat of incoming.gym_chats) {
      if (!selectedChats.has(Number(chat.id))) continue;
      const key = chatKey(chat, incoming.gym_messages);
      if (currentChatKeys.has(key)) continue;
      const newChatId = await insertRow(db, "gym_chats", {
        ...without(chat, "id", "origin_card_id"),
        origin_card_id: maps.cards.get(Number(chat.origin_card_id)) || null,
      });
      counts.gym_chats += 1;
      for (const message of incoming.gym_messages.filter(
        (item) => Number(item.chat_id) === Number(chat.id)
      )) {
        await insertRow(db, "gym_messages", {
          ...without(message, "id", "chat_id", "metadata"),
          chat_id: newChatId,
          metadata: remapMessageMetadata(message.metadata, maps),
        });
        counts.gym_messages += 1;
      }
      currentChatKeys.add(key);
    }
    await db.execAsync("COMMIT");
  } catch (error) {
    await db.execAsync("ROLLBACK");
    throw error;
  }
  return counts;
}
