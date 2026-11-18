import { DatabaseSync } from "node:sqlite";

import { migrate } from "../schema";
import { manageDatabase } from "../transactions";
import { createFolder, deleteFolder } from "../folders";
import { createDeck, deleteDeck, ensureTag, setDeckTags } from "../decks";
import { BLOCK_SENTINELS, IMG_SENTINEL } from "../../lib/richtext";
import {
  buildNoteExcerpt,
  createNote,
  deleteNote,
  duplicateNote,
  getNote,
  listNotes,
  listNotesForDeck,
  listNotesForFolder,
  setNoteDecks,
  setNoteFolders,
  setNoteTags,
  updateNote,
} from "../notes";

let sqlite;
let mockManagedDb;

jest.mock("../client", () => ({
  getDb: async () => mockManagedDb,
}));

beforeEach(async () => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const raw = {
    execAsync: async (sql) => sqlite.exec(sql),
    runAsync: async (sql, params = []) => {
      const result = sqlite.prepare(sql).run(...params);
      return { ...result, lastInsertRowId: Number(result.lastInsertRowid) };
    },
    getAllAsync: async (sql, params = []) => sqlite.prepare(sql).all(...params),
    getFirstAsync: async (sql, params = []) => sqlite.prepare(sql).get(...params),
  };
  await migrate(raw);
  mockManagedDb = manageDatabase(raw);
});

afterEach(() => {
  sqlite?.close();
});

describe("notas y vínculos bidireccionales", () => {
  test("buildNoteExcerpt limpia formato e imágenes base64 sin truncar texto útil", () => {
    const img = `${IMG_SENTINEL}data:image/png;base64,iVBORw0KGgo=`;
    expect(buildNoteExcerpt(`${BLOCK_SENTINELS.heading1}Título\n\n**Concepto** clave.\n\n${img}`)).toBe(
      "Título Concepto clave."
    );
  });

  test("crea, actualiza, ordena por fijadas/fecha, duplica y elimina en SQLite real", async () => {
    const t1 = new Date("2026-11-18T10:00:00.000Z");
    const t2 = new Date("2026-11-18T11:00:00.000Z");
    const t3 = new Date("2026-11-18T12:00:00.000Z");

    const idA = await createNote({ title: "Nota A", body: "Primero **uno**", now: t1 });
    const idB = await createNote({ title: "Nota B", body: "Segundo ==dos==", now: t2 });

    let all = await listNotes();
    expect(all.map((n) => n.id)).toEqual([idB, idA]);

    const updatedA = await updateNote(idA, {
      title: "Nota A fijada",
      body: "**Concepto** actualizado",
      pinned: 1,
      now: t3,
    });
    expect(updatedA.pinned).toBe(1);
    expect(updatedA.excerpt).toBe("Concepto actualizado");

    all = await listNotes();
    expect(all.map((n) => n.id)).toEqual([idA, idB]);
    expect(all[0]).not.toHaveProperty("body");

    const fullA = await getNote(idA);
    expect(fullA.body).toBe("**Concepto** actualizado");

    const copyId = await duplicateNote(idA);
    const copy = await getNote(copyId);
    expect(copy.title).toBe("Nota A fijada (copia)");
    expect(copy.pinned).toBe(0);

    await deleteNote(idB);
    expect(await getNote(idB)).toBeNull();
  });

  test("asociar a carpeta hereda a subcarpetas y mazos descendientes sin duplicar y sin romperse al borrar destinos", async () => {
    const rootFolder = await createFolder("Economía");
    const childFolder = await createFolder("Macroeconomía", rootFolder);
    const otherFolder = await createFolder("Historia");

    const childDeck = await createDeck("IS-LM", childFolder);
    const looseDeck = await createDeck("Micro", null);
    const tagId = await ensureTag("parcial");
    await setDeckTags(looseDeck, [tagId]);

    const folderNoteId = await createNote({
      title: "Mapa de Economía",
      body: "Visión general de toda la materia",
      folderIds: [rootFolder],
    });
    const deckNoteId = await createNote({
      title: "Fórmulas IS-LM",
      body: "Multiplicador fiscal",
      deckIds: [childDeck],
    });
    const tagNoteId = await createNote({
      title: "Checklist de repaso",
      body: "Repasar gráficos antes del examen",
      tagIds: [tagId],
    });
    const emptyNoteId = await createNote({
      title: "Suelta",
      body: "Nota sin vínculos",
      folderIds: [otherFolder],
    });
    await setNoteFolders(emptyNoteId, []);

    const forChildFolder = await listNotesForFolder(childFolder);
    expect(forChildFolder.fromAncestor.map((n) => n.id)).toEqual([folderNoteId]);
    expect(forChildFolder.fromDescendants.map((n) => n.id)).toEqual([deckNoteId]);
    expect(forChildFolder.all.map((n) => n.id)).toEqual([folderNoteId, deckNoteId]);

    const forRootFolder = await listNotesForFolder(rootFolder);
    expect(forRootFolder.direct.map((n) => n.id)).toEqual([folderNoteId]);
    expect(forRootFolder.fromDescendants.map((n) => n.id)).toEqual([deckNoteId]);

    const forChildDeck = await listNotesForDeck(childDeck, { includeBody: true });
    expect(forChildDeck.direct.map((n) => n.id)).toEqual([deckNoteId]);
    expect(forChildDeck.fromFolder.map((n) => n.id)).toEqual([folderNoteId]);
    expect(forChildDeck.fromFolder[0].body).toBe("Visión general de toda la materia");

    const forLooseDeck = await listNotesForDeck(looseDeck);
    expect(forLooseDeck.byTag.map((n) => n.id)).toEqual([tagNoteId]);

    // Si se asocia directo y también por carpeta, aparece una sola vez como "Directa" ("Mazo").
    await setNoteDecks(folderNoteId, [childDeck]);
    const deduped = await listNotesForDeck(childDeck);
    expect(deduped.direct.map((n) => n.id).sort()).toEqual([deckNoteId, folderNoteId].sort());
    expect(deduped.fromFolder).toEqual([]);

    // Filtros en listNotes por carpeta (heredado), mazo, etiqueta, fijadas y búsqueda sin tildes.
    expect((await listNotes({ folderId: childFolder })).map((n) => n.id).sort()).toEqual([deckNoteId, folderNoteId].sort());
    expect((await listNotes({ query: "economia" })).map((n) => n.id)).toEqual([folderNoteId]);
    expect((await listNotes({ tagId })).map((n) => n.id)).toEqual([tagNoteId]);

    // Borrar el mazo o la carpeta solo quita el vínculo; la nota sobrevive intacta.
    await deleteDeck(childDeck);
    const survivedDeckNote = await getNote(deckNoteId);
    expect(survivedDeckNote).not.toBeNull();
    expect(survivedDeckNote.decks).toEqual([]);

    await deleteFolder(rootFolder);
    const survivedFolderNote = await getNote(folderNoteId);
    expect(survivedFolderNote).not.toBeNull();
    expect(survivedFolderNote.folders).toEqual([]);
    await setNoteTags(tagNoteId, []);
    expect((await listNotesForDeck(looseDeck)).byTag).toEqual([]);
  });
});
