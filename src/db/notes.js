import { folderPath } from "../lib/folderTree";
import { toPlainText } from "../lib/richtext";
import { normalizeSearch } from "../lib/search";
import { getDb } from "./client";
import { withDbConnection, withDbTransaction } from "./transactions";

const NOTE_LIST_COLS = "id, sync_id, title, description, excerpt, icon, pinned, created_at, updated_at";

export function buildNoteExcerpt(body = "") {
  return toPlainText(String(body || ""))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function uniqueIds(ids = []) {
  return [...new Set((ids || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
}

function isoDate(now = new Date()) {
  if (now instanceof Date) return now.toISOString();
  const parsed = new Date(now);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

async function hydrateNotes(tx, rows = []) {
  if (!rows.length) return [];
  const [deckLinks, folderLinks, tagLinks] = await Promise.all([
    tx.getAllAsync(
      `SELECT nd.note_id, d.id, d.name, d.folder_id
       FROM note_decks nd JOIN decks d ON d.id = nd.deck_id
       ORDER BY d.name COLLATE NOCASE`
    ),
    tx.getAllAsync(
      `SELECT nf.note_id, f.id, f.name, f.parent_id
       FROM note_folders nf JOIN folders f ON f.id = nf.folder_id
       ORDER BY f.name COLLATE NOCASE`
    ),
    tx.getAllAsync(
      `SELECT nt.note_id, t.id, t.name
       FROM note_tags nt JOIN tags t ON t.id = nt.tag_id
       ORDER BY t.name COLLATE NOCASE`
    ),
  ]);
  const decksByNote = new Map();
  const foldersByNote = new Map();
  const tagsByNote = new Map();
  for (const row of deckLinks) {
    (decksByNote.get(row.note_id) || decksByNote.set(row.note_id, []).get(row.note_id)).push({
      id: row.id,
      name: row.name,
      folder_id: row.folder_id ?? null,
    });
  }
  for (const row of folderLinks) {
    (foldersByNote.get(row.note_id) || foldersByNote.set(row.note_id, []).get(row.note_id)).push({
      id: row.id,
      name: row.name,
      parent_id: row.parent_id ?? null,
    });
  }
  for (const row of tagLinks) {
    (tagsByNote.get(row.note_id) || tagsByNote.set(row.note_id, []).get(row.note_id)).push({
      id: row.id,
      name: row.name,
    });
  }
  return rows.map((note) => ({
    ...note,
    description: String(note.description || ""),
    pinned: note.pinned ? 1 : 0,
    decks: decksByNote.get(note.id) || [],
    folders: foldersByNote.get(note.id) || [],
    tags: tagsByNote.get(note.id) || [],
  }));
}

async function loadAllNotes(tx, { includeBody = false } = {}) {
  const cols = includeBody ? "*" : NOTE_LIST_COLS;
  const rows = await tx.getAllAsync(
    `SELECT ${cols} FROM notes ORDER BY pinned DESC, updated_at DESC, id DESC`
  );
  return hydrateNotes(tx, rows);
}

function classifyForDeck(notes, deck, folders, deckTagIds) {
  const direct = [];
  const fromFolder = [];
  const byTag = [];
  const ancestors = [...folderPath(folders, deck.folder_id)].reverse();
  const ancestorIndex = new Map(ancestors.map((folder, index) => [folder.id, index]));

  for (const note of notes) {
    if (note.decks.some((d) => d.id === deck.id)) {
      direct.push({ ...note, origin: { kind: "direct", label: "Mazo" } });
      continue;
    }
    const matchedFolders = note.folders
      .filter((f) => ancestorIndex.has(f.id))
      .sort((a, b) => ancestorIndex.get(a.id) - ancestorIndex.get(b.id));
    if (matchedFolders.length) {
      const folder = matchedFolders[0];
      fromFolder.push({
        ...note,
        origin: { kind: "folder", folderId: folder.id, folderName: folder.name, label: `Carpeta · ${folder.name}` },
      });
      continue;
    }
    if (deckTagIds.size > 0) {
      const sharedTag = note.tags.find((t) => deckTagIds.has(t.id));
      if (sharedTag) {
        byTag.push({
          ...note,
          origin: { kind: "tag", tagId: sharedTag.id, tagName: sharedTag.name, label: `#${sharedTag.name}` },
        });
      }
    }
  }
  return { direct, fromFolder, byTag, all: [...direct, ...fromFolder, ...byTag] };
}

function folderSubtreeIds(folders, folderId) {
  return new Set(
    folders
      .filter((f) => f.id === folderId || folderPath(folders, f.id).some((part) => part.id === folderId))
      .map((f) => f.id)
  );
}

function classifyForFolder(notes, folderId, folders, decks) {
  const targetId = Number(folderId);
  const direct = [];
  const fromAncestor = [];
  const fromDescendants = [];
  const ancestors = folderPath(folders, targetId).filter((f) => f.id !== targetId).reverse();
  const ancestorIndex = new Map(ancestors.map((f, index) => [f.id, index]));
  const subtree = folderSubtreeIds(folders, targetId);
  const descendantFolderIds = new Set([...subtree].filter((id) => id !== targetId));
  const subtreeDecks = decks.filter((d) => subtree.has(d.folder_id));
  const subtreeDeckIds = new Set(subtreeDecks.map((d) => d.id));

  for (const note of notes) {
    if (note.folders.some((f) => f.id === targetId)) {
      direct.push({ ...note, origin: { kind: "direct", label: "Esta carpeta" } });
      continue;
    }
    const matchedAncestors = note.folders
      .filter((f) => ancestorIndex.has(f.id))
      .sort((a, b) => ancestorIndex.get(a.id) - ancestorIndex.get(b.id));
    if (matchedAncestors.length) {
      const folder = matchedAncestors[0];
      fromAncestor.push({
        ...note,
        origin: { kind: "folder", folderId: folder.id, folderName: folder.name, label: `Carpeta · ${folder.name}` },
      });
      continue;
    }
    const matchedDeck = note.decks.find((d) => subtreeDeckIds.has(d.id));
    const matchedSubfolder = note.folders.find((f) => descendantFolderIds.has(f.id));
    if (matchedDeck || matchedSubfolder) {
      const label = matchedDeck ? `Mazo · ${matchedDeck.name}` : `Subcarpeta · ${matchedSubfolder.name}`;
      fromDescendants.push({
        ...note,
        origin: { kind: "descendant", label },
      });
    }
  }
  return { direct, fromAncestor, fromDescendants, all: [...direct, ...fromAncestor, ...fromDescendants] };
}

export async function listNotes({ query = "", folderId = null, deckId = null, tagId = null, pinnedOnly = false } = {}) {
  const db = await getDb();
  return withDbConnection(db, async (tx) => {
    let notes = await loadAllNotes(tx, { includeBody: false });
    if (deckId != null) {
      const deck = await tx.getFirstAsync("SELECT * FROM decks WHERE id = ?", [Number(deckId)]);
      if (!deck) return [];
      const [folders, deckTags] = await Promise.all([
        tx.getAllAsync("SELECT * FROM folders"),
        tx.getAllAsync("SELECT tag_id FROM deck_tags WHERE deck_id = ?", [Number(deckId)]),
      ]);
      notes = classifyForDeck(notes, deck, folders, new Set(deckTags.map((r) => r.tag_id))).all;
    } else if (folderId != null) {
      const [folders, decks] = await Promise.all([
        tx.getAllAsync("SELECT * FROM folders"),
        tx.getAllAsync("SELECT id, name, folder_id FROM decks"),
      ]);
      notes = classifyForFolder(notes, folderId, folders, decks).all;
    }
    if (tagId != null) {
      const wantedTag = Number(tagId);
      notes = notes.filter((note) => note.tags.some((tag) => tag.id === wantedTag));
    }
    if (pinnedOnly) {
      notes = notes.filter((note) => note.pinned);
    }
    const q = normalizeSearch(String(query || "").trim());
    if (q) {
      notes = notes.filter((note) => {
        const haystack = [
          note.title,
          note.description,
          note.excerpt,
          ...note.decks.map((d) => d.name),
          ...note.folders.map((f) => f.name),
          ...note.tags.map((t) => t.name),
        ].join(" ");
        return normalizeSearch(haystack).includes(q);
      });
    }
    return notes;
  });
}

export async function getNote(id) {
  const db = await getDb();
  return withDbConnection(db, async (tx) => {
    const row = await tx.getFirstAsync("SELECT * FROM notes WHERE id = ?", [Number(id)]);
    if (!row) return null;
    const [hydrated] = await hydrateNotes(tx, [row]);
    return hydrated;
  });
}

async function insertLinks(tx, table, column, noteId, ids) {
  for (const targetId of uniqueIds(ids)) {
    await tx.runAsync(`INSERT OR IGNORE INTO ${table} (note_id, ${column}) VALUES (?, ?)`, [noteId, targetId]);
  }
}

export async function createNote({
  title = "",
  description = "",
  body = "",
  icon = null,
  pinned = 0,
  deckIds = [],
  folderIds = [],
  tagIds = [],
  now = new Date(),
} = {}) {
  const db = await getDb();
  return withDbTransaction(db, async (tx) => {
    const timestamp = isoDate(now);
    const cleanBody = String(body || "");
    const res = await tx.runAsync(
      `INSERT INTO notes (title, description, body, excerpt, icon, pinned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(title || ""),
        String(description || ""),
        cleanBody,
        buildNoteExcerpt(cleanBody),
        icon || null,
        pinned ? 1 : 0,
        timestamp,
        timestamp,
      ]
    );
    const noteId = Number(res.lastInsertRowId);
    await insertLinks(tx, "note_decks", "deck_id", noteId, deckIds);
    await insertLinks(tx, "note_folders", "folder_id", noteId, folderIds);
    await insertLinks(tx, "note_tags", "tag_id", noteId, tagIds);
    return noteId;
  });
}

export async function updateNote(id, { title, description, body, icon, pinned, now = new Date() } = {}) {
  const db = await getDb();
  return withDbTransaction(db, async (tx) => {
    const current = await tx.getFirstAsync("SELECT * FROM notes WHERE id = ?", [Number(id)]);
    if (!current) return null;
    const nextTitle = title !== undefined ? String(title ?? "") : current.title;
    const nextDescription =
      description !== undefined ? String(description ?? "") : String(current.description || "");
    const nextBody = body !== undefined ? String(body ?? "") : current.body;
    const nextExcerpt = body !== undefined ? buildNoteExcerpt(nextBody) : current.excerpt;
    const nextIcon = icon !== undefined ? (icon || null) : current.icon;
    const nextPinned = pinned !== undefined ? (pinned ? 1 : 0) : (current.pinned ? 1 : 0);
    const updatedAt = isoDate(now);
    await tx.runAsync(
      `UPDATE notes SET title = ?, description = ?, body = ?, excerpt = ?, icon = ?, pinned = ?, updated_at = ? WHERE id = ?`,
      [nextTitle, nextDescription, nextBody, nextExcerpt, nextIcon, nextPinned, updatedAt, Number(id)]
    );
    const updated = await tx.getFirstAsync("SELECT * FROM notes WHERE id = ?", [Number(id)]);
    const [hydrated] = await hydrateNotes(tx, [updated]);
    return hydrated;
  });
}

async function replaceLinks(table, column, noteId, ids, now = new Date()) {
  const db = await getDb();
  return withDbTransaction(db, async (tx) => {
    const targetId = Number(noteId);
    const existing = await tx.getFirstAsync("SELECT id FROM notes WHERE id = ?", [targetId]);
    if (!existing) throw new Error("La nota ya no existe.");
    await tx.runAsync(`DELETE FROM ${table} WHERE note_id = ?`, [targetId]);
    await insertLinks(tx, table, column, targetId, ids);
    await tx.runAsync("UPDATE notes SET updated_at = ? WHERE id = ?", [isoDate(now), targetId]);
  });
}

export const setNoteDecks = (noteId, deckIds = [], now = new Date()) =>
  replaceLinks("note_decks", "deck_id", noteId, deckIds, now);

export const setNoteFolders = (noteId, folderIds = [], now = new Date()) =>
  replaceLinks("note_folders", "folder_id", noteId, folderIds, now);

export const setNoteTags = (noteId, tagIds = [], now = new Date()) =>
  replaceLinks("note_tags", "tag_id", noteId, tagIds, now);

export async function duplicateNote(id, { now = new Date() } = {}) {
  const source = await getNote(id);
  if (!source) return null;
  const baseTitle = source.title.trim() || "Nota sin título";
  return createNote({
    title: `${baseTitle} (copia)`,
    description: source.description,
    body: source.body,
    icon: source.icon,
    pinned: 0,
    deckIds: source.decks.map((d) => d.id),
    folderIds: source.folders.map((f) => f.id),
    tagIds: source.tags.map((t) => t.id),
    now,
  });
}

export async function deleteNote(id) {
  const db = await getDb();
  await db.runAsync("DELETE FROM notes WHERE id = ?", [Number(id)]);
}

export async function listNotesForDeck(deckId, { includeBody = false } = {}) {
  if (!deckId || Number.isNaN(Number(deckId))) {
    return { direct: [], fromFolder: [], byTag: [], all: [] };
  }
  const db = await getDb();
  return withDbConnection(db, async (tx) => {
    const deck = await tx.getFirstAsync("SELECT * FROM decks WHERE id = ?", [Number(deckId)]);
    if (!deck) return { direct: [], fromFolder: [], byTag: [], all: [] };
    const [folders, deckTags, notes] = await Promise.all([
      tx.getAllAsync("SELECT * FROM folders"),
      tx.getAllAsync("SELECT tag_id FROM deck_tags WHERE deck_id = ?", [Number(deckId)]),
      loadAllNotes(tx, { includeBody }),
    ]);
    return classifyForDeck(notes, deck, folders, new Set(deckTags.map((row) => row.tag_id)));
  });
}

export async function listNotesForFolder(folderId, { includeBody = false } = {}) {
  if (!folderId || Number.isNaN(Number(folderId))) {
    return { direct: [], fromAncestor: [], fromDescendants: [], all: [] };
  }
  const db = await getDb();
  return withDbConnection(db, async (tx) => {
    const [folders, decks, notes] = await Promise.all([
      tx.getAllAsync("SELECT * FROM folders"),
      tx.getAllAsync("SELECT id, name, folder_id FROM decks"),
      loadAllNotes(tx, { includeBody }),
    ]);
    return classifyForFolder(notes, folderId, folders, decks);
  });
}
