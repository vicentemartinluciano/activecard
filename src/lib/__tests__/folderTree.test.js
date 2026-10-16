import { canMoveFolder, flattenFolders, folderPath, validateFolderTree } from "../folderTree";
import { emptyDocument, mergeDocuments, validateDocument } from "../syncDocument";

const folders = [{ id: 1, name: "Facultad" }, { id: 2, name: "Marketing", parent_id: 1 }, { id: 3, name: "Unidad 1", parent_id: 2 }];

test("las rutas conservan los ancestros y los movimientos no permiten ciclos", () => {
  expect(folderPath(folders, 3).map((f) => f.name)).toEqual(["Facultad", "Marketing", "Unidad 1"]);
  expect(canMoveFolder(folders, 1, 3)).toBe(false);
  expect(canMoveFolder(folders, 2, 2)).toBe(false);
  expect(canMoveFolder(folders, 3, 1)).toBe(true);
  expect(flattenFolders(folders).map((f) => f.depth)).toEqual([0, 1, 2]);
  expect(() => validateFolderTree([{ id: 1, parent_id: 2 }, { id: 2, parent_id: 1 }])).toThrow();
  expect(() => validateFolderTree([{ id: 1, parent_id: 99 }])).toThrow();
});

test("movimientos concurrentes que crean un ciclo se recuperan sin borrar carpetas", () => {
  const base = emptyDocument();
  base.folders = { a: { name: "A", created_at: "2026-10-16T12:00:00Z", parent_id: null }, b: { name: "B", created_at: "2026-10-16T12:00:00Z", parent_id: null } };
  const local = JSON.parse(JSON.stringify(base)); local.folders.a.parent_id = "b";
  const remote = JSON.parse(JSON.stringify(base)); remote.folders.b.parent_id = "a";
  const merged = mergeDocuments(base, local, remote);
  expect(Object.keys(merged.document.folders)).toHaveLength(2);
  expect(merged.conflicts).toHaveLength(1);
  expect(() => validateDocument(merged.document)).not.toThrow();
});
